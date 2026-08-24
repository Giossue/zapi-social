import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PUBLIC_ORIGIN: z.string().url().default('http://127.0.0.1:3001'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_USERNAME: z.string().min(1).optional(),
  REDIS_PASSWORD: z.string().min(1).optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  FILES_STORAGE_PATH: z.string().min(1).default('./.data/files'),
  UNSPLASH_ACCESS_KEY: z.string().min(1).optional(),
  PEXELS_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;
export const validateEnv = (value: Record<string, unknown>): Env =>
  schema.parse(value);
