// Stable identifiers. Production uses Postgres uuid defaults; the prototype uses prefixed random ids.
let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
export function nowISO(): string { return new Date().toISOString(); }

/** Deterministic PRNG (mulberry32) so the seed produces the same club every reset. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    sample: <T,>(arr: readonly T[], n: number): T[] => {
      const copy = arr.slice();
      const out: T[] = [];
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      return out;
    },
  };
}
export function slug(s: string): string { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ''); }
