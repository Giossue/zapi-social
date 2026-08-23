import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { zapiEmailTemplate } from './email-template';

export function passwordResetEmail(
  resetUrl: string,
  copy: EmailCopyOverride,
  locale: SupportedLocale,
) {
  return zapiEmailTemplate({
    locale,
    preview: copy.preview,
    title: copy.title,
    description: copy.body,
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: resetUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
