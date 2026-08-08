import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IdentityModule } from '../identity/identity.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    IdentityModule,
    BullModule.registerQueue({ name: 'file-derivatives' }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
