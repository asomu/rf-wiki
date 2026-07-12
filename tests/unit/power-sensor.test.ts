import { describe, expect, it } from 'vitest';
import {
  U2061XA_DAMAGE_AVERAGE_DBM,
  U2061XA_DAMAGE_PEAK_DBM,
  U2061XA_ERROR_DRAIN_MAX_QUERIES,
  calculateDutPlanePowerDbm,
  calculatePaPowerMeasurement,
  calculateRectangularBurstPower,
  calculateU2061AverageReadingRate,
  calculateU2061Uncertainty,
  createU2061Session,
  evaluateU2061InputSafety,
  getU2061ApertureMinimumSeconds,
  queryU2061Scpi,
  readU2061Scpi,
  swrToGammaMagnitude,
  u2061xaCommandCatalog,
  u2061xaProgrammingReference,
  validateU2061Aperture,
  writeU2061Scpi,
} from '../../src/lib/instruments/power-sensor';

describe('U2061XA SCPI catalog provenance', () => {
  it('covers every semantic command handled by the reducer', () => {
    expect(u2061xaCommandCatalog.map(({ id }) => id)).toEqual([
      'identity',
      'options',
      'operation-complete',
      'clear-status',
      'reset',
      'system-error',
      'detector-function',
      'measurement-frequency',
      'sweep-aperture',
      'average-count',
      'average-count-auto',
      'video-bandwidth',
      'trigger-source',
      'trigger-level',
      'trigger-slope',
      'trigger-delay',
      'trigger-holdoff',
      'zero-type',
      'zero-auto',
      'calibration-auto',
      'calibration-all',
      'continuous-initiate',
      'initiate-immediate',
      'bus-trigger',
      'trigger-immediate',
      'read',
      'fetch',
      'abort',
    ]);
    expect(new Set(u2061xaCommandCatalog.map(({ id }) => id)).size)
      .toBe(u2061xaCommandCatalog.length);
  });

  it('pins long/short forms, operation, safety and official applicability metadata', () => {
    expect(u2061xaProgrammingReference).toMatchObject({
      organization: 'Keysight Technologies',
      documentNumber: '9018-04755',
    });
    for (const command of u2061xaCommandCatalog) {
      expect(command.longForm.length).toBeGreaterThan(0);
      expect(command.shortForm.length).toBeGreaterThan(0);
      expect(command.forms.length).toBeGreaterThan(0);
      expect(command.stateEffect.length).toBeGreaterThan(0);
      expect(command.safetyClass.length).toBeGreaterThan(0);
      expect(command.supportedModels).toEqual(['U2061XA']);
      expect(command.firmwareScope).toBe('A.03.16');
      expect(command.optionScope).toBe('U2061XA base hardware');
      expect(command.source).toMatchObject({
        organization: 'Keysight Technologies',
        documentNumber: '9018-04755',
      });
      expect(command.source.url).toMatch(/^https:\/\/www\.keysight\.com\//);
      expect(command.source.section.length).toBeGreaterThan(0);
    }
  });
});

describe('U2061XA RF calculations', () => {
  it('computes average power and peak-to-average ratio for a rectangular burst', () => {
    const result = calculateRectangularBurstPower({ onPowerDbm: 10, dutyCyclePercent: 25 });
    expect(result.averagePowerDbm).toBeCloseTo(3.9794, 4);
    expect(result.peakToAverageDb).toBeCloseTo(6.0206, 4);
  });

  it('uses the frequency-dependent aperture minimum', () => {
    expect(getU2061ApertureMinimumSeconds(299_999_999)).toBe(50e-6);
    expect(getU2061ApertureMinimumSeconds(300_000_000)).toBe(20e-6);
    expect(() => validateU2061Aperture(100_000_000, 20e-6)).toThrow(RangeError);
  });

  it('converts aperture to the real-time average reading-rate ceiling', () => {
    expect(calculateU2061AverageReadingRate(3_500_000_000, 20e-6)).toBeCloseTo(50_000);
    expect(calculateU2061AverageReadingRate(3_500_000_000, 1e-3)).toBeCloseTo(1_000);
  });

  it('treats vendor damage levels as limits rather than safe operating targets', () => {
    const decision = evaluateU2061InputSafety({
      sensorAveragePowerDbm: 23,
      sensorPeakPowerDbm: 26,
      peakDurationSeconds: 5e-6,
      dcVoltage: 0,
      guardMarginDb: 3,
    });
    expect(U2061XA_DAMAGE_AVERAGE_DBM).toBe(26);
    expect(U2061XA_DAMAGE_PEAK_DBM).toBe(29);
    expect(decision.guardedAverageLimitDbm).toBe(23);
    expect(decision.guardedPeakLimitDbm).toBe(26);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toHaveLength(2);
  });

  it('allows the +29 dBm peak rule only below 10 microseconds', () => {
    const shortPulse = evaluateU2061InputSafety({
      sensorAveragePowerDbm: 15,
      sensorPeakPowerDbm: 27,
      peakDurationSeconds: 9.999e-6,
      dcVoltage: 0,
      guardMarginDb: 0,
    });
    const tenMicroseconds = evaluateU2061InputSafety({
      sensorAveragePowerDbm: 15,
      sensorPeakPowerDbm: 27,
      peakDurationSeconds: 10e-6,
      dcVoltage: 0,
      guardMarginDb: 0,
    });
    expect(shortPulse.peakDamageRule).toBe('<10us');
    expect(shortPulse.allowed).toBe(true);
    expect(tenMicroseconds.peakDamageRule).toBe('average-limit');
    expect(tenMicroseconds.allowed).toBe(false);
  });

  it('blocks the DC damage level', () => {
    expect(evaluateU2061InputSafety({
      sensorAveragePowerDbm: -20,
      sensorPeakPowerDbm: -10,
      peakDurationSeconds: 1e-6,
      dcVoltage: 10,
      guardMarginDb: 3,
    }).allowed).toBe(false);
  });

  it('combines standard system and mismatch uncertainty before applying k=2', () => {
    const result = calculateU2061Uncertainty({ sensorSwr: 1.15, dutSwr: 1.5, systemStandardPercent: 2 });
    expect(result.sensorGammaMagnitude).toBeCloseTo(0.069767, 6);
    expect(result.dutGammaMagnitude).toBeCloseTo(0.2, 6);
    expect(result.mismatchStandardPercent).toBeCloseTo(0.98666, 5);
    expect(result.combinedStandardPercent).toBeCloseTo(2.2301, 4);
    expect(result.expandedPercent).toBeCloseTo(4.46027, 5);
  });

  it('rejects SWR below one', () => {
    expect(() => swrToGammaMagnitude(0.99)).toThrow(RangeError);
  });

  it('moves a sensor reading back to the DUT reference plane', () => {
    expect(calculateDutPlanePowerDbm(-12, 30.7)).toBeCloseTo(18.7);
  });

  it('computes gain, DC power and PAE from synchronized RF and PSU readings', () => {
    const result = calculatePaPowerMeasurement({
      inputSensorDbm: -20,
      inputPathCorrectionDb: 10,
      outputSensorDbm: -12,
      outputPathCorrectionDb: 40,
      supplyVoltageV: 28,
      supplyCurrentA: 1.5,
    });
    expect(result.inputDutPlaneDbm).toBe(-10);
    expect(result.outputDutPlaneDbm).toBe(28);
    expect(result.gainDb).toBe(38);
    expect(result.dcPowerW).toBe(42);
    expect(result.paePercent).toBeCloseTo(1.502, 3);
  });
});

describe('U2061XA deterministic SCPI session', () => {
  it('identifies the fixed model and firmware', () => {
    const result = queryU2061Scpi(createU2061Session(), '*IDN?');
    expect(result.response).toBe('Keysight Technologies,U2061XA,RF-WIKI-DEMO,A.03.16');
    expect(result.session.outputQueue).toHaveLength(0);
  });

  it('configures average mode frequency and aperture with query-back', () => {
    let session = createU2061Session();
    session = writeU2061Scpi(session, 'SENS:FREQ 3.5GHZ');
    session = writeU2061Scpi(session, 'SENS:SWE:APER 20US');
    const queried = queryU2061Scpi(session, 'SENS:SWE:APER?');
    expect(queried.session.state.frequencyHz).toBe(3_500_000_000);
    expect(queried.session.state.apertureSeconds).toBeCloseTo(20e-6);
    expect(Number(queried.response)).toBeCloseTo(20e-6);
  });

  it('coerces aperture to 50 microseconds below 300 MHz', () => {
    let session = writeU2061Scpi(createU2061Session(), 'SENS:SWE:APER 20US');
    session = writeU2061Scpi(session, 'SENS:FREQ 100MHZ');
    expect(session.state.apertureSeconds).toBe(50e-6);
  });

  it('rejects average aperture in normal mode and normal VBW in average mode', () => {
    let average = writeU2061Scpi(createU2061Session(), 'SENS:BAND:VID HIGH');
    expect(average.errorQueue.at(-1)).toEqual({ code: -221, message: 'Settings conflict' });
    let normal = writeU2061Scpi(createU2061Session(), 'SENS:DET:FUNC NORM');
    normal = writeU2061Scpi(normal, 'SENS:SWE:APER 1MS');
    expect(normal.errorQueue.at(-1)).toEqual({ code: -221, message: 'Settings conflict' });
  });

  it('distinguishes command trigger-level range from source compatibility', () => {
    let session = writeU2061Scpi(createU2061Session(), 'TRIG:LEV -30DBM');
    expect(session.errorQueue.at(-1)?.code).toBe(-221);
    session = writeU2061Scpi(session, 'TRIG:SOUR INT');
    session = writeU2061Scpi(session, 'TRIG:LEV -30DBM');
    expect(session.state.triggerLevelDbm).toBe(-30);
  });

  it('separates INIT and FETCh for a bus-triggered acquisition', () => {
    let session = writeU2061Scpi(createU2061Session(), 'TRIG:SOUR BUS');
    session = writeU2061Scpi(session, 'INIT');
    expect(session.state.armed).toBe(true);
    session = writeU2061Scpi(session, '*TRG');
    const fetched = queryU2061Scpi(session, 'FETC?');
    expect(fetched.session.state.armed).toBe(false);
    expect(fetched.response).toBe('-20');
  });

  it('invalidates an old measurement when a new triggered INIT arms', () => {
    let session = writeU2061Scpi(createU2061Session(), 'INIT');
    expect(session.state.lastMeasurementDbm).toBe(-20);
    session = writeU2061Scpi(session, 'TRIG:SOUR BUS');
    session = writeU2061Scpi(session, 'INIT');
    expect(session.state.armed).toBe(true);
    expect(session.state.lastMeasurementDbm).toBeNull();
    const fetched = queryU2061Scpi(session, 'FETC?');
    expect(fetched.response).toBe('9.91E37');
    expect(fetched.session.errorQueue.at(-1)).toEqual({ code: -230, message: 'Acquisition not complete' });
  });

  it('accepts a bus trigger only for an armed BUS acquisition', () => {
    let unarmed = writeU2061Scpi(createU2061Session(), '*TRG');
    expect(unarmed.errorQueue.at(-1)).toEqual({ code: -211, message: 'Trigger ignored' });

    let wrongSource = writeU2061Scpi(createU2061Session(), 'TRIG:SOUR EXT');
    wrongSource = writeU2061Scpi(wrongSource, 'INIT');
    wrongSource = writeU2061Scpi(wrongSource, '*TRG');
    expect(wrongSource.state.armed).toBe(true);
    expect(wrongSource.errorQueue.at(-1)).toEqual({ code: -221, message: 'Settings conflict' });
  });

  it('keeps continuous mode independent from a one-shot armed acquisition', () => {
    let session = writeU2061Scpi(createU2061Session(), 'INIT:CONT OFF');
    session = writeU2061Scpi(session, 'TRIG:SOUR EXT');
    session = writeU2061Scpi(session, 'INIT');
    expect(session.state.continuousEnabled).toBe(false);
    expect(session.state.armed).toBe(true);
    const queried = queryU2061Scpi(session, 'INIT:CONT?');
    expect(queried.response).toBe('0');
    expect(queried.session.state.armed).toBe(true);
  });

  it('releases an armed HOLD acquisition only through an explicit immediate event', () => {
    let session = writeU2061Scpi(createU2061Session(), 'TRIG:SOUR HOLD');
    session = writeU2061Scpi(session, 'INIT');
    expect(session.state.armed).toBe(true);
    expect(queryU2061Scpi(session, 'FETC?').response).toBe('9.91E37');
    session = writeU2061Scpi(session, 'TRIG:IMM');
    expect(session.state.armed).toBe(false);
    expect(queryU2061Scpi(session, 'FETC?').response).toBe('-20');
  });

  it('reports READ deadlock for BUS without silently returning a valid measurement', () => {
    let session = writeU2061Scpi(createU2061Session(), 'TRIG:SOUR BUS');
    const result = queryU2061Scpi(session, 'READ?');
    expect(result.response).toBe('9.91E37');
    expect(result.session.errorQueue.at(-1)).toEqual({ code: -214, message: 'Trigger deadlock' });
  });

  it('keeps output and error queues separate and reports query interruption', () => {
    let session = writeU2061Scpi(createU2061Session(), '*IDN?');
    expect(session.outputQueue).toHaveLength(1);
    session = writeU2061Scpi(session, 'SENS:FREQ 1GHZ');
    expect(session.outputQueue).toHaveLength(0);
    expect(session.errorQueue.at(-1)).toEqual({ code: -410, message: 'Query INTERRUPTED' });
  });

  it('drains the error queue FIFO and terminates with +0', () => {
    let session = writeU2061Scpi(createU2061Session(), 'NOT:A:COMMAND');
    session = writeU2061Scpi(session, 'SENS:FREQ 99GHZ');
    const first = queryU2061Scpi(session, 'SYST:ERR?');
    const second = queryU2061Scpi(first.session, 'SYST:ERR?');
    const done = queryU2061Scpi(second.session, 'SYST:ERR?');
    expect(first.response).toContain('-113');
    expect(second.response).toContain('-222');
    expect(done.response).toBe('+0,"No error"');
    expect(U2061XA_ERROR_DRAIN_MAX_QUERIES).toBe(31);
  });

  it('returns CAL:ALL? pass and changes zero/cal state', () => {
    let session = writeU2061Scpi(createU2061Session(), 'CAL:ZERO:TYPE EXT');
    expect(session.state.zeroed).toBe(false);
    const result = queryU2061Scpi(session, 'CAL:ALL?');
    expect(result.response).toBe('0');
    expect(result.session.state.zeroed).toBe(true);
    expect(result.session.state.calibrated).toBe(true);
  });

  it('reports reading an empty output queue without fabricating data', () => {
    const result = readU2061Scpi(createU2061Session());
    expect(result.response).toBeNull();
    expect(result.session.errorQueue.at(-1)?.code).toBe(-420);
  });
});
