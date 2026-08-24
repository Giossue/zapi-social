import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { EmailService } from '../email/email.service';
import { SessionAccessService } from '../identity/session-access.service';
import { ChannelProviderIntegrationsService } from './channel-provider-integrations.service';
import { IntegrationsService } from './integrations.service';

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/meta')
export class IntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.integrations.getMeta();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.testMeta(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.saveMeta(input, session);
  }
}

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/whatsapp-status')
export class WhatsAppStatusIntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.integrations.getWhatsAppStatus();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.testWhatsAppStatus(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.saveWhatsAppStatus(input, session);
  }
}

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/email-smtp')
export class EmailSmtpIntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly email: EmailService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.email.getSmtpIntegration();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.email.testSmtpIntegration(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.email.saveSmtpIntegration(input, session);
  }
}

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/google-drive')
export class GoogleDriveIntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.integrations.getGoogleDrive();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.testGoogleDrive(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.saveGoogleDrive(input, session);
  }
}

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/pexels')
export class PexelsIntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.integrations.getPexels();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.testPexels(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.savePexels(input, session);
  }
}

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/channel-providers')
export class ChannelProviderIntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly providers: ChannelProviderIntegrationsService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.providers.list();
  }

  @Post(':providerKey/test')
  async test(
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
    @Req() request: FastifyRequest,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.providers.test(providerKey, input);
  }

  @Patch(':providerKey')
  async save(
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
    @Req() request: FastifyRequest,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.providers.save(providerKey, input);
  }
}
