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
import { PublishingService } from './publishing.service';

@ApiTags('portal-publishing-v2')
@Controller('v1/portal/publishing')
export class PublishingController {
  constructor(
    private readonly publishing: PublishingService,
    private readonly access: SessionAccessService,
  ) {}

  @Get() async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.publishing.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }
  @Post() async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.publishing.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }
  @Patch(':id') async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.publishing.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.publishing.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
  @Post(':id/retry') async retry(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.publishing.retry(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}

@ApiTags('public-publishing-media')
@Controller('v1/public/publishing-media')
export class PublicPublishingMediaController {
  constructor(private readonly publishing: PublishingService) {}

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Query('expires') expires: unknown,
    @Query('signature') signature: unknown,
    @Query('variant') variant: unknown,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.publishing.publicMedia(
      id,
      expires,
      signature,
      variant,
    );
    return reply
      .type(file.mimeType)
      .header('content-length', String(file.size))
      .header('cache-control', 'public, max-age=300')
      .header(
        'content-disposition',
        `inline; filename="${file.name.replaceAll('"', '')}"`,
      )
      .send(file.stream);
  }
}
