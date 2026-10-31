"use client";

import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";
import type { RealtimeResponse } from "@/lib/realtime";
import type { StockResponse } from "@/lib/types";
import { ALERT_PERCENT } from "@/lib/watchlist";

const price = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function trendClass(n: number) {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-fg";
}

function alertOf(q: RealtimeResponse) {
  if (q.limitUp && q.price >= q.limitUp) return { label: "漲停", className: "bg-up text-white" };
  if (q.limitDown && q.price <= q.limitDown) return { label: "跌停", className: "bg-down text-black" };
  if (Math.abs(q.changePercent) >= ALERT_PERCENT) {
    return { label: "異動", className: q.change > 0 ? "bg-up/20 text-up" : "bg-down/20 text-down" };
  }
  return null;
}

/** 監控清單中的單檔卡片：即時價 + 近一個月走勢 */
export default function WatchCard({
  code,
  quote,
  selected,
  onSelect,
  onRemove,
}: {
  code: string;
  quote?: RealtimeResponse;
  selected: boolean;
  onSelect: () => void;
  /** 編輯模式才傳入，顯示移除按鈕 */
  onRemove?: () => void;
}) {
  const [closes, setCloses] = useState<number[]>([]);

  // 近一個月收盤價畫迷你走勢（打我們自己的 /api/finmind/[code]，上市上櫃皆可）
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/finmind/${encodeURIComponent(code)}?range=1m`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: StockResponse | null) => {
        if (!cancelled && json) setCloses(json.history.map((c) => c.close));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  const alert = quote && alertOf(quote);
  const color = !quote || quote.change === 0 ? "#8b95a7" : quote.change > 0 ? "#ef4444" : "#22c55e";

  return (
    // 卡片內還有移除按鈕，因此外層用 div 而不是 button（button 不能巢狀）
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative flex cursor-pointer flex-col rounded-lg border bg-panel p-4 text-left transition outline-none hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "border-accent ring-1 ring-accent/40" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted">{code}</div>
          <div className="truncate text-sm font-medium">{quote?.name ?? "—"}</div>
        </div>
        {onRemove ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title={`從自選股移除 ${code}`}
            className="grid h-6 w-6 place-items-center rounded border border-line text-muted transition hover:border-up hover:text-up"
          >
            ✕
          </button>
        ) : (
          alert && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${alert.className}`}>{alert.label}</span>
          )
        )}
      </div>

      {quote ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            {/* key 隨價格變動，讓閃爍動畫在跳價時重新播放 */}
            <span
              key={quote.price}
              className={`animate-flash rounded px-1 -mx-1 font-mono text-2xl font-semibold tabular-nums ${trendClass(quote.change)}`}
            >
              {price(quote.price)}
            </span>
            <span className={`font-mono text-sm tabular-nums ${trendClass(quote.change)}`}>
              {quote.change > 0 ? "+" : ""}
              {quote.changePercent.toFixed(2)}%
            </span>
          </div>
          <div className={`font-mono text-xs tabular-nums ${trendClass(quote.change)}`}>
            {quote.change > 0 ? "▲" : quote.change < 0 ? "▼" : "–"} {price(Math.abs(quote.change))}
          </div>
        </>
      ) : (
        <div className="mt-3 h-12 animate-pulse rounded bg-line/40" />
      )}

      <div className="mt-2">
        <Sparkline values={closes} color={color} />
      </div>

      {quote && (
        <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 font-mono text-[11px] tabular-nums">
          <div>
            <dt className="font-sans text-[10px] text-muted">高</dt>
            <dd className={trendClass(quote.high - quote.prevClose)}>{price(quote.high)}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] text-muted">低</dt>
            <dd className={trendClass(quote.low - quote.prevClose)}>{price(quote.low)}</dd>
          </div>
          <div className="text-right">
            <dt className="font-sans text-[10px] text-muted">量（張）</dt>
            <dd>{quote.volume.toLocaleString("zh-TW")}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
