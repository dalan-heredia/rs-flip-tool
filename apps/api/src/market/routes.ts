import type { FastifyInstance } from 'fastify';
import { marketStore } from './store';

export async function marketRoutes(app: FastifyInstance) {
  app.get('/api/market/status', async () => marketStore.status());

  app.get('/api/market/item/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid id' });
    return marketStore.getItem(id);
  });
}
