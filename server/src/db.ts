import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { config } from './config.ts';

// DATE (1082) como 'YYYY-MM-DD' sin conversión de zona horaria; NUMERIC (1700) como number
pg.types.setTypeParser(1082, (value: string) => value);
pg.types.setTypeParser(1700, (value: string) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const MIGRATION_LOCK_ID = 727274;

/** Aplica en orden los archivos de migrations/ que todavía no se ejecutaron */
export async function migrate(log: (message: string) => void): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        log(`Migración aplicada: ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
