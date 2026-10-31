"use client";

import { useEffect, useMemo, useState } from "react";
import SeriesChart, { type ChartSeries } from "./SeriesChart";
import type { ChipsResponse } from "@/lib/chips";
import type { Range } from "@/lib/types";

type Tab = "institutional" | "margin" | "foreign" | "dayTrading";

const TABS: { value: Tab; label: string }[] = [
  { value: "institutional", label: "三大法人" },
  { value: "margin", label: "融資融券" },
  { value: "foreign", label: "外資持股" },
  { value: "dayTrading", label: "當沖" },
];

const UP = "#ef4444";
const DOWN = "#22c55e";
const int = (n: number) => n.toLocaleString("zh-TW");
const signed = (n: number) => `${n > 0 ? "+" : ""}${int(n)}`;
const trendClass = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");

export default function ChipsPanel({ code, range }: { code: string; range: Range }) {
  const [tab, setTab] = useState<Tab>("institutional");
  const [result, setResult] = useState<{ url: string; data: ChipsResponse | null; error: string | null } | null>(
    null,
  );

  // 打我們自己的後端 API：/api/finmind/[code]/chips
  const url = `/api/finmind/${encodeURIComponent(code)}/chips?range=${range}`;
  const loading = result?.url !== url;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "籌碼資料取得失敗");
        if (!cancelled) setResult({ url, data: json, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ url, data: null, error: err instanceof Error ? err.message : "籌碼資料取得失敗" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const series = useMemo<ChartSeries[]>(() => {
    if (!data) return [];
    switch (tab) {
      case "institutional":
        return [
          {
            type: "histogram",
            color: UP,
            data: data.institutional.map((d) => ({ time: d.date, value: d.total, color: d.total >= 0 ? UP : DOWN })),
          },
        ];
      case "margin":
        return [
          { type: "line", color: "#f5b942", data: data.margin.map((d) => ({ time: d.date, value: d.marginBalance })) },
          {
            type: "line",
            color: "#a78bfa",
            priceScaleId: "left",
            data: data.margin.map((d) => ({ time: d.date, value: d.shortBalance })),
          },
        ];
      case "foreign":
        return [
          { type: "line", color: "#60a5fa", precision: 2, data: data.foreignHolding.map((d) => ({ time: d.date, value: d.ratio })) },
        ];
      case "dayTrading":
        return [
          { type: "histogram", color: "#60a5fa", data: data.dayTrading.map((d) => ({ time: d.date, value: d.volume })) },
        ];
    }
  }, [data, tab]);

  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium">籌碼面</h2>
        <span className="text-[11px] text-muted">FinMind・單位：張</span>
        <div className="ml-auto flex rounded-md border border-line p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded px-3 py-1 text-xs transition ${
                tab === t.value ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-4 text-sm text-muted">{error}</div>}
      {loading && <div className="m-4 h-72 animate-pulse rounded bg-line/40" />}

      {data && (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <Legend tab={tab} />
            <div className="h-72">
              <SeriesChart series={series} />
            </div>
          </div>
          <div className="max-h-80 overflow-auto">
            <ChipsTable tab={tab} data={data} />
          </div>
        </div>
      )}
    </section>
  );
}

function Legend({ tab }: { tab: Tab }) {
  const items: Record<Tab, { color: string; label: string }[]> = {
    institutional: [
      { color: UP, label: "合計買超" },
      { color: DOWN, label: "合計賣超" },
    ],
    margin: [
      { color: "#f5b942", label: "融資餘額（右軸）" },
      { color: "#a78bfa", label: "融券餘額（左軸）" },
    ],
    foreign: [{ color: "#60a5fa", label: "外資持股比例 %" }],
    dayTrading: [{ color: "#60a5fa", label: "當沖成交量" }],
  };
  return (
    <div className="mb-2 flex gap-3 text-[11px] text-muted">
      {items[tab].map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function ChipsTable({ tab, data }: { tab: Tab; data: ChipsResponse }) {
  const th = "sticky top-0 bg-panel px-2 py-1.5 text-right font-normal text-muted first:text-left";
  const td = "px-2 py-1.5 text-right first:text-left";

  if (tab === "institutional") {
    return (
      <table className="w-full font-mono text-xs tabular-nums">
        <thead>
          <tr>
            {["日期", "外資", "投信", "自營商", "合計"].map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.institutional.toReversed().map((d) => (
            <tr key={d.date}>
              <td className={`${td} text-muted`}>{d.date.slice(5)}</td>
              <td className={`${td} ${trendClass(d.foreign)}`}>{signed(d.foreign)}</td>
              <td className={`${td} ${trendClass(d.trust)}`}>{signed(d.trust)}</td>
              <td className={`${td} ${trendClass(d.dealer)}`}>{signed(d.dealer)}</td>
              <td className={`${td} ${trendClass(d.total)}`}>{signed(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === "margin") {
    return (
      <table className="w-full font-mono text-xs tabular-nums">
        <thead>
          <tr>
            {["日期", "融資餘額", "增減", "融券餘額", "增減"].map((h, i) => (
              <th key={i} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.margin.toReversed().map((d) => (
            <tr key={d.date}>
              <td className={`${td} text-muted`}>{d.date.slice(5)}</td>
              <td className={td}>{int(d.marginBalance)}</td>
              <td className={`${td} ${trendClass(d.marginChange)}`}>{signed(d.marginChange)}</td>
              <td className={td}>{int(d.shortBalance)}</td>
              <td className={`${td} ${trendClass(d.shortChange)}`}>{signed(d.shortChange)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const rows =
    tab === "foreign"
      ? data.foreignHolding.map((d) => ({ date: d.date, value: `${d.ratio.toFixed(2)}%` }))
      : data.dayTrading.map((d) => ({ date: d.date, value: int(d.volume) }));

  return (
    <table className="w-full font-mono text-xs tabular-nums">
      <thead>
        <tr>
          <th className={th}>日期</th>
          <th className={th}>{tab === "foreign" ? "外資持股比例" : "當沖成交量"}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.toReversed().map((d) => (
          <tr key={d.date}>
            <td className={`${td} text-muted`}>{d.date.slice(5)}</td>
            <td className={td}>{d.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
