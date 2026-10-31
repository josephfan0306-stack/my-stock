import { cacheLife } from "next/cache";
import { StockError } from "./types";

// 證交所「基本市況報導」即時報價：上市（tse_）與上櫃（otc_）共用，免 token，約 5 秒更新
const MIS_API = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

type MisRow = {
  c?: string; // 代碼
  n?: string; // 名稱
  ex?: string; // tse | otc
  z?: string; // 最新成交價（"-" 代表這一筆快照沒有成交）
  pz?: string; // 前一筆成交價
  y?: string; // 昨收
  o?: string;
  h?: string;
  l?: string;
  u?: string; // 漲停
  w?: string; // 跌停
  v?: string; // 累積成交量（張）
  s?: string; // 單筆成交量（張）
  a?: string; // 委賣價 "p1_p2_..._"
  f?: string; // 委賣量
  b?: string; // 委買價
  g?: string; // 委買量
  d?: string; // 日期 YYYYMMDD
  t?: string; // 時間 HH:mm:ss
};

export type OrderLevel = { price: number; volume: number };

export type RealtimeResponse = {
  code: string;
  name: string;
  market: "tse" | "otc";
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  limitUp: number;
  limitDown: number;
  volume: number; // 累積成交量（張）
  lastVolume: number; // 最後一筆成交量（張）
  asks: OrderLevel[]; // 委賣五檔
  bids: OrderLevel[]; // 委買五檔
  time: string; // YYYY-MM-DD HH:mm:ss
};

const num = (value?: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function levels(prices = "", volumes = ""): OrderLevel[] {
  const p = prices.split("_").filter(Boolean);
  const v = volumes.split("_").filter(Boolean);
  return p.map((price, i) => ({ price: num(price), volume: num(v[i]) })).filter((l) => l.price > 0);
}

/** codes 需先排序，讓相同清單共用快取 */
async function fetchMis(codes: string[]): Promise<MisRow[]> {
  "use cache";
  // 多個使用者同時輪詢時共用同一份快取，避免打爆證交所
  cacheLife({ stale: 0, revalidate: 5, expire: 60 });

  // 一次請求查多檔：每檔同時查上市（tse_）與上櫃（otc_），用 | 串接
  const channels = codes.flatMap((c) => [`tse_${c}.tw`, `otc_${c}.tw`]).join("|");
  const res = await fetch(`${MIS_API}?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0`);
  if (!res.ok) throw new StockError(`證交所即時報價回應錯誤 (${res.status})`, 502);
  const json: { msgArray?: MisRow[] } = await res.json();
  return json.msgArray ?? [];
}

function toRealtime(row: MisRow): RealtimeResponse {
  const bids = levels(row.b, row.g);
  const asks = levels(row.a, row.f);
  const prevClose = num(row.y);
  // 盤中快照可能沒有成交價，依序退回前一筆成交價、最佳買價、昨收
  const price = num(row.z) || num(row.pz) || bids[0]?.price || prevClose;
  const change = price - prevClose;
  const d = row.d ?? "";

  return {
    code: row.c ?? "",
    name: row.n ?? "",
    market: row.ex === "otc" ? "otc" : "tse",
    price,
    prevClose,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    open: num(row.o),
    high: num(row.h),
    low: num(row.l),
    limitUp: num(row.u),
    limitDown: num(row.w),
    volume: num(row.v),
    lastVolume: num(row.s),
    asks,
    bids,
    time: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${row.t ?? ""}`,
  };
}

/** 多檔即時報價，依傳入順序回傳；查不到的代碼略過 */
export async function getRealtimeBatch(codes: string[]): Promise<RealtimeResponse[]> {
  const rows = await fetchMis([...new Set(codes)].sort());
  return codes.flatMap((code) => {
    const row = rows.find((r) => r.c === code);
    return row ? [toRealtime(row)] : [];
  });
}

export async function getRealtime(code: string): Promise<RealtimeResponse> {
  const [quote] = await getRealtimeBatch([code]);
  if (!quote) throw new StockError(`查無 ${code} 的即時報價`, 404);
  return quote;
}
