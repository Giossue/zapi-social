import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { EmailModule } from './email.module';

/**
 * La superficie Admin vive fuera de `EmailModule` a propósito: `IdentityModule`
 * ya importa `EmailModule` para los correos de la cuenta, así que importarlo de
 * vuelta desde ahí crearía un ciclo de módulos y Nest no arrancaría.
 */
@Module({
  imports: [IdentityModule, EmailModule],
  controllers: [AdminEmailTemplatesController],
})
export class AdminEmailTemplatesModule {}
