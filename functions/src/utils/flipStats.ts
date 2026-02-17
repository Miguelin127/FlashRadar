// flashradar/utils/flipStats.ts

export type FlipRecord = {
  id?: string;
  priceSold: number;     // current price * quantity
  pricePaid: number;     // paid per unit * quantity
  quantity: number;
  createdAt: Date | { seconds: number };
};

type ProfitSummary = {
  revenue: number;
  cost: number;
  netProfit: number;
  profitPercent: number;
};

const normalizeDate = (date: FlipRecord["createdAt"]): Date => {
  if (date instanceof Date) return date;
  return new Date(date.seconds * 1000);
};

const calculateTotals = (flips: FlipRecord[]): ProfitSummary => {
  const revenue = flips.reduce((sum, f) => sum + f.priceSold, 0);
  const cost = flips.reduce((sum, f) => sum + f.pricePaid, 0);
  const netProfit = revenue - cost;
  const profitPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    cost,
    netProfit,
    profitPercent,
  };
};

export const getLifetimeStats = (flips: FlipRecord[]): ProfitSummary => {
  return calculateTotals(flips);
};

export const getMonthlyStats = (flips: FlipRecord[], month: number, year: number): ProfitSummary => {
  const filtered = flips.filter(f => {
    const d = normalizeDate(f.createdAt);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return calculateTotals(filtered);
};

export const getQuarterlyStats = (flips: FlipRecord[], quarter: 1 | 2 | 3 | 4, year: number): ProfitSummary => {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const filtered = flips.filter(f => {
    const d = normalizeDate(f.createdAt);
    return (
      d.getFullYear() === year &&
      d.getMonth() >= startMonth &&
      d.getMonth() <= endMonth
    );
  });

  return calculateTotals(filtered);
};

export const getYearlyStats = (flips: FlipRecord[], year: number): ProfitSummary => {
  const filtered = flips.filter(f => {
    const d = normalizeDate(f.createdAt);
    return d.getFullYear() === year;
  });

  return calculateTotals(filtered);
};
