import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome, teamRoleLabel } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type TeamInvitationEmailInput = {
  invitationUrl: string;
  workspaceName: string;
  inviterName: string;
  role: 'admin' | 'member';
  expiresLabel: string;
};

export function teamInvitationEmail(
  input: TeamInvitationEmailInput,
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
      { label: chrome.role, value: teamRoleLabel(input.role, chrome) },
      { label: chrome.availableUntil, value: input.expiresLabel },
    ],
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.invitationUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
