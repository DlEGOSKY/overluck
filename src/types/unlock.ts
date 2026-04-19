import type { ProfileData } from "./profile";

export type UnlockId =
  | "tower_sniper"
  | "tower_conduit"
  | "relic_amuleto_crupier"
  | "relic_ficha_marcada"
  | "scene_cards"
  | "rare_modifiers_full";

export type UnlockKind = "tower" | "relic" | "scene" | "content";

export interface UnlockDefinition {
  id: UnlockId;
  kind: UnlockKind;
  displayName: string;
  description: string;
  flavor: string;
  color: number;
  /** Returns true when the profile satisfies the condition. */
  check: (profile: ProfileData) => boolean;
  /** Optional user-facing progress tuple (current, target). */
  progress?: (profile: ProfileData) => { current: number; target: number };
}
