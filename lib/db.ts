import mongoose from "mongoose";

// 開發模式熱更新會重新載入模組，把連線存在 globalThis 避免重複連線
const globalForMongoose = globalThis as unknown as { mongooseConn?: Promise<typeof mongoose> };

export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("缺少環境變數 MONGODB_URI");

  globalForMongoose.mongooseConn ??= mongoose.connect(uri).catch((err) => {
    // 連線失敗時清掉快取，下次請求再重試
    globalForMongoose.mongooseConn = undefined;
    throw err;
  });
  return globalForMongoose.mongooseConn;
}
