import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [IdentityModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
