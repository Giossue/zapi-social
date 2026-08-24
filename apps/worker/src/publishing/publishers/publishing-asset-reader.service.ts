import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import { PublishingDeliveryError } from './publishing-provider';

@Injectable()
export class PublishingAssetReader {
  private readonly storageRoot: string;

  constructor(config: ConfigService) {
    this.storageRoot = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async blob(asset: PreparedPublishingAsset) {
    const path = resolve(this.storageRoot, asset.storageKey);
    if (!path.startsWith(`${this.storageRoot}/`)) {
      throw new PublishingDeliveryError('PUBLISHING_MEDIA_NOT_AVAILABLE', true);
    }
    const bytes = await readFile(path).catch(() => null);
    if (!bytes || bytes.length !== asset.sizeBytes) {
      throw new PublishingDeliveryError('PUBLISHING_MEDIA_NOT_AVAILABLE', true);
    }
    return new Blob([bytes], { type: asset.mimeType });
  }
}
