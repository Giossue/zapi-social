import {
  channelProviderCatalog,
  channelProviderValuesSchema,
} from '@workspace/contracts';

describe('channel provider catalogue', () => {
  it('derives the validator from the declared fields', () => {
    const schema = channelProviderValuesSchema('linkedin');

    expect(
      schema.safeParse({
        clientId: 'abc',
        clientSecret: 'shh',
        apiVersion: '202607',
      }).success,
    ).toBe(true);

    // Falta un campo obligatorio.
    expect(
      schema.safeParse({ clientId: 'abc', clientSecret: 'shh' }).success,
    ).toBe(false);

    // `callbackUrl` lo calcula el servidor: no se acepta desde fuera.
    expect(
      schema.safeParse({
        clientId: 'abc',
        clientSecret: 'shh',
        apiVersion: '202607',
        callbackUrl: 'https://atacante.example/callback',
      }).success,
    ).toBe(false);
  });

  it('respects the declared maximum length', () => {
    const schema = channelProviderValuesSchema('x');

    expect(
      schema.safeParse({ clientId: 'a'.repeat(129), clientSecret: 'shh' })
        .success,
    ).toBe(false);
  });

  it('covers every catalogued provider with a usable form', () => {
    for (const provider of channelProviderCatalog) {
      // Sin campo obligatorio no habría nada que configurar y la integración
      // quedaría lista sin credenciales.
      expect(provider.fields.some((field) => field.required)).toBe(true);
      // Un secreto en claro se vería en la respuesta de la API.
      expect(
        provider.fields.some(
          (field) => field.key.toLowerCase().includes('secret') === false,
        ),
      ).toBe(true);
      expect(
        provider.fields
          .filter((field) => field.key.toLowerCase().includes('secret'))
          .every((field) => field.type === 'secret'),
      ).toBe(true);
    }
  });
});
