export type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1;
  ts: number;
  type: TType;
  payload: TPayload;
};

export type WalletTelemetryDTO = {
  schemaVersion: 1;
  ts: number;
  sessionId: string;
  source: 'runelite-bridge';
  coins: number;
  platinumTokens: number;
  cashTotal: number;
};

export type OfferType = 'BUY' | 'SELL' | 'UNKNOWN';

export type OfferState =
  | 'EMPTY'
  | 'BUYING'
  | 'BOUGHT'
  | 'SELLING'
  | 'SOLD'
  | 'CANCELLED'
  | 'UNKNOWN';

export type OfferSnapshotDTO = {
  slot: number;
  itemId: number;
  type: OfferType;
  state: OfferState;
  price: number;
  totalQuantity: number;
  filledQuantity: number;
  lastChangeTs?: number;
};

export type FlipRecommendationDTO = {
  itemId: number;
  itemName?: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;

  taxPerUnit: number;
  netSellPerUnit: number;
  profitPerUnit: number;
  totalProfit: number;

  estBuyMin: number;
  estSellMin: number;

  breakoutScore: number;
  score: number;

  buyLimit4h?: number;
  limitRemaining?: number;
};
