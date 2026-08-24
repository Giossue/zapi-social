import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { LanguagesService } from './languages.service';

@ApiTags('i18n')
@Controller('v1/i18n')
export class PublicLanguagesController {
  constructor(private readonly languages: LanguagesService) {}

  @Get('languages')
  async languagesList() {
    return this.languages.activeLanguages();
  }

  @Get('messages/:code')
  async messages(@Param('code') code: string) {
    return this.languages.localeMessages(code);
  }
}

@ApiTags('admin-languages')
@Controller('v1/admin/languages')
export class AdminLanguagesController {
  constructor(
    private readonly languages: LanguagesService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.languages.adminList();
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.languages.create(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }

  @Patch(':code')
  async update(
    @Req() request: FastifyRequest,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    return this.languages.update(
      await this.access.requirePlatformAdmin(request),
      code,
      body,
    );
  }

  @Delete(':code')
  async remove(@Req() request: FastifyRequest, @Param('code') code: string) {
    return this.languages.remove(
      await this.access.requirePlatformAdmin(request),
      code,
    );
  }

  @Get(':code/translations')
  async translations(
    @Req() request: FastifyRequest,
    @Param('code') code: string,
    @Query() query: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.languages.translations(code, query ?? {});
  }

  @Put(':code/translations')
  async save(
    @Req() request: FastifyRequest,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    return this.languages.saveTranslation(
      await this.access.requirePlatformAdmin(request),
      code,
      body,
    );
  }

  @Post(':code/translations/import')
  async importTranslations(
    @Req() request: FastifyRequest,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    return this.languages.importTranslations(
      await this.access.requirePlatformAdmin(request),
      code,
      body,
    );
  }

  @Get(':code/translations/export')
  async exportTranslations(
    @Req() request: FastifyRequest,
    @Param('code') code: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.languages.exportTranslations(code);
  }
}
