import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { FilesService } from './files.service';
import { GoogleDriveImportsService } from './google-drive-imports.service';

@ApiTags('portal-files')
@Controller('v1/portal/files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly access: SessionAccessService,
  ) {}
  @Get() list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.files.list(this.access.requirePortalSession(request), query);
  }
  @Post('folders') createFolder(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.files.createFolder(
      this.access.requirePortalSession(request),
      body,
    );
  }
  @Patch('folders/:id') updateFolder(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.files.updateFolder(
      this.access.requirePortalSession(request),
      id,
      body,
    );
  }
  @Delete('folders/:id') @HttpCode(HttpStatus.NO_CONTENT) async removeFolder(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.files.removeFolder(
      this.access.requirePortalSession(request),
      id,
    );
  }
  @Post('uploads') startUpload(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.files.startUpload(
      this.access.requirePortalSession(request),
      body,
    );
  }
  @Post(':id/upload') @HttpCode(HttpStatus.NO_CONTENT) async upload(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.files.upload(
      this.access.requirePortalSession(request),
      id,
      request.raw,
    );
  }
  @Patch(':id') update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.files.updateAsset(
      this.access.requirePortalSession(request),
      id,
      body,
    );
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.files.remove(this.access.requirePortalSession(request), id);
  }
  @Get(':id/download') async download(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param('id') id: string,
  ) {
    const file = await this.files.download(
      this.access.requirePortalSession(request),
      id,
    );
    return reply
      .type(file.mimeType)
      .header(
        'content-disposition',
        `attachment; filename="${file.name.replaceAll('"', '')}"`,
      )
      .send(file.stream);
  }
  @Get(':id/preview') async preview(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param('id') id: string,
  ) {
    const file = await this.files.preview(
      this.access.requirePortalSession(request),
      id,
      request.headers.range,
    );
    if (file.partial)
      reply
        .code(HttpStatus.PARTIAL_CONTENT)
        .header('accept-ranges', 'bytes')
        .header('content-range', `bytes ${file.start}-${file.end}/${file.size}`)
        .header('content-length', String(file.end - file.start + 1));
    return reply
      .type(file.mimeType)
      .header('cache-control', 'private, max-age=86400')
      .header(
        'content-disposition',
        `inline; filename="${file.name.replaceAll('"', '')}"`,
      )
      .send(file.stream);
  }
  @Get(':id/thumbnail') async thumbnail(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param('id') id: string,
  ) {
    const file = await this.files.thumbnail(
      this.access.requirePortalSession(request),
      id,
    );
    return reply
      .type(file.mimeType)
      .header('cache-control', 'private, max-age=86400')
      .header(
        'content-disposition',
        `inline; filename="${file.name.replaceAll('"', '')}"`,
      )
      .send(file.stream);
  }
}

@ApiTags('portal-files')
@Controller('v1/portal/files')
export class GoogleDriveFilesController {
  constructor(
    private readonly imports: GoogleDriveImportsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get('providers/google-drive')
  provider(@Req() request: FastifyRequest) {
    return this.imports.getProvider(this.access.requirePortalSession(request));
  }

  @Post('imports/google-drive')
  createImport(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.imports.createBatch(
      this.access.requirePortalSession(request),
      body,
    );
  }

  @Get('imports/:id')
  importStatus(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.imports.getBatch(this.access.requirePortalSession(request), id);
  }
}
