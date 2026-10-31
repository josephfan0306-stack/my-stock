import { cacheLife } from "next/cache";
import {
  type Candle,
  type Quote,
  type Range,
  type StockResponse,
  RANGE_MONTHS,
  StockError,
} from "./types";

const OPENAPI_DAILY_CLOSE = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const TRADING_STOCK = "https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock";

type DailyCloseRow = {
  Date: string;
  SecuritiesCompanyCode: string;
  CompanyName: string;
  Close: string;
  Change: string;
  Open: string;
  High: string;
  Low: string;
  TradingShares: string;
  TransactionAmount: string;
  TransactionNumber: string;
};

type TradingStockResponse = {
  tables?: { data: string[][] }[];
};

/** "1,085.00" / "-58.00 " / "---" → number */
function num(value: string) {
  const n = Number(value.replace(/[,+\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 民國日期 "1151030" 或 "115/10/30" → "2026-10-30" */
function rocToIso(value: string) {
  const [y, m, d] = value.includes("/")
    ? value.split("/")
    : [value.slice(0, -4), value.slice(-4, -2), value.slice(-2)];
  return `${Number(y) + 1911}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** 櫃買中心 OpenAPI：全部上櫃股票最新一日收盤行情 */
async function getDailyClose(): Promise<DailyCloseRow[]> {
  "use cache";
  cacheLife("minutes");

  const res = await fetch(OPENAPI_DAILY_CLOSE);
  if (!res.ok) throw new StockError(`TPEx OpenAPI 回應錯誤 (${res.status})`, 502);
  return res.json();
}

/** 櫃買中心 個股單月日成交資訊（yyyymm 例：202610） */
async function getMonth(code: string, yyyymm: string, isCurrentMonth: boolean) {
  "use cache";
  if (isCurrentMonth) {
    cacheLife("minutes");
  } else {
    cacheLife("days");
  }

  const date = `${yyyymm.slice(0, 4)}/${yyyymm.slice(4)}/01`;
  const res = await fetch(`${TRADING_STOCK}?code=${code}&date=${encodeURIComponent(date)}&response=json`);
  if (!res.ok) throw new StockError(`TPEx 歷史資料回應錯誤 (${res.status})`, 502);
  const json: TradingStockResponse = await res.json();

  return (json.tables?.[0]?.data ?? [])
    // 欄位：日期, 成交張數, 成交仟元, 開盤, 最高, 最低, 收盤, 漲跌, 筆數
    .filter((row) => num(row[6]) > 0)
    .map(
      (row): Candle => ({
        date: rocToIso(row[0]),
        volume: num(row[1]) * 1000, // 張 → 股，與其他來源一致
        open: num(row[3]),
        high: num(row[4]),
        low: num(row[5]),
        close: num(row[6]),
      }),
    );
}

function recentMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export async function getTpexStock(code: string, range: Range): Promise<StockResponse> {
  const rows = await getDailyClose();
  const row = rows.find((r) => r.SecuritiesCompanyCode === code);
  if (!row) throw new StockError(`TPEx 查無上櫃股票 ${code}（上市股票請改用 TWSE）`, 404);

  // 逐月依序抓取，避免短時間大量請求
  const months = recentMonths(RANGE_MONTHS[range]);
  const history: Candle[] = [];
  for (const [i, m] of months.entries()) {
    history.push(...(await getMonth(code, m, i === months.length - 1)));
  }

  const close = num(row.Close);
  const change = num(row.Change);
  const prevClose = close - change;
  const quote: Quote = {
    date: rocToIso(row.Date),
    open: num(row.Open),
    high: num(row.High),
    low: num(row.Low),
    close,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    volume: num(row.TradingShares),
    value: num(row.TransactionAmount),
    transactions: num(row.TransactionNumber),
  };

  return { source: "tpex", code, name: row.CompanyName.trim(), quote, history };
}
