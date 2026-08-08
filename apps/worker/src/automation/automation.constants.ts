export const AUTOMATION_WEBHOOK_QUEUE = 'automation-webhooks';
export const AUTOMATION_WEBHOOK_DISPATCH_JOB = 'dispatch-automation-webhooks';
export const AUTOMATION_WEBHOOK_DELIVERY_JOB = 'deliver-automation-webhook';
export const AUTOMATION_WEBHOOK_DISPATCH_INTERVAL_MS = 30_000;

export type AutomationWebhookDispatchJobData = Record<string, never>;
export type AutomationWebhookDeliveryJobData = { deliveryId: string };
