import { type InferSchemaType, Schema, model, models } from "mongoose";

const watchlistSchema = new Schema(
  {
    // 目前沒有登入機制，固定使用 "default" 這份清單
    owner: { type: String, required: true, unique: true, default: "default" },
    codes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type WatchlistDoc = InferSchemaType<typeof watchlistSchema>;

// 熱更新時避免重複註冊 model
export const Watchlist = models.Watchlist ?? model("Watchlist", watchlistSchema);
