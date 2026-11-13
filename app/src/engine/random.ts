import { mulberry } from './math';

/**
 * Seeded random number generator for deterministic per-card randomness.
 * Ported from the reference engine.js hash/rnd logic.
 */

export interface Rng {
  (i: number, k?: number): number;
}

/**
 * Create a deterministic RNG for the current project/frame.
 * The seed combines the media seed with a frame salt for variety.
 */
export function createRng(seed: number, frameSalt = 0): Rng {
  const baseRng = mulberry(seed + frameSalt * 10007);

  return (i: number, k = 0): number => {
    // Combine card index and salt into a single seed
    const combined = (i + 1) * 1000003 + k * 10007 + seed;
    return mulberry(combined)();
  };
}

/**
 * Deterministic random with optional additional salt.
 * Matches the reference: rnd(i, k) = hash(i + 1, k + 7, seed)
 */
export function deterministicRnd(seed: number): (i: number, k?: number) => number {
  return (i: number, k = 7): number => {
    // Use the same hash logic as the reference
    let h = 0;
    for (const s of [i + 1, k, seed]) {
      h = (h + (s | 0)) | 0;
      h = (h + ((h << 10) >>> 0)) | 0;
      h ^= (h >>> 6);
    }
    h = (h + ((h << 3) >>> 0)) | 0;
    h ^= (h >>> 11);
    h = (h + ((h << 15) >>> 0)) | 0;
    return (h >>> 0) / 4294967296;
  };
}