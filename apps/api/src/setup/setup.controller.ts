import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SetupService } from './setup.service';

@ApiTags('setup')
@Controller('v1/setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  status() {
    return this.setup.status();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  createAdmin(@Body() body: unknown) {
    return this.setup.createAdmin(body);
  }
}
