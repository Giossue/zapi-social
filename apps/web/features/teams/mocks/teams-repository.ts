import { teamsFixture } from "@/features/teams/fixtures/teams"
import type { TeamsData } from "@/features/teams/types/teams"

export async function getTeamsMock(): Promise<TeamsData> {
  return teamsFixture
}
