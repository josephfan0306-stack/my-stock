import type { NextRequest } from "next/server";
import { getStockNews } from "@/lib/news";
import { handleStockRequest } from "@/lib/route-helper";

// GET /api/news/2330（Yahoo 股市、工商時報、經濟日報 RSS）
export async function GET(request: NextRequest, ctx: RouteContext<"/api/news/[code]">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getStockNews);
}
