/**
 * Textos que llegan resueltos desde el catálogo. Asunto, título, cuerpo, botón
 * y aviso son personalizables desde `/admin/email-templates`; la vista previa
 * no lo es, pero sí sigue el idioma del destinatario.
 */
export type EmailCopyOverride = {
  preview: string;
  title: string;
  body: string;
  actionLabel: string | null;
  notice: string | null;
};
