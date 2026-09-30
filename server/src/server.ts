import { mkdir } from 'node:fs/promises';
import { buildApp } from './app.ts';
import { config } from './config.ts';
import { migrate, pool } from './db.ts';

const app = await buildApp();

await mkdir(config.avatarDir, { recursive: true });
await migrate((message) => app.log.info(message));
await app.listen({ port: config.port, host: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
