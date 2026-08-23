import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type TeamMemberRemovedEmailInput = {
  workspaceName: string;
  recipientName: string;
  actorName: string;
  portalUrl: string;
};

export function teamMemberRemovedEmail(
  input: TeamMemberRemovedEmailInput,
  copy: EmailCopyOverride,
  locale: SupportedLocale,
) {
  const chrome = emailChrome(locale);
  return zapiEmailTemplate({
    locale,
    preview: copy.preview,
    title: copy.title,
    description: copy.body,
    details: [{ label: chrome.space, value: input.workspaceName }],
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.portalUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
