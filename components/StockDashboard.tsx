"use client";

import { type FormEvent, useEffect, useState } from "react";
import ChipsPanel from "./ChipsPanel";
import MarketClock from "./MarketClock";
import NewsPanel from "./NewsPanel";
import PriceChart from "./PriceChart";
import RealtimePanel from "./RealtimePanel";
import WatchCard from "./WatchCard";
import { useRealtime } from "@/hooks/useRealtime";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Range, Source, StockResponse } from "@/lib/types";

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "twse", label: "TWSE", hint: "證交所 OpenAPI・上市" },
  { value: "tpex", label: "TPEx", hint: "櫃買中心 OpenAPI・上櫃" },
  { value: "finmind", label: "FinMind", hint: "上市＋上櫃" },
];

const SOURCE_NAMES: Record<Source, string> = {
  twse: "證交所 OpenAPI",
  tpex: "櫃買中心 OpenAPI",
  finmind: "FinMind",
};

const RANGES: { value: Range; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

const price = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString("zh-TW");

function trendClass(n: number) {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-muted";
}

export default function StockDashboard() {
  const [input, setInput] = useState("2330");
  const [code, setCode] = useState("2330");
  const [source, setSource] = useState<Source>("twse");
  const [range, setRange] = useState<Range>("6m");
  const [data, setData] = useState<StockResponse | null>(null);
  const [result, setResult] = useState<{ url: string; error: string | null } | null>(null);

  // 自選股存在 MongoDB，透過 /api/watchlist 讀寫
  const watchlist = useWatchlist();
  const [editing, setEditing] = useState(false);
  const [newCode, setNewCode] = useState("");
  const inWatchlist = watchlist.codes.includes(code);

  // 自選股＋目前選取的個股，一次輪詢 /api/realtime?codes=...
  const realtime = useRealtime([...watchlist.codes, code]);
  const watchQuotes = watchlist.codes.map((c) => realtime.quotes[c]).filter(Boolean);
  const advancers = watchQuotes.filter((q) => q.change > 0).length;
  const decliners = watchQuotes.filter((q) => q.change < 0).length;

  // 打我們自己的後端 API：/api/twse|tpex|finmind/[code]
  const url = `/api/${source}/${encodeURIComponent(code)}?range=${range}`;
  const loading = result?.url !== url;
  const error = loading ? null : result.error;

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "查詢失敗");
        if (cancelled) return;
        setData(json);
        setResult({ url, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ url, error: err instanceof Error ? err.message : "查詢失敗" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (next) setCode(next);
  }

  function pick(next: string) {
    setInput(next);
    setCode(next);
  }

  async function addFromInput(e: FormEvent) {
    e.preventDefault();
    const codes = newCode
      .split(/[\s,，、]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && !watchlist.codes.includes(c));
    if (codes.length === 0) return;
    if (await watchlist.save([...watchlist.codes, ...codes])) setNewCode("");
  }

  const q = error ? undefined : data?.quote;
  const prevClose = q ? q.close - q.change : 0;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded bg-accent/15 font-mono text-sm font-bold text-accent">
              J
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">Joseph股票摘要</div>
              <div className="text-[11px] text-muted">台股監控儀表板</div>
            </div>
          </div>

          <form onSubmit={submit} className="order-3 flex w-full gap-2 sm:order-none sm:ml-6 sm:w-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入股票代碼，例：2330"
              className="w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-sm outline-none placeholder:text-muted focus:border-accent sm:w-56"
            />
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas hover:brightness-110">
              查詢
            </button>
          </form>

          <div className="ml-auto flex items-center gap-3">
            <MarketClock />
            <div className="flex rounded-md border border-line p-0.5">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  title={s.hint}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    source === s.value ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 px-4 py-5 sm:px-6">
        {/* 自選股 */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-sm font-medium">我的自選股</h2>
            <span className="text-xs text-muted">
              {watchlist.codes.length} 檔・
              <span className="text-up">上漲 {advancers}</span>・
              <span className="text-down">下跌 {decliners}</span>・平盤 {watchQuotes.length - advancers - decliners}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {realtime.error
                ? `⚠ ${realtime.error}`
                : realtime.updatedAt
                  ? `更新於 ${realtime.updatedAt.toLocaleTimeString("zh-TW", { hour12: false })}`
                  : "連線中…"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {editing && (
                <form onSubmit={addFromInput} className="flex gap-2">
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="代碼，可用逗號一次加多檔"
                    autoFocus
                    className="w-56 rounded-md border border-line bg-canvas px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted focus:border-accent"
                  />
                  <button
                    disabled={watchlist.saving}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas hover:brightness-110 disabled:opacity-50"
                  >
                    加入
                  </button>
                </form>
              )}
              <button
                onClick={() => setEditing((v) => !v)}
                className={`rounded-md border px-3 py-1.5 text-xs transition ${
                  editing ? "border-accent text-accent" : "border-line text-muted hover:text-fg"
                }`}
              >
                {editing ? "完成" : "編輯自選股"}
              </button>
            </div>
          </div>

          {watchlist.error && (
            <div className="mb-2 rounded-md border border-up/40 bg-up/10 px-3 py-2 text-xs text-up">
              {watchlist.error}
            </div>
          )}

          {!watchlist.loaded ? (
            <div className="h-56 animate-pulse rounded-lg bg-line/40" />
          ) : watchlist.codes.length === 0 ? (
            <div className="grid h-32 place-items-center rounded-lg border border-dashed border-line text-sm text-muted">
              自選股是空的，點「編輯自選股」輸入股票代碼加入
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {watchlist.codes.map((c) => (
                <WatchCard
                  key={c}
                  code={c}
                  quote={realtime.quotes[c]}
                  selected={code === c}
                  onSelect={() => pick(c)}
                  onRemove={editing ? () => watchlist.remove(c) : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-up/40 bg-up/10 px-4 py-3 text-sm text-up">{error}</div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* 個股：收盤行情＋歷史走勢 */}
          <section className="rounded-lg border border-line bg-panel">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-line px-4 py-3">
              {q && data ? (
                <>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h1 className="text-xl font-semibold">{data.name || data.code}</h1>
                      <span className="font-mono text-sm text-muted">{data.code}</span>
                      <button
                        onClick={() => (inWatchlist ? watchlist.remove(code) : watchlist.add(code))}
                        disabled={!watchlist.loaded || watchlist.saving}
                        title={inWatchlist ? "從自選股移除" : "加入自選股"}
                        className={`ml-1 rounded border px-2 py-0.5 text-xs transition disabled:opacity-50 ${
                          inWatchlist
                            ? "border-accent/50 text-accent hover:border-up hover:text-up"
                            : "border-line text-muted hover:border-accent hover:text-accent"
                        }`}
                      >
                        {inWatchlist ? "★ 自選股" : "☆ 加入自選"}
                      </button>
                    </div>
                    <div className="text-[11px] text-muted">
                      收盤資料 {q.date}・{SOURCE_NAMES[data.source]}
                    </div>
                  </div>
                  <div className={`font-mono text-3xl font-semibold tabular-nums ${trendClass(q.change)}`}>
                    {price(q.close)}
                  </div>
                  <div className={`pb-1 font-mono text-sm tabular-nums ${trendClass(q.change)}`}>
                    {q.change > 0 ? "▲" : q.change < 0 ? "▼" : "–"} {price(Math.abs(q.change))} (
                    {q.change > 0 ? "+" : ""}
                    {q.changePercent.toFixed(2)}%)
                  </div>
                </>
              ) : (
                <div className="h-12 w-64 animate-pulse rounded bg-line/40" />
              )}
              <div className="ml-auto flex rounded-md border border-line p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`rounded px-3 py-1 font-mono text-xs transition ${
                      range === r.value ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {q && (
              <dl className="grid grid-cols-4 gap-px border-b border-line bg-line lg:grid-cols-8">
                <Stat label="開盤" value={price(q.open)} className={trendClass(q.open - prevClose)} />
                <Stat label="最高" value={price(q.high)} className={trendClass(q.high - prevClose)} />
                <Stat label="最低" value={price(q.low)} className={trendClass(q.low - prevClose)} />
                <Stat label="昨收" value={price(prevClose)} />
                <Stat label="成交量（張）" value={int(q.volume / 1000)} />
                <Stat label="成交金額（億）" value={(q.value / 1e8).toFixed(2)} />
                <Stat label="成交筆數" value={int(q.transactions)} />
                <Stat
                  label="振幅"
                  value={`${prevClose ? (((q.high - q.low) / prevClose) * 100).toFixed(2) : "0.00"}%`}
                />
              </dl>
            )}

            <div className="flex items-center gap-3 px-4 pt-3 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-3 bg-[#f5b942]" /> MA5
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-3 bg-[#60a5fa]" /> MA20
              </span>
              <span>成交量單位：張</span>
            </div>
            <div className="relative h-[420px] p-2">
              {!error && data && data.history.length > 0 && <PriceChart data={data.history} />}
              {loading && (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted">載入中…</div>
              )}
            </div>
          </section>

          <RealtimePanel code={code} data={realtime.quotes[code]} loaded={realtime.updatedAt !== null} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <ChipsPanel code={code} range={range} />
          <NewsPanel code={code} />
        </div>
      </main>

      <footer className="border-t border-line py-4 text-center text-[11px] text-muted">
        資料來源：臺灣證券交易所 OpenAPI、櫃買中心 OpenAPI、證交所基本市況報導、FinMind、Yahoo股市、工商時報、經濟日報・資料僅供參考，不構成投資建議
      </footer>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-panel px-4 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
