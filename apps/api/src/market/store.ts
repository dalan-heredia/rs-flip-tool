import type { WikiLatestEntry, Wiki5mEntry, Wiki1hEntry, WikiMappingItem } from './types';

type Stamp<T> = {
  ts: number;
  data: T;
  err?: string;
};

export type MarketStatus = {
  ok: boolean;
  now: number;
  mappingTs?: number;
  latestTs?: number;
  fiveMinTs?: number;
  oneHourTs?: number;
  counts: {
    mapping?: number;
    latest?: number;
    fiveMin?: number;
    oneHour?: number;
  };
  lastErrors: {
    mapping?: string;
    latest?: string;
    fiveMin?: string;
    oneHour?: string;
  };
};

class MarketStore {
  mapping: Stamp<Map<number, WikiMappingItem>> | null = null;
  latest: Stamp<Map<number, WikiLatestEntry>> | null = null;
  fiveMin: Stamp<Map<number, Wiki5mEntry>> | null = null;
  oneHour: Stamp<Map<number, Wiki1hEntry>> | null = null;

  status(): MarketStatus {
    const now = Date.now();
    const lastErrors = {
      mapping: this.mapping?.err,
      latest: this.latest?.err,
      fiveMin: this.fiveMin?.err,
      oneHour: this.oneHour?.err,
    };

    const ok = Boolean(this.mapping && this.latest && this.fiveMin && this.oneHour) &&
      !lastErrors.mapping && !lastErrors.latest && !lastErrors.fiveMin && !lastErrors.oneHour;

    return {
      ok,
      now,
      mappingTs: this.mapping?.ts,
      latestTs: this.latest?.ts,
      fiveMinTs: this.fiveMin?.ts,
      oneHourTs: this.oneHour?.ts,
      counts: {
        mapping: this.mapping?.data.size,
        latest: this.latest?.data.size,
        fiveMin: this.fiveMin?.data.size,
        oneHour: this.oneHour?.data.size,
      },
      lastErrors,
    };
  }

  getItem(id: number) {
    const m = this.mapping?.data.get(id);
    const latest = this.latest?.data.get(id);
    const fiveMin = this.fiveMin?.data.get(id);
    const oneHour = this.oneHour?.data.get(id);

    return {
      id,
      name: m?.name ?? null,
      members: m?.members ?? null,
      geLimit: m?.limit ?? null,
      latest: latest ?? null,
      fiveMin: fiveMin ?? null,
      oneHour: oneHour ?? null,
    };
  }
}

export const marketStore = new MarketStore();
