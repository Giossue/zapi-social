import {
  Body,
  Controller,
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
import { CommerceService } from './commerce.service';

@ApiTags('portal-commerce')
@Controller('v1/portal/commerce')
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async dashboard(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.commerce.dashboard(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Get('products')
  async products(@Req() request: FastifyRequest) {
    return this.commerce.products(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('products')
  async createProduct(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.commerce.createProduct(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch('products/:id')
  async updateProduct(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.commerce.updateProduct(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post('orders')
  async createOrder(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.commerce.createOrder(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch('orders/:id')
  async updateOrder(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.commerce.updateOrder(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post('returns')
  async createReturn(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.commerce.createReturn(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}
