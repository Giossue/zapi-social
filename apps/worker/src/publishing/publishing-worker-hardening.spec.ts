import { sanitizeProviderResponse } from './publishing-delivery.processor';
import { wrapTextLines } from './publishing-media-preparation.service';

describe('publishing worker hardening', () => {
  it('persists only allowlisted provider response fields', () => {
    expect(
      sanitizeProviderResponse(
        {
          access_token: 'must-not-be-persisted',
          code: 'SUCCESS',
          message_id: 'message-1',
          nested: { secret: true },
          post_id: 'post-1',
          status: 'sent',
        },
        'request-1',
      ),
    ).toEqual({
      providerCode: 'SUCCESS',
      providerMessageId: 'message-1',
      providerPostId: 'post-1',
      providerRequestId: 'request-1',
      status: 'sent',
    });
  });

  it('bounds allowlisted provider strings before persistence', () => {
    const response = sanitizeProviderResponse(
      { code: 'x'.repeat(5000) },
      'r'.repeat(5000),
    );

    expect(String(response.providerRequestId)).toHaveLength(2048);
    expect(String(response.providerCode)).toHaveLength(256);
  });

  it('wraps and truncates watermark text within the configured limits', () => {
    const lines = wrapTextLines(
      'Una marca de agua demasiado larga para una sola línea',
      12,
      3,
    );

    expect(lines).toHaveLength(3);
    expect(lines.every((line) => Array.from(line).length <= 12)).toBe(true);
    expect(lines[2]?.endsWith('…')).toBe(true);
  });

  it('splits long unbroken text without exceeding the frame estimate', () => {
    expect(wrapTextLines('abcdefghijklmnop', 5, 2)).toEqual(['abcde', 'fghi…']);
  });
});
