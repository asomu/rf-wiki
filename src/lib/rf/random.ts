/** Small deterministic PRNG suitable for repeatable educational noise, not cryptography. */
export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Returns a closure producing zero-mean, unit-variance Gaussian samples. */
export function createGaussianNoise(seed: number): () => number {
  const uniform = createMulberry32(seed);
  let spare: number | undefined;

  return () => {
    if (spare !== undefined) {
      const value = spare;
      spare = undefined;
      return value;
    }

    // Box–Muller cannot accept log(0). Mulberry32 may return exactly zero.
    let u1 = uniform();
    while (u1 <= Number.EPSILON) u1 = uniform();
    const u2 = uniform();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}
