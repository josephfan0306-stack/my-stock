"use client";

import { useEffect, useState } from "react";
import type { NewsResponse, NewsSource } from "@/lib/news";

const SOURCE_META: Record<NewsSource, { label: string; className: string }> = {
  yahoo: { label: "Yahoo股市", className: "bg-violet-500/15 text-violet-300" },
  ctee: { label: "工商時報", className: "bg-sky-500/15 text-sky-300" },
  udn: { label: "經濟日報", className: "bg-amber-500/15 text-amber-300" },
};

const FILTERS: { value: NewsSource | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "yahoo", label: "Yahoo" },
  { value: "ctee", label: "工商" },
  { value: "udn", label: "經濟" },
];

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return new Date(iso).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
}

export default function NewsPanel({ code }: { code: string }) {
  const [filter, setFilter] = useState<NewsSource | "all">("all");
  const [result, setResult] = useState<{ code: string; data: NewsResponse | null; error: string | null } | null>(
    null,
  );

  // 打我們自己的後端 API：/api/news/[code]
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/news/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "新聞取得失敗");
        if (!cancelled) setResult({ code, data: json, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ code, data: null, error: err instanceof Error ? err.message : "新聞取得失敗" });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const current = result?.code === code ? result : null;
  const data = current?.data;
  const items = data?.items.filter((n) => filter === "all" || n.source === filter) ?? [];

  return (
    <section className="flex flex-col rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium">相關新聞</h2>
        {data && <span className="text-[11px] text-muted">{data.name}</span>}
        <div className="ml-auto flex rounded-md border border-line p-0.5">
          {FILTERS.map((f) => {
            const count =
              f.value === "all" ? data?.items.length : data?.sources.find((s) => s.source === f.value)?.count;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  filter === f.value ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
                }`}
              >
                {f.label}
                {count !== undefined && <span className="ml-1 font-mono text-[10px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {current?.error && <div className="p-4 text-sm text-muted">{current.error}</div>}
      {!current && <div className="m-4 h-72 animate-pulse rounded bg-line/40" />}

      {data && (
        <>
          {data.sources.some((s) => !s.ok) && (
            <div className="border-b border-line px-4 py-2 text-[11px] text-muted">
              ⚠ 無法取得：
              {data.sources
                .filter((s) => !s.ok)
                .map((s) => SOURCE_META[s.source].label)
                .join("、")}
            </div>
          )}
          <ul className="max-h-[420px] divide-y divide-line overflow-auto">
            {items.length === 0 && (
              <li className="p-4 text-sm text-muted">
                目前沒有相關新聞（工商時報、經濟日報只搜尋各分類最新的幾十則）
              </li>
            )}
            {items.map((n) => (
              <li key={n.link}>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 transition hover:bg-line/30"
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${SOURCE_META[n.source].className}`}>
                      {SOURCE_META[n.source].label}
                    </span>
                    <span className="text-muted">{timeAgo(n.publishedAt)}</span>
                  </div>
                  <div className="mt-1.5 text-sm leading-snug">{n.title}</div>
                  {n.summary && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{n.summary}</p>}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
