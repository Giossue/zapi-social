import type { SupportedLocale } from '@workspace/contracts';
import type { EmailCopyOverride } from './email-copy';
import { emailChrome } from './email-chrome';
import { zapiEmailTemplate } from './email-template';

export type TeamOwnershipTransferredEmailInput = {
  workspaceName: string;
  recipientName: string;
  counterpartName: string;
  perspective: 'new-owner' | 'previous-owner';
  teamsUrl: string;
};

export function teamOwnershipTransferredEmail(
  input: TeamOwnershipTransferredEmailInput,
  copy: EmailCopyOverride,
  locale: SupportedLocale,
) {
  const chrome = emailChrome(locale);
  const isNewOwner = input.perspective === 'new-owner';
  return zapiEmailTemplate({
    locale,
    preview: copy.preview,
    title: copy.title,
    description: copy.body,
    details: [
      { label: chrome.space, value: input.workspaceName },
      {
        label: isNewOwner ? chrome.newRole : chrome.yourNewRole,
        value: isNewOwner ? chrome.owner : chrome.admin,
      },
    ],
    action: copy.actionLabel
      ? { label: copy.actionLabel, url: input.teamsUrl }
      : undefined,
    notice: copy.notice ?? undefined,
  });
}
