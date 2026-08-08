export const PUBLISHING_DELIVERY_JOB = 'deliver-publishing-post';
export const PUBLISHING_DELIVERY_QUEUE = 'publishing-delivery';

export type PublishingDeliveryJobData = {
  publishingPostId: string;
  workspaceId: string;
};
