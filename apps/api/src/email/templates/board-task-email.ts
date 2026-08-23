import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type BoardTaskEmailInput = {
  workspaceName: string;
  taskTitle: string;
  taskUrl: string;
  /** Fecha ya formateada en el idioma del destinatario. */
  dueLabel?: string;
};

/**
 * Sirve tanto para la asignación como para el vencimiento: el marco es el
 * mismo y lo que cambia es el texto, que viene del catálogo y es editable
 * desde Admin.
 */
export function boardTaskEmail(
  input: BoardTaskEmailInput,
  copy: EmailCopyOverride,
  locale: SupportedLocale,
) {
  const chrome = emailChrome(locale);
  return zapiEmailTemplate({
    locale,
    preview: copy.preview,
    title: copy.title,
    description: copy.body,
    details: [
      { label: chrome.space, value: input.workspaceName },
      ...(input.dueLabel
        ? [{ label: chrome.availableUntil, value: input.dueLabel }]
        : []),
    ],
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.taskUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
