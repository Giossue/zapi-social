import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IdentityModule } from '../identity/identity.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import {
  FilesController,
  GoogleDriveFilesController,
} from './files.controller';
import { FilesService } from './files.service';
import {
  FILE_IMPORTS_QUEUE,
  GoogleDriveImportsService,
} from './google-drive-imports.service';

@Module({
  imports: [
    IdentityModule,
    IntegrationsModule,
    BullModule.registerQueue({ name: 'file-derivatives' }),
    BullModule.registerQueue({ name: FILE_IMPORTS_QUEUE }),
  ],
  controllers: [FilesController, GoogleDriveFilesController],
  providers: [FilesService, GoogleDriveImportsService],
})
export class FilesModule {}
