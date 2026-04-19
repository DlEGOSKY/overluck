/**
 * Tracks consecutive kills within a short window. Each kill resets the
 * decay timer; once the timer lapses, the streak returns to 0. The
 * multiplier grows non-linearly so casual play feels normal but sustained
 * aggression pays off.
 *
 * Tiers (streak → mult):
 *   0-2   → 1.0
 *   3-5   → 1.2
 *   6-9   → 1.5
 *   10-14 → 2.0
 *   15+   → 2.5
 */
export interface ComboSnapshot {
  streak: number;
  multiplier: number;
  timeLeftMs: number;
}

const WINDOW_MS = 2200;

function tier(streak: number): number {
  if (streak >= 15) return 2.5;
  if (streak >= 10) return 2.0;
  if (streak >= 6) return 1.5;
  if (streak >= 3) return 1.2;
  return 1.0;
}

export class ComboTracker {
  private streak = 0;
  private remainingMs = 0;

  public onKill(): ComboSnapshot {
    this.streak += 1;
    this.remainingMs = WINDOW_MS;
    return this.snapshot();
  }

  public update(deltaMs: number): void {
    if (this.streak === 0) return;
    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) {
      this.streak = 0;
      this.remainingMs = 0;
    }
  }

  public reset(): void {
    this.streak = 0;
    this.remainingMs = 0;
  }

  public multiplier(): number {
    return tier(this.streak);
  }

  public snapshot(): ComboSnapshot {
    return {
      streak: this.streak,
      multiplier: tier(this.streak),
      timeLeftMs: this.remainingMs,
    };
  }
}
