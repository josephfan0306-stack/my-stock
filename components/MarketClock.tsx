"use client";

import { useEffect, useState } from "react";
import { isMarketOpen, taipeiParts } from "@/lib/market";

/** 台北時間時鐘與開收盤狀態 */
export default function MarketClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!now) return <div className="h-8 w-40" />;
  const open = isMarketOpen(now);

  return (
    <div className="flex items-center gap-3 rounded-md border border-line px-3 py-1.5">
      <span
        className={`flex items-center gap-1.5 text-xs font-medium ${open ? "text-down" : "text-muted"}`}
      >
        <i className={`h-2 w-2 rounded-full ${open ? "animate-pulse bg-down" : "bg-muted"}`} />
        {open ? "盤中" : "已收盤"}
      </span>
      <span className="font-mono text-xs tabular-nums text-fg">台北 {taipeiParts(now).time}</span>
    </div>
  );
}
