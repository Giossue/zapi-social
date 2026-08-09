import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { TeamsService } from './teams.service';

@ApiTags('public-teams')
@Controller('v1/public/teams')
export class TeamsPublicController {
  constructor(private readonly teams: TeamsService) {}

  @Post('invitations/preview')
  @HttpCode(200)
  async previewInvitation(@Body() body: unknown) {
    return this.teams.previewInvitation(body);
  }
}

@ApiTags('portal-teams')
@Controller('v1/portal/teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    return this.teams.list(await this.access.requirePortalSession(request));
  }

  @Get('activity')
  async listActivity(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.teams.listActivity(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post('invitations')
  async createInvitation(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.teams.createInvitation(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post('invitations/accept')
  async acceptInvitation(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.teams.acceptInvitation(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post('invitations/:id/resend')
  async resendInvitation(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.teams.resendInvitation(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.teams.revokeInvitation(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Patch('members/:userId/role')
  async updateMemberRole(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    return this.teams.updateMemberRole(
      await this.access.requirePortalSession(request),
      userId,
      body,
    );
  }

  @Put('members/:userId/account-grants')
  async replaceAccountGrants(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    return this.teams.replaceAccountGrants(
      await this.access.requirePortalSession(request),
      userId,
      body,
    );
  }

  @Put('members/:userId/access')
  async updateMemberAccess(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    return this.teams.updateMemberAccess(
      await this.access.requirePortalSession(request),
      userId,
      body,
    );
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
  ) {
    await this.teams.removeMember(
      await this.access.requirePortalSession(request),
      userId,
    );
  }

  @Post('leave')
  async leaveWorkspace(@Req() request: FastifyRequest) {
    return this.teams.leaveWorkspace(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('ownership/transfer')
  async transferOwnership(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.teams.transferOwnership(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}
