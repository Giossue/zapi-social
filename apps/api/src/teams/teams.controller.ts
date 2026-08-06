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
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { TeamsService } from './teams.service';

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
}
