import type { NextRequest } from "next/server";
import { getFinMindChips } from "@/lib/chips";
import { handleStockRequest } from "@/lib/route-helper";

// GET /api/finmind/2330/chips?range=3m
export async function GET(request: NextRequest, ctx: RouteContext<"/api/finmind/[code]/chips">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getFinMindChips, "3m");
}
