import { afterEach, it, expect, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const names = ['DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'DB_PORT', 'POSTGRES_DB'];
function clearEnv() {
  for (const name of names) vi.stubEnv(name, '');
}
afterEach(() => vi.unstubAllEnvs());

it('prefers the override over the environment', () => {
  clearEnv();
  vi.stubEnv('DATABASE_URL', 'postgresql://env/db');
  expect(resolveDatabaseUrl('postgresql://override/db')).toBe('postgresql://override/db');
});
it('uses DATABASE_URL and normalizes the psycopg scheme', () => {
  clearEnv();
  vi.stubEnv('DATABASE_URL', 'postgresql+psycopg://user:pass@host:5432/db');
  expect(resolveDatabaseUrl()).toBe('postgresql://user:pass@host:5432/db');
});
it('builds the url from the postgres variables', () => {
  clearEnv();
  vi.stubEnv('POSTGRES_USER', 'user');
  vi.stubEnv('POSTGRES_PASSWORD', 'pass');
  vi.stubEnv('POSTGRES_HOST', 'db.local');
  vi.stubEnv('DB_PORT', '5433');
  vi.stubEnv('POSTGRES_DB', 'my db');
  expect(resolveDatabaseUrl()).toBe('postgresql://user:pass@db.local:5433/my%20db');
});
it.each(names.slice(1))('throws when %s is missing', (missing) => {
  clearEnv();
  for (const name of names.slice(1)) if (name !== missing) vi.stubEnv(name, '1');
  expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${missing}`);
});
