import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { telemetryStore } from './store';

function getBridgeToken(): string {
  return process.env.BRIDGE_TOKEN ?? 'dev-bridge-token';
}

function requireBridgeToken(req: FastifyRequest, reply: FastifyReply) {
  const expected = getBridgeToken();
  const auth = (req.headers['authorization'] ?? '').toString();
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';

  if (!token || token !== expected) {
    reply.code(401).send({
      ok: false,
      error: 'unauthorized',
    });
    return false;
  }

  return true;
}

type HeartbeatBody = {
  accountHash: string;
  ts?: number;
  pluginVersion?: string;
  clientRevision?: number;
  world?: number;
};

type WalletBody = {
  accountHash: string;
  ts?: number;
  coins?: number;
  platinumTokens?: number;
  cashTotal?: number;
};

type OffersBody = {
  accountHash: string;
  ts?: number;
  offers: Array<{
    slot: number;
    itemId: number;
    itemName?: string;
    side?: string;
    status?: string;
    price?: number;
    qtyTotal?: number;
    qtyFilled?: number;
  }>;
};

export async function telemetryRoutes(app: FastifyInstance, opts: { broadcastTelemetry: (payload: any) => void }) {
  app.get('/api/telemetry/status', async () => telemetryStore.status());

  // NEW: heartbeat (FF-017)
  app.post('/api/telemetry/heartbeat', async (req, reply) => {
    if (!requireBridgeToken(req, reply)) return;

    const body = (req.body ?? {}) as HeartbeatBody;
    const accountHash = String(body.accountHash ?? '').trim();
    if (!accountHash) return reply.code(400).send({ ok: false, error: 'accountHash required' });

    const ts = Number.isFinite(body.ts) ? Number(body.ts) : Date.now();

    const pluginVersion = typeof body.pluginVersion === 'string' ? body.pluginVersion : undefined;
    const clientRevision = Number.isFinite(body.clientRevision) ? Number(body.clientRevision) : undefined;
    const world = Number.isFinite(body.world) ? Number(body.world) : undefined;

    const session = telemetryStore.upsertHeartbeat({
      accountHash,
      ts,
      pluginVersion,
      clientRevision,
      world,
    });

    opts.broadcastTelemetry({ session });

    return {
      ok: true,
      schemaVersion: 1,
      ts,
      accountHash,
    };
  });

  app.post('/api/telemetry/wallet', async (req, reply) => {
    if (!requireBridgeToken(req, reply)) return;

    const body = (req.body ?? {}) as WalletBody;
    const accountHash = String(body.accountHash ?? '').trim();
    if (!accountHash) return reply.code(400).send({ ok: false, error: 'accountHash required' });

    const ts = Number.isFinite(body.ts) ? Number(body.ts) : Date.now();
    const coins = Number.isFinite(body.coins) ? Number(body.coins) : undefined;
    const platinumTokens = Number.isFinite(body.platinumTokens) ? Number(body.platinumTokens) : undefined;

    let cashTotal = Number.isFinite(body.cashTotal) ? Number(body.cashTotal) : NaN;
    if (!Number.isFinite(cashTotal)) {
      const c = coins ?? 0;
      const p = platinumTokens ?? 0;
      cashTotal = c + p * 1000;
    }

    const session = telemetryStore.upsertWallet({ accountHash, ts, coins, platinumTokens, cashTotal });

    opts.broadcastTelemetry({ session });

    return { ok: true, schemaVersion: 1, ts, accountHash, cashTotal };
  });

  app.post('/api/telemetry/offers', async (req, reply) => {
    if (!requireBridgeToken(req, reply)) return;

    const body = (req.body ?? {}) as OffersBody;
    const accountHash = String(body.accountHash ?? '').trim();
    if (!accountHash) return reply.code(400).send({ ok: false, error: 'accountHash required' });

    const offers = Array.isArray(body.offers) ? body.offers : [];
    const ts = Number.isFinite(body.ts) ? Number(body.ts) : Date.now();

    const normalized = offers
      .filter((o) => Number.isFinite(o.slot) && Number.isFinite(o.itemId))
      .map((o) => ({
        slot: Number(o.slot),
        itemId: Number(o.itemId),
        itemName: o.itemName,
        side: o.side,
        status: o.status,
        price: Number.isFinite(o.price) ? Number(o.price) : undefined,
        qtyTotal: Number.isFinite(o.qtyTotal) ? Number(o.qtyTotal) : undefined,
        qtyFilled: Number.isFinite(o.qtyFilled) ? Number(o.qtyFilled) : undefined,
      }));

    const session = telemetryStore.upsertOffers(accountHash, ts, normalized);

    opts.broadcastTelemetry({ session });

    return { ok: true, schemaVersion: 1, ts, accountHash, offers: normalized.length };
  });
}
