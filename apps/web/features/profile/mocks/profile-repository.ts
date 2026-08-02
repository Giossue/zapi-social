import type {
  ChangePortalPasswordInput,
  PortalProfile,
  UpdatePortalProfileInput,
} from "@workspace/contracts"
import { portalProfileFixture } from "../fixtures/profile"

export class ProfileMockRepository {
  private profile: PortalProfile = portalProfileFixture

  async get(): Promise<PortalProfile> {
    return this.profile
  }

  async update(input: UpdatePortalProfileInput): Promise<PortalProfile> {
    this.profile = { ...this.profile, ...input }
    return this.profile
  }

  async changePassword(_input: ChangePortalPasswordInput): Promise<void> {
    // Fixture repository intentionally performs no password persistence.
  }
}
