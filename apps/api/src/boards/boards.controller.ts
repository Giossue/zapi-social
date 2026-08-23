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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { BoardsService } from './boards.service';
import { ContentBoardService } from './content-board.service';

@ApiTags('portal-boards')
@Controller('v1/portal/boards')
export class BoardsController {
  constructor(
    private readonly boards: BoardsService,
    private readonly content: ContentBoardService,
    private readonly access: SessionAccessService,
  ) {}

  @Get('tasks')
  async board(
    @Req() request: FastifyRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const { starterTodo, starterDoing, starterDone, ...filters } = query ?? {};
    return this.boards.board(
      await this.access.requirePortalSession(request),
      filters,
      // Los nombres de las columnas de arranque llegan en el idioma activo: la
      // API no traduce, y a partir de ese momento son datos del usuario.
      { todo: starterTodo, doing: starterDoing, done: starterDone } as Record<
        string,
        string
      >,
    );
  }

  @Post('columns')
  async createColumn(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.boards.createColumn(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch('columns/:id')
  async updateColumn(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.boards.updateColumn(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Put('columns/order')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderColumns(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.boards.reorderColumns(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Delete('columns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteColumn(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.boards.deleteColumn(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post('tasks')
  async createTask(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.boards.createTask(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get('tasks/:id')
  async task(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.boards.task(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Patch('tasks/:id')
  async updateTask(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.boards.updateTask(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Put('tasks/:id/position')
  async moveTask(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.boards.moveTask(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post('tasks/:id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveTask(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.boards.archiveTask(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.boards.deleteTask(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post('tasks/:id/comments')
  async addComment(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.boards.addComment(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post('tasks/:id/attachments')
  async addAttachment(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.boards.addAttachment(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete('tasks/:id/attachments/:attachmentId')
  async removeAttachment(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.boards.removeAttachment(
      await this.access.requirePortalSession(request),
      id,
      attachmentId,
    );
  }

  @Post('labels')
  async createLabel(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.boards.createLabel(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Delete('labels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLabel(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.boards.deleteLabel(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Get('content')
  async contentBoard(@Req() request: FastifyRequest) {
    return this.content.board(await this.access.requirePortalSession(request));
  }

  @Put('content/:id/status')
  async moveContentCard(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.content.move(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }
}
