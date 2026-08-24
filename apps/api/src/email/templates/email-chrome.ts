import type { SupportedLocale } from '@workspace/contracts';

export type EmailChrome = {
  space: string;
  role: string;
  newRole: string;
  yourNewRole: string;
  email: string;
  availableAccounts: string;
  availableUntil: string;
  owner: string;
  admin: string;
  member: string;
  allAccounts: string;
  accountCount: (count: number) => string;
  footer: string;
};

const CHROME: Record<SupportedLocale, EmailChrome> = {
  es: {
    space: 'Espacio',
    role: 'Rol',
    newRole: 'Rol nuevo',
    yourNewRole: 'Tu rol nuevo',
    email: 'Correo',
    availableAccounts: 'Cuentas disponibles',
    availableUntil: 'Disponible hasta',
    owner: 'Propietario',
    admin: 'Administrador',
    member: 'Miembro',
    allAccounts: 'Todas',
    accountCount: (count) => (count === 1 ? '1 cuenta' : `${count} cuentas`),
    footer: 'Correo transaccional enviado automáticamente por Zapi.',
  },
  en: {
    space: 'Workspace',
    role: 'Role',
    newRole: 'New role',
    yourNewRole: 'Your new role',
    email: 'Email',
    availableAccounts: 'Available accounts',
    availableUntil: 'Available until',
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    allAccounts: 'All',
    accountCount: (count) => (count === 1 ? '1 account' : `${count} accounts`),
    footer: 'Transactional email sent automatically by Zapi.',
  },
};

export function emailChrome(locale: SupportedLocale): EmailChrome {
  return CHROME[locale];
}

export function teamRoleLabel(
  role: 'admin' | 'member',
  chrome: EmailChrome,
): string {
  return role === 'admin' ? chrome.admin : chrome.member;
}
