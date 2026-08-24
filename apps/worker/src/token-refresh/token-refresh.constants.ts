export const TOKEN_REFRESH_QUEUE = 'channel-token-refresh';
export const TOKEN_REFRESH_JOB = 'refresh-expiring-tokens';

/**
 * Una pasada cada media hora. El barrido solo renueva lo que caduca pronto y es
 * idempotente, así que repetirlo no gasta nada.
 */
export const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1_000;

/** Se renueva un token cuando le queda menos de esto para caducar. */
export const TOKEN_REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1_000;
