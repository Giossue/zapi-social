import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { ContentService } from './content.service';

/** Contenido global de plataforma. Solo administradores de plataforma. */
@ApiTags('admin-content')
@Controller('v1/admin/content')
export class ContentController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly content: ContentService,
  ) {}

  @Get('languages')
  async languages(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listLanguages(query);
  }

  @Post('languages')
  async createLanguage(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveLanguage(null, body);
  }

  @Patch('languages/:id')
  async updateLanguage(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveLanguage(id, body);
  }

  @Delete('languages/:id')
  async removeLanguage(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeLanguage(id);
  }

  @Get('blog-categories')
  async blogCategories(
    @Req() request: FastifyRequest,
    @Query() query: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listBlogCategories(query);
  }

  @Post('blog-categories')
  async createBlogCategory(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogCategory(null, body);
  }

  @Patch('blog-categories/:id')
  async updateBlogCategory(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogCategory(id, body);
  }

  @Delete('blog-categories/:id')
  async removeBlogCategory(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeBlogCategory(id);
  }

  @Get('blog-tags')
  async blogTags(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listBlogTags(query);
  }

  @Post('blog-tags')
  async createBlogTag(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogTag(null, body);
  }

  @Patch('blog-tags/:id')
  async updateBlogTag(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogTag(id, body);
  }

  @Delete('blog-tags/:id')
  async removeBlogTag(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeBlogTag(id);
  }

  @Get('blog-posts')
  async blogPosts(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listBlogPosts(query);
  }

  @Post('blog-posts')
  async createBlogPost(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogPost(null, body);
  }

  @Patch('blog-posts/:id')
  async updateBlogPost(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveBlogPost(id, body);
  }

  @Delete('blog-posts/:id')
  async removeBlogPost(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeBlogPost(id);
  }

  @Get('faqs')
  async faqs(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listFaqs(query);
  }

  @Post('faqs')
  async createFaq(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveFaq(null, body);
  }

  @Patch('faqs/:id')
  async updateFaq(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveFaq(id, body);
  }

  @Delete('faqs/:id')
  async removeFaq(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeFaq(id);
  }

  @Get('ai-template-categories')
  async aiTemplateCategories(
    @Req() request: FastifyRequest,
    @Query() query: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listAiTemplateCategories(query);
  }

  @Post('ai-template-categories')
  async createAiTemplateCategory(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveAiTemplateCategory(null, body);
  }

  @Patch('ai-template-categories/:id')
  async updateAiTemplateCategory(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveAiTemplateCategory(id, body);
  }

  @Delete('ai-template-categories/:id')
  async removeAiTemplateCategory(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeAiTemplateCategory(id);
  }

  @Get('ai-templates')
  async aiTemplates(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.content.listAiTemplates(query);
  }

  @Post('ai-templates')
  async createAiTemplate(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveAiTemplate(null, body);
  }

  @Patch('ai-templates/:id')
  async updateAiTemplate(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.content.saveAiTemplate(id, body);
  }

  @Delete('ai-templates/:id')
  async removeAiTemplate(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.access.requirePlatformAdmin(request);
    await this.content.removeAiTemplate(id);
  }
}
