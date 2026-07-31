import { createZodDto } from 'nestjs-zod';
import { updateProviderIntegrationSchema } from '@workspace/contracts';

export class UpdateProviderIntegrationDto extends createZodDto(
  updateProviderIntegrationSchema,
) {}
