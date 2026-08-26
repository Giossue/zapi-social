import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicSiteService } from './public-site.service';

@ApiTags('public-site')
@Controller('v1/public/site')
export class PublicSiteController {
  constructor(private readonly site: PublicSiteService) {}

  @Get()
  async overview() {
    return this.site.overview();
  }

  @Get('faqs')
  async faqs(@Query() query: unknown) {
    return this.site.faqList(query);
  }

  @Get('posts')
  async posts(@Query() query: unknown) {
    return this.site.posts(query);
  }

  @Get('posts/:slug')
  async post(@Param('slug') slug: string) {
    return this.site.post(slug);
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    return this.site.page(slug);
  }
}
