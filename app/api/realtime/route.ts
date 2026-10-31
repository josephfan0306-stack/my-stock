import type { NextRequest } from "next/server";
import { getRealtimeBatch } from "@/lib/realtime";
import { isStockCode } from "@/lib/types";

const MAX_CODES = 30; // 自選股上限 20 檔＋目前查詢的個股，保留餘裕

// GET /api/realtime?codes=2330,2308,2454（多檔即時報價，一次打證交所）
export async function GET(request: NextRequest) {
  const codes = (request.nextUrl.searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (codes.length === 0 || codes.length > MAX_CODES || !codes.every(isStockCode)) {
    return Response.json({ error: `codes 需為 1～${MAX_CODES} 個以逗號分隔的股票代碼` }, { status: 400 });
  }

  try {
    return Response.json(await getRealtimeBatch(codes));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "未知錯誤" }, { status: 502 });
  }
}
