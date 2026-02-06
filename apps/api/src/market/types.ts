export type WikiEnvelope<T> = {
  data: T;
};

export type WikiLatestEntry = {
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
};

export type Wiki5mEntry = {
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number | null;
  lowPriceVolume: number | null;
};

export type Wiki1hEntry = Wiki5mEntry;

export type WikiMappingItem = {
  id: number;
  name: string;
  members: boolean;
  limit: number | null; // GE buy limit (4h) - may be null for some items
  lowalch?: number;
  highalch?: number;
  value?: number;
  icon?: string;
};
