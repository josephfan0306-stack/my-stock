"use client";

import { useEffect, useState } from "react";
import { isMarketOpen } from "@/lib/market";
import type { RealtimeResponse } from "@/lib/realtime";

const OPEN_POLL_MS = 5000; // 盤中：證交所約 5 秒更新一次
const CLOSED_POLL_MS = 60000; // 收盤後資料不會變，降低頻率

type State = {
  quotes: Record<string, RealtimeResponse>;
  updatedAt: Date | null;
  error: string | null;
};

/** 輪詢我們自己的 /api/realtime?codes=...，一次取得多檔即時報價 */
export function useRealtime(codes: string[]) {
  const key = [...new Set(codes)].join(",");
  const [state, setState] = useState<State>({ quotes: {}, updatedAt: null, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      clearTimeout(timer);
      // 分頁在背景時不輪詢，切回來時立即更新
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/realtime?codes=${encodeURIComponent(key)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "即時報價取得失敗");
          const list: RealtimeResponse[] = json;
          if (!cancelled) {
            setState((prev) => ({
              quotes: { ...prev.quotes, ...Object.fromEntries(list.map((q) => [q.code, q])) },
              updatedAt: new Date(),
              error: null,
            }));
          }
        } catch (err) {
          if (!cancelled) {
            setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "即時報價取得失敗" }));
          }
        }
      }
      if (!cancelled) timer = setTimeout(poll, isMarketOpen(new Date()) ? OPEN_POLL_MS : CLOSED_POLL_MS);
    }

    poll();
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [key]);

  return state;
}
