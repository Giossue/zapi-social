import { icuMismatch } from './languages.service';

describe('icuMismatch', () => {
  it('accepts equal arguments in any order', () => {
    expect(
      icuMismatch('Hola {name}, tienes {count}', '{count} for you, {name}'),
    ).toBe(false);
  });

  it('rejects a missing argument', () => {
    expect(icuMismatch('Abrir acciones para {name}', 'Open actions')).toBe(
      true,
    );
  });

  it('rejects an extra argument', () => {
    expect(icuMismatch('Guardar', 'Save {name}')).toBe(true);
  });

  it('rejects a plural downgraded to plain text', () => {
    expect(
      icuMismatch(
        '{count, plural, one {# día} other {# días}}',
        '{count} days',
      ),
    ).toBe(true);
  });

  it('accepts a translated plural with reordered branches', () => {
    expect(
      icuMismatch(
        '{count, plural, one {# día} other {# días}}',
        '{count, plural, other {# days} one {# day}}',
      ),
    ).toBe(false);
  });

  it('accepts plain text', () => {
    expect(icuMismatch('Guardar', 'Enregistrer')).toBe(false);
  });
});
