import { cacheLife } from "next/cache";
import {
  type Candle,
  type Range,
  type StockResponse,
  RANGE_MONTHS,
  StockError,
} from "./types";

const FINMIND_API = "https://api.finmindtrade.com/api/v4/data";

type FinMindResponse<T> = {
  msg: string;
  status: number;
  data: T[];
};

type PriceRow = {
  date: string;
  stock_id: string;
  Trading_Volume: number;
  Trading_money: number;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number;
  Trading_turnover: number;
};

type InfoRow = {
  stock_id: string;
  stock_name: string;
  type: string;
};

export async function query<T>(params: Record<string, string>): Promise<T[]> {
  const search = new URLSearchParams(params);
  // token 為選填：不帶每小時 300 次，帶上 600 次
  if (process.env.FINMIND_TOKEN) search.set("token", process.env.FINMIND_TOKEN);

  const res = await fetch(`${FINMIND_API}?${search}`);
  const json: FinMindResponse<T> = await res.json().catch(() => null);
  if (!res.ok || !json || json.status !== 200) {
    throw new StockError(`FinMind 回應錯誤：${json?.msg ?? res.status}`, 502);
  }
  return json.data;
}

async function getStockName(code: string) {
  "use cache";
  cacheLife("days");

  const rows = await query<InfoRow>({ dataset: "TaiwanStockInfo", data_id: code });
  return rows[0]?.stock_name ?? "";
}

async function getPrices(code: string, startDate: string) {
  "use cache";
  cacheLife("minutes");

  return query<PriceRow>({ dataset: "TaiwanStockPrice", data_id: code, start_date: startDate });
}

export async function getFinMindStock(code: string, range: Range): Promise<StockResponse> {
  const start = new Date();
  start.setMonth(start.getMonth() - RANGE_MONTHS[range]);
  const startDate = start.toISOString().slice(0, 10);

  const [name, rows] = await Promise.all([getStockName(code), getPrices(code, startDate)]);
  const trades = rows.filter((r) => r.close > 0);
  const last = trades.at(-1);
  if (!last) throw new StockError(`FinMind 查無股票 ${code}`, 404);

  const history: Candle[] = trades.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.max,
    low: r.min,
    close: r.close,
    volume: r.Trading_Volume,
  }));

  const prevClose = last.close - last.spread;
  return {
    source: "finmind",
    code,
    name,
    quote: {
      date: last.date,
      open: last.open,
      high: last.max,
      low: last.min,
      close: last.close,
      change: last.spread,
      changePercent: prevClose ? (last.spread / prevClose) * 100 : 0,
      volume: last.Trading_Volume,
      value: last.Trading_money,
      transactions: last.Trading_turnover,
    },
    history,
  };
}
