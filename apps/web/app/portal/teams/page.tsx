import { TeamsPage } from "@/features/teams/components/teams-page"
import { getTeamsMock } from "@/features/teams/mocks/teams-repository"

export default async function TeamsRoutePage() {
  const teams = await getTeamsMock()

  return <TeamsPage teams={teams} />
}
