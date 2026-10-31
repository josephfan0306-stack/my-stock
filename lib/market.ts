/** 台北時間的星期與時分（不受使用者電腦時區影響） */
export function taipeiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

/** 台股一般交易時段：週一至週五 09:00–13:30（未考慮國定假日） */
export function isMarketOpen(date: Date) {
  const { weekday, hour, minute } = taipeiParts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 && minutes <= 13 * 60 + 30;
}
