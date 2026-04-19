export type FireOutcome = "normal" | "crit" | "misfire";

export interface SplashConfig {
  radius: number;
  falloff: number;
}

export interface ProjectileConfig {
  x: number;
  y: number;
  damage: number;
  speed: number;
  color: number;
  radius: number;
  outcome: FireOutcome;
  splash?: SplashConfig;
}
