/**
 * Seedable PRNG using a Mulberry32 generator — fast, tiny, and produces a
 * uniform [0, 1) float from a 32-bit seed. Deterministic: same seed gives
 * the same sequence every time.
 *
 * Usage:
 *   const rng = new Rng(12345);
 *   rng.next();       // 0–1 float
 *   rng.int(0, 10);   // integer in [0, 10]
 *   rng.pick(arr);    // random element
 *   rng.shuffle(arr); // Fisher-Yates in-place
 *   rng.chance(0.3);  // 30 % true
 *
 * A global singleton (`rng`) is exported for systems that need run-wide
 * determinism. Call `rng.seed(n)` at run start to reset the sequence.
 */

export class Rng {
  private state: number;

  public constructor(seed: number = Date.now() | 0) {
    this.state = seed | 0;
  }

  /** Reset with a new seed. */
  public seed(s: number): void {
    this.state = s | 0;
  }

  /** Return current seed state (useful for saving / sharing). */
  public currentSeed(): number {
    return this.state;
  }

  /** Uniform float in [0, 1). */
  public next(): number {
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Boolean with given probability. */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Random element from array. */
  public pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick: weights[i] is the relative weight for arr[i]. */
  public weightedPick<T>(arr: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < arr.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /** Fisher-Yates in-place shuffle, returns the same array reference. */
  public shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

// ---------------------------------------------------------------------------
// Global singleton — seed once at run start via `rng.seed(n)`.
// ---------------------------------------------------------------------------
export const rng = new Rng();

// ---------------------------------------------------------------------------
// Daily seed helpers
// ---------------------------------------------------------------------------

/** Deterministic seed derived from today's date (UTC). Same for all players. */
export function dailySeed(): number {
  const d = new Date();
  const yyyymmdd = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  // Mix with a salt so it doesn't feel sequential.
  return hashInt(yyyymmdd ^ 0x4f564552); // "OVER" in ASCII
}

/** Simple integer hash (Robert Jenkins one-at-a-time style). */
function hashInt(a: number): number {
  a = (a + 0x7ed55d16 + (a << 12)) | 0;
  a = (a ^ 0xc761c23c ^ (a >>> 19)) | 0;
  a = (a + 0x165667b1 + (a << 5)) | 0;
  a = ((a + 0xd3a2646c) ^ (a << 9)) | 0;
  a = (a + 0xfd7046c5 + (a << 3)) | 0;
  a = (a ^ 0xb55a4f09 ^ (a >>> 16)) | 0;
  return a >>> 0;
}

/** Convert any string into a numeric seed. */
export function seedFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(31, h) + str.charCodeAt(i);
    h |= 0;
  }
  return hashInt(h);
}
