export const BOARD_DUE_REMINDER_QUEUE = 'board-due-reminder';
export const BOARD_DUE_REMINDER_JOB = 'remind-due-tasks';

/**
 * Una pasada por hora. El barrido es idempotente —marca cada tarea al avisar—,
 * así que repetirlo no duplica avisos y cubre a quien entra a cualquier hora.
 */
export const BOARD_DUE_REMINDER_INTERVAL_MS = 60 * 60 * 1_000;
export const BOARD_DUE_REMINDER_BATCH_SIZE = 200;
