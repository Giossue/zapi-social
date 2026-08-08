export const PUBLISHING_DELIVERY_JOB = 'deliver-publishing-post';
export const PUBLISHING_DISPATCH_JOB = 'dispatch-due-publishing-posts';
export const PUBLISHING_DELIVERY_QUEUE = 'publishing-delivery';
export const PUBLISHING_DISPATCH_INTERVAL_MS = 30_000;

export type PublishingDeliveryJobData = {
  publishingPostId: string;
  workspaceId: string;
};
export type PublishingDispatchJobData = Record<string, never>;
