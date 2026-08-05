import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Injectable } from '@nestjs/common';

const feedTimeoutMilliseconds = 15_000;
const maxFeedBytes = 1_000_000;

export type RssFeedItem = {
  contentHash: string;
  guid: string | null;
  publishedAt: Date | null;
  summary: string | null;
  title: string | null;
  url: string | null;
};

export class RssFeedReadError extends Error {
  constructor(readonly code: 'RSS_FEED_INVALID' | 'RSS_FEED_UNAVAILABLE') {
    super(code);
  }
}

@Injectable()
export class RssFeedReaderService {
  async read(feedUrl: string): Promise<RssFeedItem[]> {
    let xml: string;
    try {
      xml = await this.download(new URL(feedUrl));
    } catch {
      throw new RssFeedReadError('RSS_FEED_UNAVAILABLE');
    }
    const items = this.parse(xml);
    if (!items.length) throw new RssFeedReadError('RSS_FEED_INVALID');
    return items;
  }

  private async download(url: URL): Promise<string> {
    const addresses = await lookup(url.hostname, {
      all: true,
      verbatim: true,
    });
    const address = addresses.find((candidate) =>
      this.isPublicAddress(candidate.address, candidate.family),
    );
    if (!address) throw new Error('Feed host is not public');

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, body?: string) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(body ?? '');
      };
      const options = {
        headers: {
          accept:
            'application/atom+xml, application/rss+xml, application/xml, text/xml, text/plain;q=0.9',
          host: url.host,
          'user-agent': 'ZapiSocial-RSS-Worker/1.0',
        },
        hostname: address.address,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        port: url.port || undefined,
      };
      const request =
        url.protocol === 'https:'
          ? httpsRequest({ ...options, servername: url.hostname })
          : httpRequest(options);

      request.setTimeout(feedTimeoutMilliseconds, () =>
        request.destroy(new Error('Feed request timed out')),
      );
      request.on('error', (error) => finish(error));
      request.on('response', (response) => {
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          response.resume();
          finish(new Error('Feed response was unsuccessful'));
          return;
        }
        const declaredLength = Number(response.headers['content-length'] ?? 0);
        if (declaredLength > maxFeedBytes) {
          response.resume();
          finish(new Error('Feed response is too large'));
          return;
        }

        let receivedBytes = 0;
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          receivedBytes += Buffer.byteLength(chunk);
          if (receivedBytes > maxFeedBytes) {
            request.destroy(new Error('Feed response is too large'));
            return;
          }
          body += chunk;
        });
        response.on('end', () => finish(undefined, body));
        response.on('error', (error) => finish(error));
      });
      request.end();
    });
  }

  private parse(xml: string): RssFeedItem[] {
    if (!this.isFeed(xml)) return [];
    const items = this.itemBlocks(xml)
      .map((block) => this.parseItem(block))
      .filter((item): item is RssFeedItem => item !== null);
    return items.toSorted((left, right) => {
      const rightTime = right.publishedAt?.getTime() ?? 0;
      const leftTime = left.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });
  }

  private parseItem(block: string): RssFeedItem | null {
    const guid = this.elementText(block, 'guid|id');
    const url = this.feedUrl(this.linkFrom(block));
    const title = this.elementText(block, 'title');
    const summary = this.elementText(
      block,
      'description|summary|content:encoded|content',
    );
    if (!guid && !url && !title) return null;
    return {
      contentHash: createHash('sha256')
        .update(
          [guid ?? '', url ?? '', title ?? '', summary ?? ''].join('\u0000'),
        )
        .digest('hex'),
      guid: guid?.slice(0, 1024) ?? null,
      publishedAt: this.date(
        this.elementText(block, 'pubDate|published|updated|date'),
      ),
      summary,
      title,
      url,
    };
  }

  private isFeed(xml: string) {
    return (
      /<(?:[\w-]+:)?rss\b/i.test(xml) ||
      /<(?:[\w-]+:)?feed\b/i.test(xml) ||
      /<(?:[\w-]+:)?channel\b/i.test(xml)
    );
  }

  private itemBlocks(xml: string) {
    return Array.from(
      xml.matchAll(
        /<(?:[\w-]+:)?(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?(?:item|entry)>/gi,
      ),
      (match) => match[1] ?? '',
    );
  }

  private elementText(xml: string, elements: string) {
    const match = xml.match(
      new RegExp(
        `<(?:[\\w-]+:)?(?:${elements})\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?(?:${elements})>`,
        'i',
      ),
    );
    return match ? this.text(match[1] ?? '') : null;
  }

  private linkFrom(xml: string) {
    const href = xml.match(
      /<(?:[\w-]+:)?link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i,
    );
    if (href?.[1]) return href[1];
    return this.elementText(xml, 'link');
  }

  private feedUrl(value: string | null) {
    if (!value) return null;
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  private date(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  private text(value: string) {
    const normalized = value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return normalized ? normalized.slice(0, 5_000) : null;
  }

  private isPublicAddress(address: string, family: number) {
    if (family === 4) return this.isPublicIpv4(address);
    if (family !== 6) return false;

    const normalized = address.toLowerCase();
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('ff')
    )
      return false;
    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mappedIpv4 ? this.isPublicIpv4(mappedIpv4) : true;
  }

  private isPublicIpv4(address: string) {
    const octets = address.split('.').map(Number);
    if (
      octets.length !== 4 ||
      octets.some(
        (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
      )
    )
      return false;
    const [first, second] = octets;
    if (first === undefined || second === undefined) return false;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }
}
