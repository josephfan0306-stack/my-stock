"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

// 台股慣例：紅漲綠跌
const UP = "#ef4444";
const DOWN = "#22c55e";

function movingAverage(data: Candle[], period: number) {
  return data.slice(period - 1).map((_, i) => {
    const slice = data.slice(i, i + period);
    return {
      time: data[i + period - 1].date,
      value: slice.reduce((sum, c) => sum + c.close, 0) / period,
    };
  });
}

export default function PriceChart({ data }: { data: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)" },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });
    candles.setData(
      data.map((c) => ({ time: c.date, open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    const ma5 = chart.addSeries(LineSeries, {
      color: "#f5b942",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma5.setData(movingAverage(data, 5));

    const ma20 = chart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma20.setData(movingAverage(data, 20));

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(
      data.map((c, i) => ({
        time: c.date,
        value: c.volume / 1000,
        color: c.close >= (data[i - 1]?.close ?? c.open) ? "rgba(239,68,68,0.45)" : "rgba(34,197,94,0.45)",
      })),
    );

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} className="h-full w-full" />;
}
