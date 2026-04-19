import type { RelicId } from "./relic";

export type CharacterId = "novato" | "tahur" | "mecanico" | "vidente";

export interface CharacterPassive {
  /** Descriptive key used by systems to look up the bonus. */
  kind:
    | "extra_chips"
    | "extra_base_hp"
    | "tower_fire_rate_mult"
    | "chip_reward_mult"
    | "crit_bonus";
  value: number;
}

export interface CharacterDefinition {
  id: CharacterId;
  displayName: string;
  description: string;
  color: number;
  startingRelic: RelicId | null;
  passives: readonly CharacterPassive[];
}

export type CharacterCatalog = Readonly<Record<CharacterId, CharacterDefinition>>;
