import {
  aiRequestInputSchemas,
  aiRequestResultSchemas,
} from '@workspace/contracts';
import {
  buildAtlasImagePayload,
  buildAtlasVideoPayload,
  extractResponseText,
  localDateParts,
  parseJson,
} from './ai-request.processor';

describe('AI request processing helpers', () => {
  it('extracts text from a Responses API payload', () => {
    expect(
      extractResponseText({
        output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      }),
    ).toBe('{"ok":true}');
  });

  it('parses fenced JSON but rejects non-object output', () => {
    expect(parseJson('```json\n{"summary":"listo"}\n```')).toEqual({
      summary: 'listo',
    });
    expect(parseJson('[1,2,3]')).toBeNull();
    expect(parseJson('no es json')).toBeNull();
  });

  it('keeps request inputs strict and validates typed results', () => {
    expect(
      aiRequestInputSchemas.video.safeParse({
        objective: 'mostrar producto',
        aspectRatio: '9:16',
        durationSeconds: 8,
        referenceAssetIds: [],
      }).success,
    ).toBe(true);
    expect(
      aiRequestInputSchemas.video.safeParse({
        objective: 'mostrar producto',
        aspectRatio: '9:16',
        durationSeconds: 15,
        referenceAssetIds: [],
      }).success,
    ).toBe(false);
    expect(
      aiRequestResultSchemas.review.safeParse({
        score: 120,
        verdict: 'inválido',
        dimensions: {
          clarity: 90,
          brandVoice: 90,
          callToAction: 90,
          safety: 90,
        },
        strengths: [],
        risks: [],
        corrections: [],
        revisedContent: '',
      }).success,
    ).toBe(false);
  });

  it('calculates local weekday and hour with an IANA timezone', () => {
    expect(
      localDateParts(new Date('2026-08-09T15:00:00.000Z'), 'America/Guayaquil'),
    ).toEqual({ weekday: 0, hour: 10 });
  });

  it('builds AtlasCloud image payloads for text and references', () => {
    expect(
      buildAtlasImagePayload(
        'openai/gpt-image-2/text-to-image',
        {
          prompt: 'Producto sobre una mesa',
          input: { aspectRatio: '16:9', quality: 'high' },
        },
        [],
      ),
    ).toMatchObject({
      model: 'openai/gpt-image-2/text-to-image',
      size: '2560x1440',
      quality: 'high',
      enable_sync_mode: false,
    });
    expect(
      buildAtlasImagePayload(
        'google/nano-banana-2/edit',
        {
          prompt: 'Cambia el fondo',
          input: { aspectRatio: '1:1', quality: 'medium' },
        },
        ['data:image/png;base64,AAAA'],
      ),
    ).toMatchObject({
      images: ['data:image/png;base64,AAAA'],
      aspect_ratio: '1:1',
      resolution: '2k',
    });
  });

  it('maps AtlasCloud video references by configured model mode', () => {
    expect(
      buildAtlasVideoPayload(
        'bytedance/seedance-2.0/image-to-video',
        {
          prompt: 'Movimiento suave',
          input: { aspectRatio: '9:16', durationSeconds: 8 },
        },
        ['first', 'last'],
      ),
    ).toMatchObject({ image: 'first', last_image: 'last', ratio: '9:16' });
    expect(
      buildAtlasVideoPayload(
        'bytedance/seedance-2.0/reference-to-video',
        {
          prompt: 'Mantén el personaje',
          input: { aspectRatio: '1:1', durationSeconds: 12 },
        },
        ['one', 'two', 'three'],
      ),
    ).toMatchObject({
      reference_images: ['one', 'two', 'three'],
      ratio: '1:1',
      duration: 12,
    });
  });
});
