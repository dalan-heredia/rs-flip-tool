export type HeartbeatTelemetry = {
  accountHash: string;
  ts: number;
  pluginVersion?: string;
  clientRevision?: number;
  world?: number;
};

export type WalletTelemetry = {
  accountHash: string;
  ts: number;
  coins?: number;
  platinumTokens?: number;
  cashTotal: number;
};

export type OfferTelemetry = {
  accountHash: string;
  ts: number;
  slot: number;
  itemId: number;
  itemName?: string;
  side?: string;
  status?: string;
  price?: number;
  qtyTotal?: number;
  qtyFilled?: number;
};

export type SessionTelemetry = {
  accountHash: string;
  lastSeenTs: number;
  heartbeat?: HeartbeatTelemetry;
  wallet?: WalletTelemetry;
  offers?: OfferTelemetry[];
};
