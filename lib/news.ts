import { cacheLife } from "next/cache";
import { getRealtime } from "./realtime";

export type NewsSource = "yahoo" | "ctee" | "udn";

export type NewsItem = {
  source: NewsSource;
  title: string;
  link: string;
  publishedAt: string; // ISO
  summary: string;
};

export type NewsResponse = {
  code: string;
  name: string;
  items: NewsItem[];
  sources: { source: NewsSource; ok: boolean; count: number }[];
};

// 工商時報、經濟日報只有分類 RSS，抓股市／產業／科技類別後再用代碼與名稱過濾
const CTEE_FEEDS = ["stock", "tech", "industry"].map((c) => `https://www.ctee.com.tw/rss_web/livenews/${c}`);
// 經濟日報分類：5590 證券、5591 產業、5595 科技
const UDN_FEEDS = ["5590", "5591", "5595"].map((id) => `https://money.udn.com/rssfeed/news/1001/${id}?ch=money`);

const MAX_ITEMS = 40;
const SUMMARY_LENGTH = 120;

function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(xml: string, name: string) {
  return decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
}

/** 極簡 RSS 解析：只取 item 的 title / link / pubDate / description */
function parseRss(xml: string, source: NewsSource): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const title = tag(item, "title");
    const link = tag(item, "link");
    const date = new Date(tag(item, "pubDate"));
    if (!title || !link.startsWith("http") || Number.isNaN(date.getTime())) return [];
    const summary = tag(item, "description");
    return [
      {
        source,
        title,
        link,
        publishedAt: date.toISOString(),
        summary: summary.length > SUMMARY_LENGTH ? `${summary.slice(0, SUMMARY_LENGTH)}…` : summary,
      },
    ];
  });
}

async function fetchFeed(url: string, source: NewsSource): Promise<NewsItem[]> {
  "use cache";
  cacheLife("minutes");

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (my-stock RSS reader)" } });
  if (!res.ok) throw new Error(`${source} RSS 回應錯誤 (${res.status})`);
  return parseRss(await res.text(), source);
}

async function fetchFeeds(urls: string[], source: NewsSource) {
  const results = await Promise.allSettled(urls.map((u) => fetchFeed(u, source)));
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { items, ok: results.some((r) => r.status === "fulfilled") };
}

export async function getStockNews(code: string): Promise<NewsResponse> {
  // 由即時報價判斷名稱與上市／上櫃（Yahoo 代碼後綴不同）
  const { name, market } = await getRealtime(code);

  const codePattern = new RegExp(`(?<!\\d)${code}(?!\\d)`);
  const mentions = (n: NewsItem) => {
    const text = `${n.title} ${n.summary}`;
    return (name !== "" && text.includes(name)) || codePattern.test(text);
  };

  const [yahoo, ctee, udn] = await Promise.all([
    // Yahoo 股市有個股專屬 RSS，不需過濾
    fetchFeeds([`https://tw.stock.yahoo.com/rss?s=${code}.${market === "otc" ? "TWO" : "TW"}`], "yahoo"),
    fetchFeeds(CTEE_FEEDS, "ctee"),
    fetchFeeds(UDN_FEEDS, "udn"),
  ]);

  const filtered = {
    yahoo: yahoo.items,
    ctee: ctee.items.filter(mentions),
    udn: udn.items.filter(mentions),
  };

  // 同一則新聞可能出現在多個分類，以連結去重
  const seen = new Set<string>();
  const items = [...filtered.yahoo, ...filtered.ctee, ...filtered.udn]
    .filter((n) => !seen.has(n.link) && seen.add(n.link))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ITEMS);

  return {
    code,
    name,
    items,
    sources: (["yahoo", "ctee", "udn"] as const).map((source) => ({
      source,
      ok: { yahoo, ctee, udn }[source].ok,
      count: items.filter((n) => n.source === source).length,
    })),
  };
}
