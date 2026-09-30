import { unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.ts';
import { pool } from '../db.ts';
import { httpError } from '../errors.ts';

interface UserRow {
  id: string;
  email: string;
  avatar_url: string | null;
}

interface Credentials {
  email: string;
  password: string;
}

const BCRYPT_ROUNDS = 12;

// Hash de relleno: un correo inexistente tarda lo mismo que una contraseña incorrecta
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);

const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

function credentialsSchema(passwordMinLength: number) {
  return {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: passwordMinLength, maxLength: 72 },
      },
    },
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUser(row: UserRow) {
  return { id: row.id, email: row.email, avatarUrl: row.avatar_url };
}

function toSession(app: FastifyInstance, row: UserRow) {
  return { token: app.jwt.sign({ sub: row.id }), user: toUser(row) };
}

/** Rutas públicas: registro e inicio de sesión */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Credentials }>(
    '/auth/register',
    { schema: credentialsSchema(6), config: authRateLimit },
    async (request, reply) => {
      if (!config.allowSignup) {
        throw httpError(403, 'El registro de cuentas nuevas está deshabilitado.');
      }
      const passwordHash = await bcrypt.hash(request.body.password, BCRYPT_ROUNDS);
      const { rows } = await pool.query<UserRow>(
        `insert into users (email, password_hash) values ($1, $2)
         on conflict (email) do nothing
         returning id, email, avatar_url`,
        [normalizeEmail(request.body.email), passwordHash],
      );
      if (!rows[0]) throw httpError(409, 'Ya existe una cuenta con ese correo.');
      reply.code(201);
      return toSession(app, rows[0]);
    },
  );

  app.post<{ Body: Credentials }>(
    '/auth/login',
    { schema: credentialsSchema(1), config: authRateLimit },
    async (request) => {
      const { rows } = await pool.query<UserRow & { password_hash: string }>(
        'select id, email, avatar_url, password_hash from users where email = $1',
        [normalizeEmail(request.body.email)],
      );
      const user = rows[0];
      const valid = await bcrypt.compare(request.body.password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !valid) throw httpError(401, 'Correo o contraseña incorrectos.');
      return toSession(app, user);
    },
  );
}

/** Rutas de la cuenta autenticada: renovar sesión y foto de perfil */
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/me', async (request) => {
    const { rows } = await pool.query<UserRow>(
      'select id, email, avatar_url from users where id = $1',
      [request.user.sub],
    );
    if (!rows[0]) throw httpError(401, 'La cuenta ya no existe.');
    return toSession(app, rows[0]);
  });

  app.post('/auth/avatar', async (request) => {
    const file = await request.file();
    if (!file) throw httpError(400, 'No se recibió ninguna imagen.');

    const ext = AVATAR_EXTENSIONS[file.mimetype];
    if (!ext) throw httpError(415, 'Solo se permiten imágenes PNG, JPG, WEBP o GIF.');

    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw httpError(413, 'La imagen no puede superar 2 MB.');
      }
      throw err;
    }

    // Nombre único por subida: permite cachear /avatars/* como inmutable
    const fileName = `${request.user.sub}-${Date.now()}.${ext}`;
    await writeFile(join(config.avatarDir, fileName), data);

    const { rows } = await pool.query<UserRow & { previous: string | null }>(
      `update users u set avatar_url = $2
       from (select avatar_url as previous from users where id = $1) p
       where u.id = $1
       returning u.id, u.email, u.avatar_url, p.previous`,
      [request.user.sub, `/avatars/${fileName}`],
    );
    const user = rows[0];
    if (!user) throw httpError(401, 'La cuenta ya no existe.');

    if (user.previous?.startsWith('/avatars/')) {
      await unlink(join(config.avatarDir, basename(user.previous))).catch(() => undefined);
    }
    return { user: toUser(user) };
  });
}
