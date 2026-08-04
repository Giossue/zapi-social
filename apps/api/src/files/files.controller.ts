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
      request.body,
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
}
