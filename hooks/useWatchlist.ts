"use client";

import { useEffect, useState } from "react";

type State = {
  codes: string[];
  loaded: boolean;
  saving: boolean;
  error: string | null;
};

/** 自選股清單：讀寫我們自己的 /api/watchlist（存在 MongoDB） */
export function useWatchlist() {
  const [state, setState] = useState<State>({ codes: [], loaded: false, saving: false, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "自選股讀取失敗");
        if (!cancelled) setState({ codes: json.codes, loaded: true, saving: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState((s) => ({ ...s, loaded: true, error: err instanceof Error ? err.message : "自選股讀取失敗" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 先更新畫面再存檔，失敗時還原；回傳是否成功 */
  async function save(next: string[]) {
    const previous = state.codes;
    setState((s) => ({ ...s, codes: next, saving: true, error: null }));
    try {
      const res = await fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "自選股儲存失敗");
      setState((s) => ({ ...s, codes: json.codes, saving: false }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        codes: previous,
        saving: false,
        error: err instanceof Error ? err.message : "自選股儲存失敗",
      }));
      return false;
    }
  }

  return {
    ...state,
    save,
    add: (code: string) => (state.codes.includes(code) ? Promise.resolve(true) : save([...state.codes, code])),
    remove: (code: string) => save(state.codes.filter((c) => c !== code)),
  };
}
