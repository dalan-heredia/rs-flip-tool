# FlipFinder - API Contracts (SchemaVersion 1)

All top-level messages include:
- schemaVersion: 1
- ts: unix epoch ms

## WebSocket Envelope
\\\	s
export type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1;
  ts: number;
  type: TType;
  payload: TPayload;
};
\\\

## WalletTelemetryDTO (Bridge -> API)
\\\	s
export type WalletTelemetryDTO = {
  schemaVersion: 1;
  ts: number;
  sessionId: string;
  source: "runelite-bridge";
  coins: number;
  platinumTokens: number;
  cashTotal: number;
};
\\\

## OfferSnapshotDTO (Bridge -> API)
\\\	s
export type OfferType = "BUY" | "SELL" | "UNKNOWN";
export type OfferState =
  | "EMPTY"
  | "BUYING"
  | "BOUGHT"
  | "SELLING"
  | "SOLD"
  | "CANCELLED"
  | "UNKNOWN";

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
\\\

## FlipRecommendationDTO (API -> UI)
\\\	s
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
\\\
