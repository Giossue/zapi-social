import {
  channelCapability,
  channelCapabilityCatalog,
  channelProvider,
  validateChannelMedia,
} from '@workspace/contracts';
import { ChannelPublisherRegistry } from './channel-publisher.registry';
import type { ChannelPublisher } from './channel-publisher';

const image = { mimeType: 'image/jpeg' };
const video = { mimeType: 'video/mp4' };

function publisherFor(
  capabilityKey: ChannelPublisher['capabilityKey'],
): ChannelPublisher {
  return {
    capabilityKey,
    publish: () =>
      Promise.resolve({ providerRequestId: capabilityKey, response: {} }),
  };
}

describe('channel publisher registry', () => {
  it('resolves a publisher by capability and ignores an unknown one', () => {
    const registry = new ChannelPublisherRegistry([
      publisherFor('facebook_page'),
      publisherFor('instagram_profile'),
    ]);

    expect(registry.find('facebook_page')?.capabilityKey).toBe('facebook_page');
    expect(registry.find('linkedin_page')).toBeUndefined();
    expect(registry.capabilities()).toEqual([
      'facebook_page',
      'instagram_profile',
    ]);
  });
});

describe('channel media rules', () => {
  it('keeps every catalogued capability pointing at a known provider', () => {
    for (const capability of channelCapabilityCatalog) {
      expect(channelProvider(capability.providerKey)).toBeDefined();
      // El primer destino es el que usa la interfaz por defecto: tiene que
      // tener regla propia.
      expect(
        capability.mediaRules.some(
          (rule) => rule.destination === capability.destinations[0],
        ),
      ).toBe(true);
    }
  });

  it('applies the Facebook feed rules taken from the Graph API', () => {
    expect(validateChannelMedia('facebook_page', 'feed', [])).toBeNull();
    expect(
      validateChannelMedia('facebook_page', 'feed', [image, image]),
    ).toBeNull();
    // El Feed no admite mezclar foto y vídeo…
    expect(validateChannelMedia('facebook_page', 'feed', [image, video])).toBe(
      'mixedNotAllowed',
    );
    // …ni más de un vídeo, aunque no haya fotos de por medio.
    expect(validateChannelMedia('facebook_page', 'feed', [video, video])).toBe(
      'tooManyVideos',
    );
  });

  it('requires exactly one item on Instagram and on WhatsApp status', () => {
    expect(validateChannelMedia('instagram_profile', 'feed', [])).toBe(
      'tooFewItems',
    );
    expect(
      validateChannelMedia('instagram_profile', 'feed', [image, image]),
    ).toBe('tooManyItems');
    expect(
      validateChannelMedia('instagram_profile', 'feed', [video]),
    ).toBeNull();
    expect(
      validateChannelMedia('whatsapp_status', 'status', [image]),
    ).toBeNull();
  });

  it('lets LinkedIn post text alone but not two videos', () => {
    expect(validateChannelMedia('linkedin_page', 'feed', [])).toBeNull();
    expect(
      validateChannelMedia('linkedin_profile', 'feed', [image]),
    ).toBeNull();
    expect(validateChannelMedia('linkedin_page', 'feed', [video, video])).toBe(
      'tooManyVideos',
    );
  });

  it('splits TikTok into a video destination and a photo one', () => {
    expect(validateChannelMedia('tiktok_profile', 'video', [video])).toBeNull();
    // Una foto no vale para el destino de vídeo, y al revés tampoco.
    expect(validateChannelMedia('tiktok_profile', 'video', [image])).toBe(
      'imagesNotAllowed',
    );
    expect(validateChannelMedia('tiktok_profile', 'photo', [video])).toBe(
      'videosNotAllowed',
    );
  });

  it('caps X at four images or a single video', () => {
    expect(
      validateChannelMedia('x_profile', 'feed', [image, image, image, image]),
    ).toBeNull();
    expect(
      validateChannelMedia('x_profile', 'feed', [
        image,
        image,
        image,
        image,
        image,
      ]),
    ).toBe('tooManyItems');
  });

  it('rejects a destination the capability does not declare', () => {
    expect(validateChannelMedia('facebook_page', 'stories', [image])).toBe(
      'destinationUnsupported',
    );
    expect(channelCapability('linkedin_page')).toBeDefined();
  });
});
