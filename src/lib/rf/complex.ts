import type { Complex } from '../../types';

export const COMPLEX_ZERO: Complex = Object.freeze({ re: 0, im: 0 });
export const COMPLEX_ONE: Complex = Object.freeze({ re: 1, im: 0 });

export function complex(re: number, im = 0): Complex {
  if (!Number.isFinite(re) || !Number.isFinite(im)) {
    throw new RangeError(`Complex components must be finite; received ${re} + j${im}`);
  }

  return { re, im };
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subtract(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function negate(value: Complex): Complex {
  return { re: -value.re, im: -value.im };
}

export function multiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function multiplyReal(value: Complex, scalar: number): Complex {
  return { re: value.re * scalar, im: value.im * scalar };
}

export function divide(a: Complex, b: Complex): Complex {
  const denominator = magnitudeSquared(b);
  if (denominator === 0) {
    throw new RangeError('Cannot divide by complex zero');
  }

  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

export function reciprocal(value: Complex): Complex {
  return divide(COMPLEX_ONE, value);
}

export function conjugate(value: Complex): Complex {
  return { re: value.re, im: -value.im };
}

export function magnitudeSquared(value: Complex): number {
  return value.re * value.re + value.im * value.im;
}

export function magnitude(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

export function phaseRadians(value: Complex): number {
  return Math.atan2(value.im, value.re);
}

export function phaseDegrees(value: Complex): number {
  return (phaseRadians(value) * 180) / Math.PI;
}

export function fromPolar(magnitudeValue: number, phaseRadiansValue: number): Complex {
  if (magnitudeValue < 0 || !Number.isFinite(magnitudeValue)) {
    throw new RangeError(`Polar magnitude must be finite and non-negative; received ${magnitudeValue}`);
  }

  if (!Number.isFinite(phaseRadiansValue)) {
    throw new RangeError(`Polar phase must be finite; received ${phaseRadiansValue}`);
  }

  return {
    re: magnitudeValue * Math.cos(phaseRadiansValue),
    im: magnitudeValue * Math.sin(phaseRadiansValue),
  };
}

export function fromPolarDegrees(magnitudeValue: number, phaseDegreesValue: number): Complex {
  return fromPolar(magnitudeValue, (phaseDegreesValue * Math.PI) / 180);
}

export function expj(phaseRadiansValue: number): Complex {
  return fromPolar(1, phaseRadiansValue);
}

export function rotate(value: Complex, phaseRadiansValue: number): Complex {
  return multiply(value, expj(phaseRadiansValue));
}

export function isApproximatelyEqual(a: Complex, b: Complex, tolerance = 1e-12): boolean {
  return Math.abs(a.re - b.re) <= tolerance && Math.abs(a.im - b.im) <= tolerance;
}

/** Wrap a phase to the half-open interval [-180°, 180°). */
export function wrapDegrees(phaseDegreesValue: number): number {
  return ((phaseDegreesValue + 180) % 360 + 360) % 360 - 180;
}

/** Remove ±360° jumps while preserving the first phase sample. */
export function unwrapDegrees(phasesDegrees: readonly number[]): number[] {
  if (phasesDegrees.length === 0) return [];

  const first = phasesDegrees[0];
  if (first === undefined) return [];

  const result = [first];
  let offset = 0;

  for (let index = 1; index < phasesDegrees.length; index += 1) {
    const current = phasesDegrees[index];
    const previous = phasesDegrees[index - 1];
    if (current === undefined || previous === undefined) continue;

    const jump = current - previous;
    if (jump > 180) offset -= 360;
    if (jump < -180) offset += 360;
    result.push(current + offset);
  }

  return result;
}
