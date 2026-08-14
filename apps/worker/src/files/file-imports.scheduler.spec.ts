import type { Job, Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { FileImportsScheduler } from './file-imports.scheduler';
import type { FileImportJobData } from './file-imports.constants';

function databaseWithBatch(id: string) {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id }]),
          }),
        }),
      }),
    },
  } as unknown as DatabaseService;
}

async function recover(scheduler: FileImportsScheduler) {
  await (scheduler as unknown as { recover(): Promise<void> }).recover();
}

describe('FileImportsScheduler', () => {
  it('removes a retained failed job and queues the durable batch again', async () => {
    const batchId = crypto.randomUUID();
    let removed = false;
    const added: string[] = [];
    const job = {
      getState: () => Promise.resolve('failed'),
      remove: () => {
        removed = true;
        return Promise.resolve();
      },
    } as unknown as Job<FileImportJobData>;
    const queue = {
      getJob: () => Promise.resolve(job),
      add: (_name: string, data: FileImportJobData) => {
        added.push(data.batchId);
        return Promise.resolve(undefined);
      },
    } as unknown as Queue<FileImportJobData>;

    await recover(new FileImportsScheduler(databaseWithBatch(batchId), queue));

    expect(removed).toBe(true);
    expect(added).toEqual([batchId]);
  });

  it('does not duplicate a waiting or active job', async () => {
    const batchId = crypto.randomUUID();
    let additions = 0;
    const job = {
      getState: () => Promise.resolve('active'),
    } as unknown as Job<FileImportJobData>;
    const queue = {
      getJob: () => Promise.resolve(job),
      add: () => {
        additions += 1;
        return Promise.resolve(undefined);
      },
    } as unknown as Queue<FileImportJobData>;

    await recover(new FileImportsScheduler(databaseWithBatch(batchId), queue));

    expect(additions).toBe(0);
  });
});
