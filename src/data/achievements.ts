import type { ProfileData } from "@/types";
import type { RunSnapshot } from "@/systems/StatsRecorder";

/**
 * Achievements are checked AFTER any in-game stats event. Each entry has
 * a `check` predicate that receives both the lifetime profile snapshot AND
 * the active in-run snapshot (so we can express "...in a single run" goals).
 *
 * Achievements are awarded once and persisted in `profile.achievements`.
 */
export interface AchievementDefinition {
  id: string;
  title: string;
  flavor: string;
  color: number;
  check: (profile: ProfileData, run: RunSnapshot) => boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_blood",
    title: "Primera sangre",
    flavor: "El primer cuerpo cae sobre la mesa.",
    color: 0xff7d8a,
    check: (p) => p.totalKills >= 1,
  },
  {
    id: "centenario",
    title: "Centenario",
    flavor: "100 enemigos no son nada.",
    color: 0xff7d8a,
    check: (p) => p.totalKills >= 100,
  },
  {
    id: "carniceria",
    title: "Carnicería",
    flavor: "500 cuerpos. La casa lo aprueba.",
    color: 0xff5c6c,
    check: (p) => p.totalKills >= 500,
  },
  {
    id: "primer_pacto",
    title: "Pacto con el diablo",
    flavor: "Aceptaste tu primer modificador.",
    color: 0xc88cff,
    check: (p) => p.modifiersAccepted >= 1,
  },
  {
    id: "abstemio",
    title: "Abstemio",
    flavor: "Una run completa rechazando todo pacto.",
    color: 0x6fd3ff,
    check: (_p, r) => r.modifiersSkipped >= 4 && r.modifiersAccepted === 0,
  },
  {
    id: "primera_run",
    title: "Sobreviviste",
    flavor: "Tu primera victoria.",
    color: 0xffd166,
    check: (p) => p.runsWon >= 1,
  },
  {
    id: "veterano",
    title: "Veterano",
    flavor: "Diez runs jugadas. Sigues viniendo.",
    color: 0xffd166,
    check: (p) => p.runsPlayed >= 10,
  },
  {
    id: "jackpot",
    title: "Jackpot",
    flavor: "Una jugada de slot ganadora.",
    color: 0xffd166,
    check: (p) => p.slotsPlayed >= 1 && (p.totalChipsEarned ?? 0) >= 200,
  },
  {
    id: "alta_apuesta",
    title: "Alta apuesta",
    flavor: "Cinco pactos en una sola run.",
    color: 0xc88cff,
    check: (_p, r) => r.modifiersAccepted >= 5,
  },
  {
    id: "coleccionista",
    title: "Coleccionista",
    flavor: "Tres reliquias en una run.",
    color: 0x6fd3ff,
    check: (_p, r) => r.relicsAcquired >= 3,
  },
  {
    id: "arquitecto",
    title: "Arquitecto",
    flavor: "Cinco torres desplegadas en una run.",
    color: 0xb6ffb0,
    check: (_p, r) => r.towersPlaced >= 5,
  },
  {
    id: "tres_minijuegos",
    title: "La tríada del casino",
    flavor: "Slot, ruleta y cartas en una sola run.",
    color: 0xd4a942,
    check: (_p, r) => r.slotsPlayed >= 1 && r.roulettePlayed >= 1 && r.cardsPlayed >= 1,
  },
  {
    id: "boss_killer",
    title: "Decapitador",
    flavor: "El crupier final cae.",
    color: 0xff5c6c,
    check: (p) => (p.killsByEnemyType.boss ?? 0) >= 1,
  },
  {
    id: "millonario",
    title: "Millonario chico",
    flavor: "10 000 fichas acumuladas en tu carrera.",
    color: 0xffd166,
    check: (p) => p.totalChipsEarned >= 10000,
  },
  {
    id: "ola_diez",
    title: "Sin descanso",
    flavor: "Llegaste a la ola 10 al menos una vez.",
    color: 0x6fd3ff,
    check: (p) => p.highestWaveReached >= 10,
  },
];
