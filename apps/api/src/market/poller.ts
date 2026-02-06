import { fetch1h, fetch5m, fetchLatest, fetchMapping } from './wikiClient';
import { marketStore } from './store';
import type { FastifyBaseLogger } from 'fastify';

function mapRecordToMap<T>(rec: Record<string, T>): Map<number, T> {
  const m = new Map<number, T>();
  for (const [k, v] of Object.entries(rec)) {
    const id = Number(k);
    if (Number.isFinite(id)) m.set(id, v);
  }
  return m;
}

export function startMarketPoller(log: FastifyBaseLogger) {
  const pollLatestMs = 30_000;
  const poll5mMs = 60_000;
  const poll1hMs = 120_000;
  const pollMappingMs = 12 * 60 * 60_000;

  const runMapping = async () => {
    try {
      const arr = await fetchMapping();
      const map = new Map(arr.map((it) => [it.id, it]));
      marketStore.mapping = { ts: Date.now(), data: map };
      log.info({ count: map.size }, 'market: mapping updated');
    } catch (e: any) {
      marketStore.mapping = marketStore.mapping
        ? { ...marketStore.mapping, err: e?.message ?? String(e), ts: Date.now() }
        : { ts: Date.now(), data: new Map(), err: e?.message ?? String(e) };
      log.warn({ err: marketStore.mapping.err }, 'market: mapping fetch failed');
    }
  };

  const runLatest = async () => {
    try {
      const env = await fetchLatest();
      marketStore.latest = { ts: Date.now(), data: mapRecordToMap(env.data) };
      log.info({ count: marketStore.latest.data.size }, 'market: latest updated');
    } catch (e: any) {
      marketStore.latest = marketStore.latest
        ? { ...marketStore.latest, err: e?.message ?? String(e), ts: Date.now() }
        : { ts: Date.now(), data: new Map(), err: e?.message ?? String(e) };
      log.warn({ err: marketStore.latest.err }, 'market: latest fetch failed');
    }
  };

  const run5m = async () => {
    try {
      const env = await fetch5m();
      marketStore.fiveMin = { ts: Date.now(), data: mapRecordToMap(env.data) };
      log.info({ count: marketStore.fiveMin.data.size }, 'market: 5m updated');
    } catch (e: any) {
      marketStore.fiveMin = marketStore.fiveMin
        ? { ...marketStore.fiveMin, err: e?.message ?? String(e), ts: Date.now() }
        : { ts: Date.now(), data: new Map(), err: e?.message ?? String(e) };
      log.warn({ err: marketStore.fiveMin.err }, 'market: 5m fetch failed');
    }
  };

  const run1h = async () => {
    try {
      const env = await fetch1h();
      marketStore.oneHour = { ts: Date.now(), data: mapRecordToMap(env.data) };
      log.info({ count: marketStore.oneHour.data.size }, 'market: 1h updated');
    } catch (e: any) {
      marketStore.oneHour = marketStore.oneHour
        ? { ...marketStore.oneHour, err: e?.message ?? String(e), ts: Date.now() }
        : { ts: Date.now(), data: new Map(), err: e?.message ?? String(e) };
      log.warn({ err: marketStore.oneHour.err }, 'market: 1h fetch failed');
    }
  };

  // Kick once at start
  void runMapping();
  void runLatest();
  void run5m();
  void run1h();

  // Schedule
  const ids: NodeJS.Timeout[] = [];
  ids.push(setInterval(runLatest, pollLatestMs));
  ids.push(setInterval(run5m, poll5mMs));
  ids.push(setInterval(run1h, poll1hMs));
  ids.push(setInterval(runMapping, pollMappingMs));

  log.info(
    {
      pollLatestMs,
      poll5mMs,
      poll1hMs,
      pollMappingMs,
    },
    'market: poller started',
  );

  return () => ids.forEach(clearInterval);
}
