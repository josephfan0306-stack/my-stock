import { cacheLife } from "next/cache";
import {
  type Candle,
  type Quote,
  type Range,
  type StockResponse,
  RANGE_MONTHS,
  StockError,
} from "./types";

const OPENAPI_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const STOCK_DAY = "https://www.twse.com.tw/exchangeReport/STOCK_DAY";

type DayAllRow = {
  Date: string;
  Code: string;
  Name: string;
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
};

type StockDayResponse = {
  stat: string;
  title?: string;
  data?: string[][];
};

/** "2,510.00" / "+30.00" / "X0.00" → number */
function num(value: string) {
  const n = Number(value.replace(/[,+X\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 民國日期 "1151030" 或 "115/10/30" → "2026-10-30" */
function rocToIso(value: string) {
  const [y, m, d] = value.includes("/")
    ? value.split("/")
    : [value.slice(0, -4), value.slice(-4, -2), value.slice(-2)];
  return `${Number(y) + 1911}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** 證交所 OpenAPI：全部上市股票最新一日行情 */
async function getDayAll(): Promise<DayAllRow[]> {
  "use cache";
  cacheLife("minutes");

  const res = await fetch(OPENAPI_DAY_ALL);
  if (!res.ok) throw new StockError(`TWSE OpenAPI 回應錯誤 (${res.status})`, 502);
  return res.json();
}

/** 證交所 個股單月日成交資訊（yyyymm 例：202610） */
async function getMonth(code: string, yyyymm: string, isCurrentMonth: boolean) {
  "use cache";
  if (isCurrentMonth) {
    cacheLife("minutes");
  } else {
    cacheLife("days");
  }

  const res = await fetch(`${STOCK_DAY}?response=json&date=${yyyymm}01&stockNo=${code}`);
  if (!res.ok) throw new StockError(`TWSE 歷史資料回應錯誤 (${res.status})`, 502);
  const json: StockDayResponse = await res.json();
  if (json.stat !== "OK" || !json.data) return { name: "", candles: [] as Candle[] };

  const name = json.title?.match(new RegExp(`${code}\\s+(\\S+)`))?.[1] ?? "";
  const candles: Candle[] = json.data
    // 欄位：日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數, 註記
    .filter((row) => num(row[6]) > 0)
    .map((row) => ({
      date: rocToIso(row[0]),
      volume: num(row[1]),
      open: num(row[3]),
      high: num(row[4]),
      low: num(row[5]),
      close: num(row[6]),
    }));
  return { name, candles };
}

function recentMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export async function getTwseStock(code: string, range: Range): Promise<StockResponse> {
  const rows = await getDayAll();
  const row = rows.find((r) => r.Code === code);
  if (!row) throw new StockError(`TWSE 查無上市股票 ${code}（上櫃股票請改用 TPEx）`, 404);

  // 證交所對短時間大量請求會暫時封鎖 IP，因此逐月依序抓取
  const months = recentMonths(RANGE_MONTHS[range]);
  const history: Candle[] = [];
  for (const [i, m] of months.entries()) {
    const { candles } = await getMonth(code, m, i === months.length - 1);
    history.push(...candles);
  }

  const close = num(row.ClosingPrice);
  const change = num(row.Change);
  const prevClose = close - change;
  const quote: Quote = {
    date: rocToIso(row.Date),
    open: num(row.OpeningPrice),
    high: num(row.HighestPrice),
    low: num(row.LowestPrice),
    close,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    volume: num(row.TradeVolume),
    value: num(row.TradeValue),
    transactions: num(row.Transaction),
  };

  return { source: "twse", code, name: row.Name.trim(), quote, history };
}
