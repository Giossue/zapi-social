import {
  aiRequestInputSchemas,
  aiRequestResultSchemas,
} from '@workspace/contracts';
import {
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
});
