import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Injectable } from '@nestjs/common';
import type { PortalRssFeedValidation } from '@workspace/contracts';

const feedTimeoutMilliseconds = 8_000;
const maxFeedBytes = 1_000_000;
const maxSampleItems = 5;

@Injectable()
export class RssFeedValidationService {
  async preview(feedUrl: string): Promise<PortalRssFeedValidation | null> {
    try {
      const url = new URL(feedUrl);
      const xml = await this.download(url);
      return this.parse(xml);
    } catch {
      return null;
    }
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
          'user-agent': 'ZapiSocial-RSS-Validator/1.0',
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

  private parse(xml: string): PortalRssFeedValidation | null {
    if (!this.isFeed(xml)) return null;
    const channel =
      this.elementBlock(xml, 'channel') ??
      this.elementBlock(xml, 'feed') ??
      xml;
    const items = this.itemBlocks(xml).slice(0, maxSampleItems);

    return {
      description: this.elementText(channel, 'description|subtitle|tagline'),
      itemCount: items.length,
      sampleItems: items.map((item) => ({
        guid: this.elementText(item, 'guid|id'),
        publishedAt: this.isoDate(
          this.elementText(item, 'pubDate|published|updated|date'),
        ),
        title: this.elementText(item, 'title'),
        url: this.feedUrl(this.linkFrom(item)),
      })),
      title: this.elementText(channel, 'title'),
      websiteUrl: this.feedUrl(this.linkFrom(channel)),
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

  private elementBlock(xml: string, element: string) {
    const match = xml.match(
      new RegExp(
        `<(?:[\\w-]+:)?${element}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${element}>`,
        'i',
      ),
    );
    return match?.[1] ?? null;
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

  private isoDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
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
    return normalized ? normalized.slice(0, 500) : null;
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
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet)))
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
