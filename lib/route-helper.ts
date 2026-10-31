import type { NextRequest } from "next/server";
import { type Range, StockError, isRange, isStockCode } from "./types";

/** 所有個股 Route Handler 共用：驗證參數、統一錯誤格式 */
export async function handleStockRequest<T>(
  request: NextRequest,
  rawCode: string,
  fetcher: (code: string, range: Range) => Promise<T>,
  defaultRange: Range = "6m",
) {
  const code = rawCode.toUpperCase();
  const rangeParam = request.nextUrl.searchParams.get("range");
  const range: Range = isRange(rangeParam) ? rangeParam : defaultRange;

  if (!isStockCode(code)) {
    return Response.json({ error: "股票代碼格式錯誤" }, { status: 400 });
  }

  try {
    return Response.json(await fetcher(code, range));
  } catch (err) {
    const status = err instanceof StockError ? err.status : 500;
    const message = err instanceof Error ? err.message : "未知錯誤";
    return Response.json({ error: message }, { status });
  }
}
