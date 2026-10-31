import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { getRealtimeBatch } from "@/lib/realtime";
import { isStockCode } from "@/lib/types";
import { DEFAULT_WATCHLIST, MAX_WATCHLIST } from "@/lib/watchlist";
import { Watchlist, type WatchlistDoc } from "@/models/Watchlist";

const OWNER = "default";

function errorResponse(err: unknown) {
  return Response.json({ error: err instanceof Error ? err.message : "未知錯誤" }, { status: 500 });
}

// GET /api/watchlist → { codes: string[] }
export async function GET() {
  await connection(); // 每次請求都讀資料庫，不做預先渲染
  try {
    await connectDB();
    // 第一次使用時以預設清單建立
    const doc = await Watchlist.findOneAndUpdate(
      { owner: OWNER },
      { $setOnInsert: { owner: OWNER, codes: DEFAULT_WATCHLIST } },
      { upsert: true, new: true },
    ).lean<WatchlistDoc>();
    return Response.json({ codes: doc?.codes ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/watchlist  body: { codes: string[] } → 整份清單覆寫
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const raw: unknown = body?.codes;
  if (!Array.isArray(raw) || !raw.every((c) => typeof c === "string")) {
    return Response.json({ error: "body 需為 { codes: string[] }" }, { status: 400 });
  }

  const codes = [...new Set(raw.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (codes.length > MAX_WATCHLIST) {
    return Response.json({ error: `自選股最多 ${MAX_WATCHLIST} 檔` }, { status: 400 });
  }
  const malformed = codes.filter((c) => !isStockCode(c));
  if (malformed.length) {
    return Response.json({ error: `股票代碼格式錯誤：${malformed.join("、")}` }, { status: 400 });
  }

  try {
    // 用即時報價確認代碼真的存在，避免存進打錯的代碼
    if (codes.length) {
      const found = new Set((await getRealtimeBatch(codes)).map((q) => q.code));
      const unknown = codes.filter((c) => !found.has(c));
      if (unknown.length) {
        return Response.json({ error: `查無股票：${unknown.join("、")}` }, { status: 400 });
      }
    }

    await connectDB();
    const doc = await Watchlist.findOneAndUpdate(
      { owner: OWNER },
      { codes },
      { upsert: true, new: true },
    ).lean<WatchlistDoc>();
    return Response.json({ codes: doc?.codes ?? codes });
  } catch (err) {
    return errorResponse(err);
  }
}
