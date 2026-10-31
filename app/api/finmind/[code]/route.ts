import type { NextRequest } from "next/server";
import { handleStockRequest } from "@/lib/route-helper";
import { getFinMindStock } from "@/lib/finmind";

// GET /api/finmind/2330?range=6m
export async function GET(request: NextRequest, ctx: RouteContext<"/api/finmind/[code]">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getFinMindStock);
}
