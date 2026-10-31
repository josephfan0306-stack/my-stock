import { cacheLife } from "next/cache";
import { query } from "./finmind";
import { type Range, RANGE_MONTHS, StockError } from "./types";

// ---- FinMind 原始資料 ----

type InstitutionalRow = {
  date: string;
  name: string;
  buy: number; // 股
  sell: number; // 股
};

type MarginRow = {
  date: string;
  MarginPurchaseTodayBalance: number; // 張
  MarginPurchaseYesterdayBalance: number;
  ShortSaleTodayBalance: number; // 張
  ShortSaleYesterdayBalance: number;
};

type ShareholdingRow = {
  date: string;
  ForeignInvestmentSharesRatio: number; // %
};

type DayTradingRow = {
  date: string;
  Volume: number; // 股
};

// ---- 回傳給前端的格式（單位統一為張） ----

export type InstitutionalDay = {
  date: string;
  foreign: number; // 外資買賣超
  trust: number; // 投信買賣超
  dealer: number; // 自營商買賣超
  total: number;
};

export type MarginDay = {
  date: string;
  marginBalance: number; // 融資餘額
  marginChange: number;
  shortBalance: number; // 融券餘額
  shortChange: number;
};

export type ChipsResponse = {
  code: string;
  institutional: InstitutionalDay[];
  margin: MarginDay[];
  foreignHolding: { date: string; ratio: number }[]; // 外資持股比例 %
  dayTrading: { date: string; volume: number }[]; // 當沖成交量
};

const lots = (shares: number) => Math.round(shares / 1000);

// FinMind 的法人名稱 → 外資 / 投信 / 自營商
const INSTITUTION_GROUP: Record<string, keyof Omit<InstitutionalDay, "date" | "total">> = {
  Foreign_Investor: "foreign",
  Foreign_Dealer_Self: "foreign",
  Investment_Trust: "trust",
  Dealer_self: "dealer",
  Dealer_Hedging: "dealer",
};

async function getDataset<T>(dataset: string, code: string, startDate: string) {
  "use cache";
  cacheLife("hours");

  return query<T>({ dataset, data_id: code, start_date: startDate });
}

export async function getFinMindChips(code: string, range: Range): Promise<ChipsResponse> {
  const start = new Date();
  start.setMonth(start.getMonth() - RANGE_MONTHS[range]);
  const startDate = start.toISOString().slice(0, 10);

  const [institutionalRows, marginRows, shareholdingRows, dayTradingRows] = await Promise.all([
    getDataset<InstitutionalRow>("TaiwanStockInstitutionalInvestorsBuySell", code, startDate),
    getDataset<MarginRow>("TaiwanStockMarginPurchaseShortSale", code, startDate),
    getDataset<ShareholdingRow>("TaiwanStockShareholding", code, startDate),
    getDataset<DayTradingRow>("TaiwanStockDayTrading", code, startDate),
  ]);

  if (!institutionalRows.length && !marginRows.length && !shareholdingRows.length) {
    throw new StockError(`FinMind 查無 ${code} 的籌碼資料`, 404);
  }

  const byDate = new Map<string, InstitutionalDay>();
  for (const row of institutionalRows) {
    const group = INSTITUTION_GROUP[row.name];
    if (!group) continue;
    const day = byDate.get(row.date) ?? { date: row.date, foreign: 0, trust: 0, dealer: 0, total: 0 };
    day[group] += row.buy - row.sell;
    byDate.set(row.date, day);
  }
  const institutional = [...byDate.values()].map((d) => ({
    date: d.date,
    foreign: lots(d.foreign),
    trust: lots(d.trust),
    dealer: lots(d.dealer),
    total: lots(d.foreign + d.trust + d.dealer),
  }));

  return {
    code,
    institutional,
    margin: marginRows.map((r) => ({
      date: r.date,
      marginBalance: r.MarginPurchaseTodayBalance,
      marginChange: r.MarginPurchaseTodayBalance - r.MarginPurchaseYesterdayBalance,
      shortBalance: r.ShortSaleTodayBalance,
      shortChange: r.ShortSaleTodayBalance - r.ShortSaleYesterdayBalance,
    })),
    foreignHolding: shareholdingRows.map((r) => ({ date: r.date, ratio: r.ForeignInvestmentSharesRatio })),
    dayTrading: dayTradingRows.map((r) => ({ date: r.date, volume: lots(r.Volume) })),
  };
}
