import { marketStore } from '../market/store';

export type FlipRec = {
  itemId: number;
  itemName: string;
  geLimit4h: number | null;

  buyPrice: number;
  sellPrice: number;
  quantity: number;

  taxPerUnit: number;
  netSellPerUnit: number;
  profitPerUnit: number;
  totalProfit: number;

  estBuyMin: number;
  estSellMin: number;

  thinVol5m: number;
  thinVol1h: number;

  breakoutScore: number; // 0..100
  score: number;

  eligible: boolean;
  notes: string[];
};

export type FlipEngineParams = {
  cash: number;
  allocPct: number;
  maxPerItemExposure: number;

  // “Strict” requirements
  minLegMin: number; // 5
  maxLegMin: number; // 45
  taxRate: number; // 0.02
  taxCap: number; // 5_000_000

  // Safety filters (for ELIGIBLE)
  minThinVol5m: number;
  minThinVol1h: number;
  maxSpreadPct: number;

  // Absolute floor to avoid garbage even in “near miss” list
  absMinThin5m: number;
  absMinThin1h: number;

  topN: number;

    // Spread override rules (allow wide spread if volume confirms)
    maxSpreadPctHard: number;           // absolute cap even with confirmation
    spreadWideMinThinVol5m: number;     // stronger liquidity required
    spreadWideMinThinVol1h: number;
    spreadWideMinVolumeSpike: number;   // (thin5m*12)/thin1h

};

export const DEFAULT_PARAMS: FlipEngineParams = {
  cash: 5_000_000,
  allocPct: 0.2,
  maxPerItemExposure: 0.25,

  minLegMin: 5,
  maxLegMin: 45,
  taxRate: 0.02,
  taxCap: 5_000_000,

  minThinVol5m: 200,
  minThinVol1h: 3000,
  maxSpreadPct: 0.06,

  absMinThin5m: 20,
  absMinThin1h: 200,

  topN: 25,

    maxSpreadPctHard: 0.12,         // never allow >12% for short flips
    spreadWideMinThinVol5m: 800,    // require much stronger 5m liquidity
    spreadWideMinThinVol1h: 12000,  // and strong 1h liquidity
    spreadWideMinVolumeSpike: 1.05, // 5m*12 at least ~1.05x 1h pace


};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function geTaxPerUnit(sellPrice: number, rate: number, cap: number) {
  return Math.min(Math.floor(sellPrice * rate), cap);
}

function thinVolume(volA: number | null, volB: number | null) {
  const a = volA ?? 0;
  const b = volB ?? 0;
  return Math.min(a, b);
}

function estFillMinutes(qty: number, thinVol5m: number) {
  const per5 = Math.max(1, thinVol5m);
  return (qty / per5) * 5;
}

function breakoutScore(
  avgHigh5m: number | null,
  avgHigh1h: number | null,
  thin5m: number,
  thin1h: number,
) {
  const h5 = avgHigh5m ?? 0;
  const h1 = avgHigh1h ?? 0;
  if (h5 <= 0 || h1 <= 0) return 0;

  const momentumPct = (h5 - h1) / h1;
  const volumeSpike = (thin5m * 12) / Math.max(1, thin1h);

  const score = momentumPct * 200 + Math.log(volumeSpike + 1) * 15;
  return clamp(score, 0, 100);
}

function chooseQuantityForTimeWindow(args: {
  thin5m: number;
  buyPrice: number;
  cash: number;
  allocPct: number;
  maxExposurePct: number;
  geLimit4h: number | null;
  minLegMin: number;
  maxLegMin: number;
}) {
  const {
    thin5m,
    buyPrice,
    cash,
    allocPct,
    maxExposurePct,
    geLimit4h,
    minLegMin,
    maxLegMin,
  } = args;

  const budget = Math.floor(cash * allocPct);
  const exposureCap = Math.floor(cash * maxExposurePct);

  const maxAffordable = Math.floor(Math.min(budget, exposureCap) / buyPrice);
  const limitCap = geLimit4h ?? 1_000_000_000;
  const maxQty = Math.max(0, Math.min(maxAffordable, limitCap));

  // To hit fill time window:
  // minutes = qty/thin5m*5 => qty = thin5m*minutes/5
  const qtyMin = Math.ceil((thin5m * minLegMin) / 5); // for 5 min => ~thin5m
  const qtyMax = Math.floor((thin5m * maxLegMin) / 5); // for 45 min => ~9*thin5m

  // Prefer ~15 min per leg (tunable later)
  const qtyTarget = Math.round((thin5m * 15) / 5);

  if (maxQty <= 0) return { qty: 0, canHitWindow: false, qtyMin, qtyMax, maxQty };

  // If we cannot even afford qtyMin, we’ll return maxQty (near-miss)
  if (maxQty < qtyMin) return { qty: maxQty, canHitWindow: false, qtyMin, qtyMax, maxQty };

  const upper = Math.min(qtyMax, maxQty);
  const qty = clamp(qtyTarget, qtyMin, upper);
  return { qty, canHitWindow: true, qtyMin, qtyMax, maxQty };
}

export function computeFlipRecs(paramsPartial: Partial<FlipEngineParams> = {}) {
  const p: FlipEngineParams = { ...DEFAULT_PARAMS, ...paramsPartial };

  const mapping = marketStore.mapping?.data;
  const latest = marketStore.latest?.data;
  const fiveMin = marketStore.fiveMin?.data;
  const oneHour = marketStore.oneHour?.data;

  if (!mapping || !latest || !fiveMin || !oneHour) {
    return { params: p, recommendations: [] as FlipRec[] };
  }

  const recs: FlipRec[] = [];

  for (const [itemId, e5] of fiveMin.entries()) {
    const m = mapping.get(itemId);
    const lat = latest.get(itemId);
    const e1 = oneHour.get(itemId);
    if (!m || !lat || !e1) continue;

    const buyVol5m = e5.lowPriceVolume ?? 0;   // sell-side flow => helps buy fill
    const sellVol5m = e5.highPriceVolume ?? 0; // buy-side flow => helps sell fill

    const thin5 = thinVolume(e5.highPriceVolume, e5.lowPriceVolume);
    const thin1 = thinVolume(e1.highPriceVolume, e1.lowPriceVolume);

    // Absolute floor: don’t even consider extreme garbage
    if (thin5 < p.absMinThin5m || thin1 < p.absMinThin1h) continue;

    const buyBase = (e5.avgLowPrice ?? lat.low) ?? 0;
    const sellBase = (e5.avgHighPrice ?? lat.high) ?? 0;
    if (buyBase <= 0 || sellBase <= 0) continue;

    const buyPrice = Math.floor(buyBase + 1);
    const sellPrice = Math.floor(sellBase - 1);
    if (sellPrice <= buyPrice) continue;

    const spreadPct = (sellPrice - buyPrice) / buyPrice;

    const taxPerUnit = geTaxPerUnit(sellPrice, p.taxRate, p.taxCap);
    const netSellPerUnit = sellPrice - taxPerUnit;
    const profitPerUnit = netSellPerUnit - buyPrice;

    if (profitPerUnit <= 0) continue;

    const qtyPick = chooseQuantityForTimeWindow({
      thin5m: thin5,
      buyPrice,
      cash: p.cash,
      allocPct: p.allocPct,
      maxExposurePct: p.maxPerItemExposure,
      geLimit4h: m.limit ?? null,
      minLegMin: p.minLegMin,
      maxLegMin: p.maxLegMin,
    });

    const quantity = qtyPick.qty;
    if (quantity <= 0) continue;

    const estBuyMin = estFillMinutes(quantity, thin5);
    const estSellMin = estFillMinutes(quantity, thin5);

    const notes: string[] = [];

    const liquidityOk = thin5 >= p.minThinVol5m && thin1 >= p.minThinVol1h;
    if (!liquidityOk) notes.push(`low liquidity (thin5=${thin5}, thin1=${thin1})`);

    const spreadWide = spreadPct > p.maxSpreadPct;

    const volumeSpike = (thin5 * 12) / Math.max(1, thin1);
    const spreadConfirmed =
    thin5 >= p.spreadWideMinThinVol5m &&
    thin1 >= p.spreadWideMinThinVol1h &&
    volumeSpike >= p.spreadWideMinVolumeSpike;

    let spreadOk = !spreadWide;

    if (spreadWide) {
    // only allow wide spread when confirmed AND not insane
    spreadOk = spreadConfirmed && spreadPct <= p.maxSpreadPctHard;

    if (spreadOk) {
        notes.push(`wide spread but volume-confirmed (spike=${volumeSpike.toFixed(2)}x)`);
    } else {
        notes.push(`spread wide (${(spreadPct * 100).toFixed(1)}%)`);
        if (!spreadConfirmed) notes.push(`no volume confirmation (spike=${volumeSpike.toFixed(2)}x)`);
    }
    }


    const timeOk =
      estBuyMin >= p.minLegMin &&
      estBuyMin <= p.maxLegMin &&
      estSellMin >= p.minLegMin &&
      estSellMin <= p.maxLegMin;

    if (!timeOk) {
      notes.push(`time window miss (buy=${estBuyMin.toFixed(1)}m, sell=${estSellMin.toFixed(1)}m)`);
    }
    if (!qtyPick.canHitWindow) {
      notes.push(`budget too small to size qty for ≥${p.minLegMin}m fills`);
    }

    const bScore = breakoutScore(e5.avgHighPrice, e1.avgHighPrice, thin5, thin1);
    const totalProfit = profitPerUnit * quantity;
    const profitPerMin = totalProfit / Math.max(1, estBuyMin + estSellMin);

    // Eligible = all strict constraints met
    const eligible = liquidityOk && spreadOk && timeOk;

    // Scoring: eligible first; near-misses get heavy penalties but still appear
    let score = profitPerMin + bScore * 2;

    if (!liquidityOk) score -= 500;
    if (!spreadOk) score -= 250;
    if (!timeOk) score -= 250;
    if (!eligible) score -= 250;

    recs.push({
      itemId,
      itemName: m.name,
      geLimit4h: m.limit ?? null,
      buyPrice,
      sellPrice,
      quantity,
      taxPerUnit,
      netSellPerUnit,
      profitPerUnit,
      totalProfit,
      estBuyMin,
      estSellMin,
      thinVol5m: thin5,
      thinVol1h: thin1,
      breakoutScore: bScore,
      score,
      eligible,
      notes,
    });
  }

  recs.sort((a, b) => b.score - a.score);
  return { params: p, recommendations: recs.slice(0, p.topN) };
}
