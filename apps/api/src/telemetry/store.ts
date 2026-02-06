import type { HeartbeatTelemetry, OfferTelemetry, SessionTelemetry, WalletTelemetry } from './types';

const sessions = new Map<string, SessionTelemetry>();

function ensureSession(accountHash: string): SessionTelemetry {
  const key = String(accountHash ?? '').trim();
  if (!key) throw new Error('accountHash required');

  const existing = sessions.get(key);
  if (existing) return existing;

  const created: SessionTelemetry = {
    accountHash: key,
    lastSeenTs: Date.now(),
  };

  sessions.set(key, created);
  return created;
}

export const telemetryStore = {
  upsertHeartbeat(heartbeat: HeartbeatTelemetry): SessionTelemetry {
    const session = ensureSession(heartbeat.accountHash);
    session.heartbeat = heartbeat;
    session.lastSeenTs = heartbeat.ts;
    return session;
  },

  upsertWallet(wallet: WalletTelemetry): SessionTelemetry {
    const session = ensureSession(wallet.accountHash);
    session.wallet = wallet;
    session.lastSeenTs = wallet.ts;
    return session;
  },

  upsertOffers(
    accountHash: string,
    ts: number,
    offers: Array<Omit<OfferTelemetry, 'accountHash' | 'ts'>>,
  ): SessionTelemetry {
    const session = ensureSession(accountHash);
    session.offers = offers.map((o) => ({ ...o, accountHash, ts }));
    session.lastSeenTs = ts;
    return session;
  },

  getSession(accountHash: string): SessionTelemetry | null {
    const key = String(accountHash ?? '').trim();
    return sessions.get(key) ?? null;
  },

  snapshot(): SessionTelemetry[] {
    return Array.from(sessions.values());
  },

  status() {
    return {
      sessions: sessions.size,
      newestTs: Math.max(0, ...Array.from(sessions.values()).map((s) => s.lastSeenTs ?? 0)),
    };
  },
};
