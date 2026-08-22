/** Textos que un administrador puede sobrescribir desde `/admin/email-templates`. */
export type EmailCopyOverride = {
  title: string;
  body: string;
  actionLabel: string | null;
  notice: string | null;
};
