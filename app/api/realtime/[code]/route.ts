import type { NextRequest } from "next/server";
import { getRealtime } from "@/lib/realtime";
import { handleStockRequest } from "@/lib/route-helper";

// GET /api/realtime/2330（上市、上櫃皆可）
export async function GET(request: NextRequest, ctx: RouteContext<"/api/realtime/[code]">) {
  const { code } = await ctx.params;
  return handleStockRequest(request, code, getRealtime);
}
