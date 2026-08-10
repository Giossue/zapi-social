import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { BillingWebhookService } from './billing-webhook.service';

@ApiTags('billing-webhooks')
@Controller('v1/webhooks/polar')
export class BillingWebhookController {
  constructor(private readonly webhooks: BillingWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(@Req() request: RawBodyRequest<FastifyRequest>) {
    if (!request.rawBody) return;
    const headers = Object.fromEntries(
      Object.entries(request.headers)
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        )
        .map(([key, value]) => [key.toLowerCase(), value]),
    );
    await this.webhooks.handle(request.rawBody, headers);
  }
}
