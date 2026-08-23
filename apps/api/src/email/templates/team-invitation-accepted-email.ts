import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome, teamRoleLabel } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type TeamInvitationAcceptedEmailInput = {
  workspaceName: string;
  memberName: string;
  memberEmail: string;
  role: 'admin' | 'member';
  teamsUrl: string;
};

export function teamInvitationAcceptedEmail(
  input: TeamInvitationAcceptedEmailInput,
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
      { label: chrome.email, value: input.memberEmail },
      { label: chrome.role, value: teamRoleLabel(input.role, chrome) },
    ],
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.teamsUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
