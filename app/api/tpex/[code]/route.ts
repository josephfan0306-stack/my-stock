import type { NextRequest } from "next/server";
import { handleStockRequest } from "@/lib/route-helper";
import { getTpexStock } from "@/lib/tpex";

// GET /api/tpex/6488?range=6m
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tpex/[code]">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getTpexStock);
}
