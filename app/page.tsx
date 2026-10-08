import { GamesSection } from "@/components/games-section"
import { GAMES } from "@/lib/games"

export default function Home() {
  return <GamesSection games={GAMES} showComingSoon />
}