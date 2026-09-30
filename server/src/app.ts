import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError } from 'fastify';
import { config } from './config.ts';
import { pool } from './db.ts';
import { accountRoutes, authRoutes } from './routes/auth.ts';
import { financeRoutes } from './routes/finance.ts';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    // Confía solo en los N saltos más cercanos (equivale a trustProxy: N)
    trustProxy: (_address: string, hop: number) => hop < config.trustProxy,
  });

  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });
  await app.register(fastifyMultipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
  await app.register(fastifyRateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
    }),
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ message: `Datos inválidos: ${error.message}` });
    }
    if (error.code?.startsWith('FST_JWT_')) {
      return reply.code(401).send({ message: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) request.log.error(error);
    return reply
      .code(status)
      .send({ message: status >= 500 ? 'Error interno del servidor.' : error.message });
  });

  await app.register(
    async (api) => {
      api.get('/health', async () => {
        await pool.query('select 1');
        return { ok: true };
      });

      await api.register(authRoutes);

      await api.register(async (privateApi) => {
        privateApi.addHook('onRequest', async (request) => {
          await request.jwtVerify();
        });
        await privateApi.register(accountRoutes);
        await privateApi.register(financeRoutes);
      });
    },
    { prefix: '/api' },
  );

  return app;
}
