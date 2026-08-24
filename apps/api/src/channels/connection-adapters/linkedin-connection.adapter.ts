import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';

export type ConnectionCandidate = {
  externalId: string;
  displayName: string;
  description: string;
  publicMetadata: Record<string, string>;
  context: { accessToken: string; avatarUrl?: string };
};

/**
 * Lo que cambia de una red a otra al conectar una cuenta. El resto —la sesión,
 * la tabla de candidatos, la selección y el guardado— ya es común.
 */
export interface ChannelConnectionAdapter {
  readonly providerKey: string;
  scopesFor(capabilityKey: PortalChannelCapabilityKey): string[];
  exchangeCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<string>;
  fetchCandidates(input: {
    accessToken: string;
    capabilityKey: PortalChannelCapabilityKey;
    apiVersion: string;
  }): Promise<ConnectionCandidate[]>;
}

const restBase = 'https://api.linkedin.com/rest';

/**
 * Conexión de cuentas de LinkedIn.
 *
 * Un perfil sale de `/v2/userinfo`, que es OpenID Connect y devuelve el `sub`
 * como identificador de persona. Una página sale de `organizationAcls`, que
 * lista las organizaciones donde quien autoriza es administrador aprobado; la
 * respuesta trae el rol pero no el nombre, así que hay que resolverlo aparte.
 */
@Injectable()
export class LinkedInConnectionAdapter implements ChannelConnectionAdapter {
  readonly providerKey = 'linkedin';

  scopesFor(capabilityKey: PortalChannelCapabilityKey): string[] {
    // Publicar como persona y como página son permisos distintos, y LinkedIn
    // obliga a aceptarlos todos de una vez: se piden solo los que hagan falta.
    return capabilityKey === 'linkedin_page'
      ? ['openid', 'profile', 'w_member_social', 'r_organization_admin']
      : ['openid', 'profile', 'w_member_social'];
  }

  async exchangeCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
  }: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<string> {
    const response = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          // Tiene que ser idéntica a la del paso anterior o LinkedIn responde
          // `invalid_redirect_uri`.
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body: unknown = await response.json().catch(() => null);
    const accessToken =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).access_token
        : null;
    if (!response.ok || typeof accessToken !== 'string' || !accessToken) {
      throw new ServiceUnavailableException();
    }
    return accessToken;
  }

  async fetchCandidates({
    accessToken,
    capabilityKey,
    apiVersion,
  }: {
    accessToken: string;
    capabilityKey: PortalChannelCapabilityKey;
    apiVersion: string;
  }): Promise<ConnectionCandidate[]> {
    return capabilityKey === 'linkedin_page'
      ? this.organizations(accessToken, apiVersion)
      : this.member(accessToken);
  }

  private async member(accessToken: string): Promise<ConnectionCandidate[]> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await this.json(response);
    const id = this.text(body, 'sub');
    const name = this.text(body, 'name');
    if (!id) throw new ServiceUnavailableException();

    return [
      {
        externalId: id,
        displayName: name ?? id,
        description: 'linkedin_profile',
        publicMetadata: { kind: 'linkedin_profile' },
        context: {
          accessToken,
          avatarUrl: this.text(body, 'picture') ?? undefined,
        },
      },
    ];
  }

  private async organizations(
    accessToken: string,
    apiVersion: string,
  ): Promise<ConnectionCandidate[]> {
    const url = new URL(`${restBase}/organizationAcls`);
    url.search = new URLSearchParams({
      q: 'roleAssignee',
      role: 'ADMINISTRATOR',
      state: 'APPROVED',
    }).toString();

    const response = await fetch(url, {
      headers: this.headers(accessToken, apiVersion),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await this.json(response);
    const elements = Array.isArray(body.elements) ? body.elements : [];

    const urns = elements.flatMap((element) => {
      if (typeof element !== 'object' || element === null) return [];
      const record = element as Record<string, unknown>;
      // La documentación usa `organization` en unos ejemplos y
      // `organizationTarget` en otros; se aceptan los dos.
      const urn = record.organizationTarget ?? record.organization;
      return typeof urn === 'string' ? [urn] : [];
    });

    return Promise.all(
      urns.map(async (urn) => {
        const id = urn.split(':').pop() ?? urn;
        return {
          externalId: id,
          displayName:
            (await this.organizationName(accessToken, apiVersion, id)) ?? id,
          description: 'linkedin_page',
          publicMetadata: { kind: 'linkedin_page' },
          context: { accessToken },
        };
      }),
    );
  }

  /** Si el nombre no se puede resolver se usa el identificador: no vale fallar por eso. */
  private async organizationName(
    accessToken: string,
    apiVersion: string,
    id: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${restBase}/organizations/${encodeURIComponent(id)}`,
        {
          headers: this.headers(accessToken, apiVersion),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) return null;
      const body: unknown = await response.json().catch(() => null);
      if (typeof body !== 'object' || body === null) return null;
      const localized = (body as Record<string, unknown>).localizedName;
      return typeof localized === 'string' ? localized : null;
    } catch {
      return null;
    }
  }

  private headers(accessToken: string, apiVersion: string) {
    return {
      authorization: `Bearer ${accessToken}`,
      'x-restli-protocol-version': '2.0.0',
      'linkedin-version': apiVersion,
    };
  }

  private async json(response: Response): Promise<Record<string, unknown>> {
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof body !== 'object' || body === null) {
      throw new ServiceUnavailableException();
    }
    return body as Record<string, unknown>;
  }

  private text(body: Record<string, unknown>, key: string): string | null {
    const value = body[key];
    return typeof value === 'string' && value ? value : null;
  }
}
