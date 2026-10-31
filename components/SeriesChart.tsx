"use client";

import { useEffect, useRef } from "react";
import { ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";

export type ChartSeries = {
  type: "histogram" | "line";
  color: string;
  data: { time: string; value: number; color?: string }[];
  /** 不同數量級的序列放在不同座標軸，例如融資 vs 融券 */
  priceScaleId?: "left" | "right";
  /** 小數位數，預設 0（張數） */
  precision?: number;
};

/** 籌碼面用的通用圖表：長條（買賣超）或折線（餘額、比例） */
export default function SeriesChart({ series }: { series: ChartSeries[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const usesLeft = series.some((s) => s.priceScaleId === "left");
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b95a7",
        fontFamily: "var(--font-geist-mono), monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      leftPriceScale: { visible: usesLeft, borderColor: "rgba(148,163,184,0.15)" },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)" },
    });

    for (const s of series) {
      const options = {
        color: s.color,
        priceScaleId: s.priceScaleId ?? "right",
        priceLineVisible: false,
        priceFormat: {
          type: "price" as const,
          precision: s.precision ?? 0,
          minMove: 1 / 10 ** (s.precision ?? 0),
        },
      };
      const api =
        s.type === "histogram"
          ? chart.addSeries(HistogramSeries, options)
          : chart.addSeries(LineSeries, { ...options, lineWidth: 2 });
      api.setData(s.data);
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series]);

  return <div ref={containerRef} className="h-full w-full" />;
}
