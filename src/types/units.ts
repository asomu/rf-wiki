declare const rfUnitBrand: unique symbol;

/** A compile-time unit marker. Values remain ordinary numbers at runtime. */
export type RfUnit<Name extends string> = number & {
  readonly [rfUnitBrand]: Name;
};

export type Hertz = RfUnit<'Hz'>;
export type Kilohertz = RfUnit<'kHz'>;
export type Megahertz = RfUnit<'MHz'>;
export type Seconds = RfUnit<'s'>;
export type Watts = RfUnit<'W'>;
export type DBm = RfUnit<'dBm'>;
export type Decibels = RfUnit<'dB'>;
export type Ohms = RfUnit<'ohm'>;
export type Degrees = RfUnit<'deg'>;
export type Radians = RfUnit<'rad'>;

export interface Frequency {
  readonly hz: Hertz;
}

export interface Power {
  readonly watts: Watts;
  readonly dbm: DBm;
}

export interface Impedance {
  readonly resistanceOhms: Ohms;
  readonly reactanceOhms: Ohms;
}

function finiteUnit<Name extends string>(value: number, unit: Name): RfUnit<Name> {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${unit} value must be finite; received ${String(value)}`);
  }

  return value as RfUnit<Name>;
}

function logarithmicUnit<Name extends string>(value: number, unit: Name): RfUnit<Name> {
  if (Number.isNaN(value)) {
    throw new RangeError(`${unit} value must not be NaN`);
  }

  return value as RfUnit<Name>;
}

export const hertz = (value: number): Hertz => finiteUnit(value, 'Hz');
export const kilohertz = (value: number): Kilohertz => finiteUnit(value, 'kHz');
export const megahertz = (value: number): Megahertz => finiteUnit(value, 'MHz');
export const seconds = (value: number): Seconds => finiteUnit(value, 's');
export const watts = (value: number): Watts => finiteUnit(value, 'W');
export const dbm = (value: number): DBm => logarithmicUnit(value, 'dBm');
export const decibels = (value: number): Decibels => logarithmicUnit(value, 'dB');
export const ohms = (value: number): Ohms => finiteUnit(value, 'ohm');
export const degrees = (value: number): Degrees => finiteUnit(value, 'deg');
export const radians = (value: number): Radians => finiteUnit(value, 'rad');

export function frequencyFromHz(value: number): Frequency {
  return { hz: hertz(value) };
}

export function impedance(
  resistanceOhms: number,
  reactanceOhms = 0,
): Impedance {
  return {
    resistanceOhms: ohms(resistanceOhms),
    reactanceOhms: ohms(reactanceOhms),
  };
}
