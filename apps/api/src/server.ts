import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
  return {
    ok: true,
    version: '0.0.0',
    uptimeSec: Math.floor(process.uptime()),
    schemaVersion: 1
  };
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
