import type { RelicId } from "./relic";
import type { UnlockId } from "./unlock";

export type RewardKind = "safe_chips" | "relic" | "casino_gamble" | "slot_play" | "roulette_play" | "card_play";

export type RewardRarity = "common" | "rare";

export interface SafeChipsPayload {
  amount: number;
}

export interface RelicPayload {
  relicId: RelicId;
}

export interface CasinoGamblePayload {
  winChance: number;
  winAmount: number;
  loseAmount: number;
}

export interface SlotPlayPayload {
  cost: number;
}

export interface RoulettePlayPayload {
  stake: number;
}

export type RewardPayload =
  | SafeChipsPayload
  | RelicPayload
  | CasinoGamblePayload
  | SlotPlayPayload
  | RoulettePlayPayload;

export interface RewardTemplate {
  kind: RewardKind;
  displayName: string;
  description: string;
  rarity: RewardRarity;
  weight: number;
  color: number;
  payload: RewardPayload;
  /** If set, the template is only rolled when this unlock id is present. */
  requiresUnlock?: UnlockId;
}

export interface RewardOffer {
  id: string;
  template: RewardTemplate;
}
