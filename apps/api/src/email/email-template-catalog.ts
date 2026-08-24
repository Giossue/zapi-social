import type { EmailTemplateKey, SupportedLocale } from '@workspace/contracts';

export type EmailTemplateCopy = {
  subject: string;
  preview: string;
  title: string;
  body: string;
  actionLabel: string | null;
  notice: string | null;
};

type CatalogEntry = {
  name: string;
  description: string;
  copy: Record<SupportedLocale, EmailTemplateCopy>;
  variables: { token: string; description: string }[];
};

export const EMAIL_TEMPLATE_CATALOG: Record<EmailTemplateKey, CatalogEntry> = {
  password_reset: {
    name: 'Restablecer contraseña',
    description: 'Se envía al pedir un enlace de recuperación.',
    copy: {
      es: {
        preview: 'Usa este enlace para restablecer tu contraseña de Zapi.',
        subject: 'Restablece tu contraseña de Zapi',
        title: 'Restablece tu contraseña',
        body: 'Recibimos una solicitud para cambiar la contraseña de tu cuenta Zapi.',
        actionLabel: 'Restablecer contraseña',
        notice:
          'Este enlace vence en 60 minutos y solo puede usarse una vez. Si no solicitaste el cambio, ignora este correo.',
      },
      en: {
        preview: 'Use this link to reset your Zapi password.',
        subject: 'Reset your Zapi password',
        title: 'Reset your password',
        body: 'We received a request to change the password of your Zapi account.',
        actionLabel: 'Reset password',
        notice:
          "This link expires in 60 minutes and can only be used once. If you didn't request the change, ignore this email.",
      },
    },
    variables: [],
  },
  team_invitation: {
    name: 'Invitación a un equipo',
    description: 'Se envía a quien recibe una invitación al espacio.',
    copy: {
      es: {
        preview: '{{inviterName}} te invitó a {{workspaceName}}.',
        subject: 'Invitación a {{workspaceName}} en Zapi',
        title: 'Te invitaron a un espacio de trabajo',
        body: '{{inviterName}} quiere que formes parte de {{workspaceName}} en Zapi.',
        actionLabel: 'Revisar invitación',
        notice:
          'El enlace es privado, está vinculado a este correo y solo puede utilizarse una vez.',
      },
      en: {
        preview: '{{inviterName}} invited you to {{workspaceName}}.',
        subject: 'Invitation to {{workspaceName}} on Zapi',
        title: 'You were invited to a workspace',
        body: '{{inviterName}} wants you to join {{workspaceName}} on Zapi.',
        actionLabel: 'Review invitation',
        notice:
          'The link is private, tied to this email address and can only be used once.',
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{inviterName}}', description: 'Quien invita' },
      { token: '{{role}}', description: 'Rol asignado' },
      { token: '{{expiresLabel}}', description: 'Fecha de vencimiento' },
    ],
  },
  team_invitation_accepted: {
    name: 'Invitación aceptada',
    description: 'Avisa a quien invitó que la persona ya entró.',
    copy: {
      es: {
        preview: '{{memberName}} aceptó tu invitación a {{workspaceName}}.',
        subject: '{{memberName}} aceptó tu invitación',
        title: 'Invitación aceptada',
        body: '{{memberName}} ya forma parte de {{workspaceName}}.',
        actionLabel: 'Administrar equipo',
        notice: null,
      },
      en: {
        preview:
          '{{memberName}} accepted your invitation to {{workspaceName}}.',
        subject: '{{memberName}} accepted your invitation',
        title: 'Invitation accepted',
        body: '{{memberName}} is now part of {{workspaceName}}.',
        actionLabel: 'Manage team',
        notice: null,
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{memberName}}', description: 'Quien aceptó' },
      { token: '{{memberEmail}}', description: 'Correo de quien aceptó' },
      { token: '{{role}}', description: 'Rol asignado' },
    ],
  },
  team_access_updated: {
    name: 'Acceso actualizado',
    description: 'Avisa de un cambio de rol o de cuentas disponibles.',
    copy: {
      es: {
        preview: 'Tu acceso a {{workspaceName}} fue actualizado.',
        subject: 'Tu acceso a {{workspaceName}} fue actualizado',
        title: 'Tu acceso al equipo cambió',
        body: '{{actorName}} actualizó el acceso de {{recipientName}} en Zapi.',
        actionLabel: 'Ver mi acceso',
        notice:
          'Si no reconoces este cambio, contacta al propietario del espacio de trabajo.',
      },
      en: {
        preview: 'Your access to {{workspaceName}} was updated.',
        subject: 'Your access to {{workspaceName}} was updated',
        title: 'Your team access changed',
        body: "{{actorName}} updated {{recipientName}}'s access on Zapi.",
        actionLabel: 'View my access',
        notice:
          "If you don't recognize this change, contact the workspace owner.",
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{actorName}}', description: 'Quien hizo el cambio' },
      { token: '{{role}}', description: 'Rol resultante' },
    ],
  },
  team_member_removed: {
    name: 'Acceso retirado',
    description: 'Avisa a quien fue retirado de un espacio.',
    copy: {
      es: {
        preview: 'Tu acceso a {{workspaceName}} fue retirado.',
        subject: 'Tu acceso a {{workspaceName}} fue retirado',
        title: 'Ya no formas parte del espacio',
        body: '{{actorName}} retiró el acceso de {{recipientName}} a {{workspaceName}}.',
        actionLabel: 'Abrir Zapi',
        notice:
          'Tus otros espacios de trabajo y tu cuenta personal no fueron modificados.',
      },
      en: {
        preview: 'Your access to {{workspaceName}} was revoked.',
        subject: 'Your access to {{workspaceName}} was revoked',
        title: "You're no longer part of the workspace",
        body: "{{actorName}} revoked {{recipientName}}'s access to {{workspaceName}}.",
        actionLabel: 'Open Zapi',
        notice:
          'Your other workspaces and your personal account were not changed.',
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{actorName}}', description: 'Quien retiró el acceso' },
    ],
  },
  team_ownership_new_owner: {
    name: 'Propiedad recibida',
    description: 'Avisa a quien pasa a ser propietario del espacio.',
    copy: {
      es: {
        preview: 'Ahora eres propietario de {{workspaceName}}.',
        subject: 'Ahora eres propietario de {{workspaceName}}',
        title: 'Ahora eres propietario del espacio',
        body: '{{counterpartName}} te transfirió la propiedad de {{workspaceName}}.',
        actionLabel: 'Administrar equipo',
        notice: null,
      },
      en: {
        preview: "You're now the owner of {{workspaceName}}.",
        subject: "You're now the owner of {{workspaceName}}",
        title: "You're now the workspace owner",
        body: '{{counterpartName}} transferred the ownership of {{workspaceName}} to you.',
        actionLabel: 'Manage team',
        notice: null,
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{counterpartName}}', description: 'La otra parte' },
    ],
  },
  team_ownership_previous_owner: {
    name: 'Propiedad transferida',
    description: 'Confirma a quien cedió la propiedad del espacio.',
    copy: {
      es: {
        preview: 'La propiedad de {{workspaceName}} fue transferida.',
        subject: 'Transferiste la propiedad de {{workspaceName}}',
        title: 'Transferiste la propiedad del espacio',
        body: 'Ahora {{counterpartName}} es propietario de {{workspaceName}}.',
        actionLabel: 'Administrar equipo',
        notice: null,
      },
      en: {
        preview: 'The ownership of {{workspaceName}} was transferred.',
        subject: 'You transferred the ownership of {{workspaceName}}',
        title: 'You transferred the workspace ownership',
        body: '{{counterpartName}} is now the owner of {{workspaceName}}.',
        actionLabel: 'Manage team',
        notice: null,
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{counterpartName}}', description: 'La otra parte' },
    ],
  },
  board_task_assigned: {
    name: 'Tarea asignada',
    description: 'Avisa a quien recibe una tarjeta del tablero.',
    copy: {
      es: {
        preview: '{{actorName}} te asignó «{{taskTitle}}».',
        subject: 'Te asignaron «{{taskTitle}}»',
        title: 'Tienes una tarea nueva',
        body: '{{actorName}} te asignó «{{taskTitle}}» en el tablero de {{workspaceName}}.',
        actionLabel: 'Abrir la tarea',
        notice: null,
      },
      en: {
        preview: '{{actorName}} assigned you “{{taskTitle}}”.',
        subject: 'You were assigned “{{taskTitle}}”',
        title: 'You have a new task',
        body: '{{actorName}} assigned you “{{taskTitle}}” on the {{workspaceName}} board.',
        actionLabel: 'Open the task',
        notice: null,
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{actorName}}', description: 'Quien asignó la tarea' },
      { token: '{{taskTitle}}', description: 'Título de la tarea' },
    ],
  },
  board_task_due_soon: {
    name: 'Tarea por vencer',
    description: 'Recuerda una tarjeta del tablero que vence mañana.',
    copy: {
      es: {
        preview: '«{{taskTitle}}» vence {{dueLabel}}.',
        subject: '«{{taskTitle}}» vence pronto',
        title: 'Una tarea tuya está por vencer',
        body: '«{{taskTitle}}» vence {{dueLabel}} en el tablero de {{workspaceName}}.',
        actionLabel: 'Abrir la tarea',
        notice: 'Recibes este aviso una vez, el día antes del vencimiento.',
      },
      en: {
        preview: '“{{taskTitle}}” is due {{dueLabel}}.',
        subject: '“{{taskTitle}}” is due soon',
        title: 'One of your tasks is due soon',
        body: '“{{taskTitle}}” is due {{dueLabel}} on the {{workspaceName}} board.',
        actionLabel: 'Open the task',
        notice: 'You get this reminder once, the day before it is due.',
      },
    },
    variables: [
      { token: '{{workspaceName}}', description: 'Nombre del espacio' },
      { token: '{{recipientName}}', description: 'Quien recibe el correo' },
      { token: '{{taskTitle}}', description: 'Título de la tarea' },
      { token: '{{dueLabel}}', description: 'Fecha de vencimiento' },
    ],
  },
};
