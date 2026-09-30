function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '30d',
  allowSignup: process.env['ALLOW_SIGNUP'] !== 'false',
  avatarDir: process.env['AVATAR_DIR'] ?? '/data/avatars',
  // Número de proxies delante de la API (Tailscale Funnel → Caddy) para obtener la IP real
  trustProxy: Number(process.env['TRUST_PROXY'] ?? 2),
};
