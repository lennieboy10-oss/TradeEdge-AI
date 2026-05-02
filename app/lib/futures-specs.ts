export interface FuturesSpec {
  name: string;
  exchange: string;
  tickSize: number;
  tickValue: number;
  pointValue: number;
  currency: string;
  margin: number;
  tradingHours: string;
  bestSession: string;
  microSymbol?: string;
}

export const FUTURES_SPECS: Record<string, FuturesSpec> = {
  // Equity Index Futures
  ES: {
    name: "E-mini S&P 500",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 12.50,
    pointValue: 50,
    currency: "USD",
    margin: 12000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
    microSymbol: "MES",
  },
  NQ: {
    name: "E-mini Nasdaq 100",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 5.00,
    pointValue: 20,
    currency: "USD",
    margin: 17000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
    microSymbol: "MNQ",
  },
  MES: {
    name: "Micro E-mini S&P 500",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
    currency: "USD",
    margin: 1200,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
  },
  MNQ: {
    name: "Micro E-mini Nasdaq",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 0.50,
    pointValue: 2,
    currency: "USD",
    margin: 1700,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
  },
  RTY: {
    name: "E-mini Russell 2000",
    exchange: "CME",
    tickSize: 0.10,
    tickValue: 5.00,
    pointValue: 50,
    currency: "USD",
    margin: 7000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
  },
  YM: {
    name: "E-mini Dow Jones",
    exchange: "CBOT",
    tickSize: 1,
    tickValue: 5.00,
    pointValue: 5,
    currency: "USD",
    margin: 8000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Open 09:30 EST",
  },
  // Metals
  GC: {
    name: "Gold Futures",
    exchange: "COMEX",
    tickSize: 0.10,
    tickValue: 10,
    pointValue: 100,
    currency: "USD",
    margin: 8000,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
    microSymbol: "MGC",
  },
  MGC: {
    name: "Micro Gold Futures",
    exchange: "COMEX",
    tickSize: 0.10,
    tickValue: 1,
    pointValue: 10,
    currency: "USD",
    margin: 800,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  SI: {
    name: "Silver Futures",
    exchange: "COMEX",
    tickSize: 0.005,
    tickValue: 25,
    pointValue: 5000,
    currency: "USD",
    margin: 9000,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  HG: {
    name: "Copper Futures",
    exchange: "COMEX",
    tickSize: 0.0005,
    tickValue: 12.50,
    pointValue: 25000,
    currency: "USD",
    margin: 4000,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  // Energy
  CL: {
    name: "Crude Oil Futures",
    exchange: "NYMEX",
    tickSize: 0.01,
    tickValue: 10,
    pointValue: 1000,
    currency: "USD",
    margin: 6000,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
    microSymbol: "MCL",
  },
  MCL: {
    name: "Micro Crude Oil",
    exchange: "NYMEX",
    tickSize: 0.01,
    tickValue: 1,
    pointValue: 100,
    currency: "USD",
    margin: 600,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  NG: {
    name: "Natural Gas Futures",
    exchange: "NYMEX",
    tickSize: 0.001,
    tickValue: 10,
    pointValue: 10000,
    currency: "USD",
    margin: 4000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Hours",
  },
  RB: {
    name: "RBOB Gasoline",
    exchange: "NYMEX",
    tickSize: 0.0001,
    tickValue: 4.20,
    pointValue: 42000,
    currency: "USD",
    margin: 5000,
    tradingHours: "Almost 24/5",
    bestSession: "NY Hours",
  },
  // Fixed Income
  ZB: {
    name: "30-Year T-Bond",
    exchange: "CBOT",
    tickSize: 0.03125,
    tickValue: 31.25,
    pointValue: 1000,
    currency: "USD",
    margin: 3500,
    tradingHours: "Almost 24/5",
    bestSession: "NY Hours",
  },
  ZN: {
    name: "10-Year T-Note",
    exchange: "CBOT",
    tickSize: 0.015625,
    tickValue: 15.625,
    pointValue: 1000,
    currency: "USD",
    margin: 1800,
    tradingHours: "Almost 24/5",
    bestSession: "NY Hours",
  },
  ZF: {
    name: "5-Year T-Note",
    exchange: "CBOT",
    tickSize: 0.0078125,
    tickValue: 7.8125,
    pointValue: 1000,
    currency: "USD",
    margin: 1200,
    tradingHours: "Almost 24/5",
    bestSession: "NY Hours",
  },
  // Agriculture
  ZC: {
    name: "Corn Futures",
    exchange: "CBOT",
    tickSize: 0.25,
    tickValue: 12.50,
    pointValue: 50,
    currency: "USD",
    margin: 1500,
    tradingHours: "Limited hours",
    bestSession: "Chicago Hours",
  },
  ZW: {
    name: "Wheat Futures",
    exchange: "CBOT",
    tickSize: 0.25,
    tickValue: 12.50,
    pointValue: 50,
    currency: "USD",
    margin: 2000,
    tradingHours: "Limited hours",
    bestSession: "Chicago Hours",
  },
  ZS: {
    name: "Soybean Futures",
    exchange: "CBOT",
    tickSize: 0.25,
    tickValue: 12.50,
    pointValue: 50,
    currency: "USD",
    margin: 2000,
    tradingHours: "Limited hours",
    bestSession: "Chicago Hours",
  },
  // Currency Futures
  "6E": {
    name: "Euro FX Futures",
    exchange: "CME",
    tickSize: 0.0001,
    tickValue: 12.50,
    pointValue: 125000,
    currency: "USD",
    margin: 2500,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  "6B": {
    name: "British Pound Futures",
    exchange: "CME",
    tickSize: 0.0001,
    tickValue: 6.25,
    pointValue: 62500,
    currency: "USD",
    margin: 2500,
    tradingHours: "Almost 24/5",
    bestSession: "London and NY",
  },
  "6J": {
    name: "Japanese Yen Futures",
    exchange: "CME",
    tickSize: 0.0000005,
    tickValue: 6.25,
    pointValue: 12500000,
    currency: "USD",
    margin: 2500,
    tradingHours: "Almost 24/5",
    bestSession: "Asian and NY",
  },
};

export function detectFutures(asset: string): FuturesSpec | null {
  const symbol = asset
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/1!$/, "")
    .replace(/!$/, "")
    .replace(/\d+$/, "");
  return FUTURES_SPECS[symbol] ?? null;
}

export function getFuturesSymbol(asset: string): string {
  return asset
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/1!$/, "")
    .replace(/!$/, "")
    .replace(/\d+$/, "");
}
