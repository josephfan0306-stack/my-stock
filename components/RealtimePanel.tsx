import type { RealtimeResponse } from "@/lib/realtime";

const price = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function trendClass(n: number) {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-fg";
}

/** 選取個股的即時報價與五檔（資料由儀表板的 useRealtime 統一輪詢後傳入） */
export default function RealtimePanel({
  code,
  data,
  loaded,
}: {
  code: string;
  data?: RealtimeResponse;
  loaded: boolean;
}) {
  const maxVolume = data ? Math.max(1, ...data.asks.map((l) => l.volume), ...data.bids.map((l) => l.volume)) : 1;

  return (
    <section className="flex flex-col rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium">即時報價・五檔</h2>
        <span className="flex items-center gap-1 rounded bg-up/15 px-1.5 py-0.5 text-[10px] font-semibold text-up">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> LIVE
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted">{data?.time}</span>
      </div>

      {loaded && !data && <div className="p-4 text-sm text-muted">查無 {code} 的即時報價</div>}

      {!loaded && <div className="m-4 h-64 animate-pulse rounded bg-line/40" />}

      {data && (
        <div className="space-y-4 p-4">
          <div>
            <div className={`font-mono text-3xl font-semibold tabular-nums ${trendClass(data.change)}`}>
              {price(data.price)}
            </div>
            <div className={`mt-1 font-mono text-sm tabular-nums ${trendClass(data.change)}`}>
              {data.change > 0 ? "▲" : data.change < 0 ? "▼" : "–"} {price(Math.abs(data.change))} (
              {data.changePercent.toFixed(2)}%)
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
            <Cell label="累積量（張）" value={data.volume.toLocaleString("zh-TW")} />
            <Cell label="單量" value={data.lastVolume.toLocaleString("zh-TW")} />
            <Cell label="市場" value={data.market === "tse" ? "上市" : "上櫃"} />
            <Cell label="漲停" value={price(data.limitUp)} className="text-up" />
            <Cell label="跌停" value={price(data.limitDown)} className="text-down" />
            <Cell label="昨收" value={price(data.prevClose)} />
          </dl>

          {/* 五檔 */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <OrderBook title="委買" levels={data.bids} max={maxVolume} side="bid" prevClose={data.prevClose} />
            <OrderBook title="委賣" levels={data.asks} max={maxVolume} side="ask" prevClose={data.prevClose} />
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded border border-line px-2 py-1.5">
      <dt className="font-sans text-[10px] text-muted">{label}</dt>
      <dd className={`mt-0.5 ${className}`}>{value}</dd>
    </div>
  );
}

function OrderBook({
  title,
  levels,
  max,
  side,
  prevClose,
}: {
  title: string;
  levels: { price: number; volume: number }[];
  max: number;
  side: "bid" | "ask";
  prevClose: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-muted">
        <span>{title}價</span>
        <span>量</span>
      </div>
      <ul className="space-y-0.5 font-mono tabular-nums">
        {levels.length === 0 && <li className="text-muted">—</li>}
        {levels.map((l) => (
          <li key={l.price} className="relative flex justify-between px-1 py-0.5">
            <span
              className={`absolute inset-y-0 ${side === "bid" ? "right-0 bg-up/10" : "left-0 bg-down/10"}`}
              style={{ width: `${(l.volume / max) * 100}%` }}
            />
            <span className={`relative ${trendClass(l.price - prevClose)}`}>{price(l.price)}</span>
            <span className="relative">{l.volume.toLocaleString("zh-TW")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
