export const BULK_POST_BATCH_JOB = 'process-bulk-post-batch';
export const BULK_POST_BATCH_QUEUE = 'bulk-post-batches';

export type BulkPostBatchJobData = {
  batchId: string;
  workspaceId: string;
};
