import type { NextRequest } from "next/server";
import { handleStockRequest } from "@/lib/route-helper";
import { getTwseStock } from "@/lib/twse";

// GET /api/twse/2330?range=6m
export async function GET(request: NextRequest, ctx: RouteContext<"/api/twse/[code]">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getTwseStock);
}
