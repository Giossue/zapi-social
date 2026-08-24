import { DatabaseService } from '../database/database.service';
import { PlanAccessService } from './plan-access.service';

describe('PlanAccessService module gate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows included modules and rejects direct access to locked modules', async () => {
    const service = new PlanAccessService({} as DatabaseService);
    jest.spyOn(service, 'modulesFor').mockResolvedValue(['publishing']);

    await expect(
      service.requireModule('workspace-id', 'publishing'),
    ).resolves.toBeUndefined();
    await expect(
      service.requireModule('workspace-id', 'files'),
    ).rejects.toMatchObject({ code: 'PLAN_MODULE_DISABLED' });
  });
});
