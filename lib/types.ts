export type Source = "twse" | "tpex" | "finmind";

export type Range = "1m" | "3m" | "6m" | "1y";

export const RANGE_MONTHS: Record<Range, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

export type Candle = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 股
};

export type Quote = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number; // 股
  value: number; // 成交金額（元）
  transactions: number; // 成交筆數
};

export type StockResponse = {
  source: Source;
  code: string;
  name: string;
  quote: Quote;
  history: Candle[];
};

export class StockError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function isRange(value: string | null): value is Range {
  return value !== null && value in RANGE_MONTHS;
}

export function isStockCode(code: string) {
  return /^[0-9A-Z]{4,6}$/.test(code);
}
