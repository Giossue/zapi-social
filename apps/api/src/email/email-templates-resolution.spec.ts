import { EmailTemplatesService } from './email-templates.service';
import type { DatabaseService } from '../database/database.service';

type Row = {
  key: string;
  locale: string;
  subject: string;
  title: string;
  description: string;
  actionLabel: string | null;
  notice: string | null;
  isActive: boolean;
};

function row(locale: string, subject: string, isActive = true): Row {
  return {
    key: 'password_reset',
    locale,
    subject,
    title: subject,
    description: subject,
    actionLabel: null,
    notice: null,
    isActive,
  };
}

function serviceWith(rows: Row[]) {
  const database = {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      }),
    },
  } as unknown as DatabaseService;
  return new EmailTemplatesService(database);
}

describe('EmailTemplatesService.resolve', () => {
  it('usa el idioma del destinatario cuando tiene su propia versión', async () => {
    const service = serviceWith([row('*', 'GLOBAL'), row('de', 'ALEMAN')]);
    const copy = await service.resolve('password_reset', {}, 'de');
    expect(copy.subject).toBe('ALEMAN');
  });

  it('cae al texto por defecto cuando el idioma no tiene versión propia', async () => {
    const service = serviceWith([row('*', 'GLOBAL')]);
    const copy = await service.resolve('password_reset', {}, 'fr');
    expect(copy.subject).toBe('GLOBAL');
  });

  it('el texto por defecto gana al catálogo incluido', async () => {
    const service = serviceWith([row('*', 'GLOBAL')]);
    const copy = await service.resolve('password_reset', {}, 'en');
    expect(copy.subject).toBe('GLOBAL');
  });

  it('sin nada guardado usa el catálogo del idioma pedido', async () => {
    const service = serviceWith([]);
    const english = await service.resolve('password_reset', {}, 'en');
    const spanish = await service.resolve('password_reset', {}, 'es');
    expect(english.subject).not.toBe(spanish.subject);
  });

  it('un idioma desconocido sin texto por defecto cae al catálogo base', async () => {
    const service = serviceWith([]);
    const unknown = await service.resolve('password_reset', {}, 'fr');
    const spanish = await service.resolve('password_reset', {}, 'es');
    expect(unknown.subject).toBe(spanish.subject);
  });

  it('ignora una versión desactivada y sigue la cascada', async () => {
    const service = serviceWith([
      row('*', 'GLOBAL'),
      row('de', 'ALEMAN', false),
    ]);
    const copy = await service.resolve('password_reset', {}, 'de');
    expect(copy.subject).toBe('GLOBAL');
  });
});
