import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { marketRoutes } from './market/routes';
import { startMarketPoller } from './market/poller';
import { computeFlipRecs } from './engine/flipEngine';


type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1;
  ts: number;
  type: TType;
  payload: TPayload;
};

const app = Fastify({ logger: true });

app.get('/', async () => {
  return {
    ok: true,
    service: 'rs-flip-tool-api',
    endpoints: ['/api/health', '/ws'],
  };
});

app.get('/api/flips', async (req) => {
  const q = req.query as any;

  const cash = q?.cash ? Number(q.cash) : Number(process.env.DEFAULT_CASH ?? 5_000_000);

  const { params, recommendations } = computeFlipRecs({
    cash: Number.isFinite(cash) ? cash : 5_000_000,
  });

  return {
    schemaVersion: 1,
    ts: Date.now(),
    params,
    recommendations,
  };
});


// Allow Vite dev server (5173) to call the API (8787)
await app.register(cors, {
  origin: true,
});

// WebSocket support
await app.register(websocket);

const clients = new Set<any>();

app.get('/api/health', async () => {
  return {
    ok: true,
    version: '0.0.0',
    uptimeSec: Math.floor(process.uptime()),
    schemaVersion: 1,
  };
});

// WS endpoint
app.get('/ws', { websocket: true }, (connection) => {
  clients.add(connection.socket);

  const hello: WsEnvelope<'hello', { msg: string }> = {
    schemaVersion: 1,
    ts: Date.now(),
    type: 'hello',
    payload: { msg: 'connected' },
  };
  connection.socket.send(JSON.stringify(hello));

  connection.socket.on('close', () => {
    clients.delete(connection.socket);
  });
});

// Broadcast a placeholder “flips:update” every 2 seconds (we’ll replace later with real engine output)
setInterval(() => {
  const cash = Number(process.env.DEFAULT_CASH ?? 5_000_000);
  const { params, recommendations } = computeFlipRecs({ cash });

  const msg = {
    schemaVersion: 1 as const,
    ts: Date.now(),
    type: 'flips:update' as const,
    payload: { params, recommendations },
  };

  const json = JSON.stringify(msg);
  for (const ws of clients) {
    try {
      ws.send(json);
    } catch {
      clients.delete(ws);
    }
  }
}, 5000);


await app.register(marketRoutes);
startMarketPoller(app.log);

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
