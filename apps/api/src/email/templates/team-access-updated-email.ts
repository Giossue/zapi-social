import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome, teamRoleLabel } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type TeamAccessUpdatedEmailInput = {
  workspaceName: string;
  recipientName: string;
  actorName: string;
  role: 'admin' | 'member';
  accountCount: number | null;
  teamsUrl: string;
};

export function teamAccessUpdatedEmail(
  input: TeamAccessUpdatedEmailInput,
  copy: EmailCopyOverride,
  locale: SupportedLocale,
) {
  const chrome = emailChrome(locale);
  const details = [
    { label: chrome.space, value: input.workspaceName },
    { label: chrome.role, value: teamRoleLabel(input.role, chrome) },
  ];
  if (input.accountCount !== null) {
    details.push({
      label: chrome.availableAccounts,
      value: chrome.accountCount(input.accountCount),
    });
  }

  return zapiEmailTemplate({
    locale,
    preview: copy.preview,
    title: copy.title,
    description: copy.body,
    details,
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.teamsUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
