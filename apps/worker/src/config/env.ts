type WorkerEnv = {
  DATABASE_URL: string;
  PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  FILES_STORAGE_PATH: string;
  API_PUBLIC_ORIGIN?: string;
  AI_PROVIDER_BASE_URL?: string;
  AI_PROVIDER_API_KEY?: string;
  AI_TEXT_MODEL?: string;
  AI_IMAGE_MODEL?: string;
};

export function validateEnv(config: Record<string, unknown>): WorkerEnv {
  const databaseUrl = required(config, 'DATABASE_URL');
  const encryptionKey = required(
    config,
    'PROVIDER_INTEGRATIONS_ENCRYPTION_KEY',
  );
  const redisHost = required(config, 'REDIS_HOST');
  const redisPort = Number(required(config, 'REDIS_PORT'));

  if (!Number.isInteger(redisPort) || redisPort <= 0) {
    throw new Error('REDIS_PORT must be a positive integer.');
  }

  return {
    DATABASE_URL: databaseUrl,
    PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: encryptionKey,
    REDIS_HOST: redisHost,
    REDIS_PORT: redisPort,
    REDIS_USERNAME: optional(config, 'REDIS_USERNAME'),
    REDIS_PASSWORD: optional(config, 'REDIS_PASSWORD'),
    FILES_STORAGE_PATH:
      optional(config, 'FILES_STORAGE_PATH') ?? './.data/files',
    API_PUBLIC_ORIGIN: optional(config, 'API_PUBLIC_ORIGIN'),
    AI_PROVIDER_BASE_URL: optional(config, 'AI_PROVIDER_BASE_URL'),
    AI_PROVIDER_API_KEY: optional(config, 'AI_PROVIDER_API_KEY'),
    AI_TEXT_MODEL: optional(config, 'AI_TEXT_MODEL'),
    AI_IMAGE_MODEL: optional(config, 'AI_IMAGE_MODEL'),
  };
}

function required(config: Record<string, unknown>, name: string): string {
  const value = optional(config, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(
  config: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = config[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
