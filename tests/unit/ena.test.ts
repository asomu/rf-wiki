import { describe, expect, it } from 'vitest';
import {
  calculateGroupDelaySeconds,
  calibrateEna,
  createE5080bSafeSweepProgram,
  createE5080bSession,
  deembedSymmetricFixture,
  e5080bCommandCatalog,
  enaLogMagnitudeDb,
  enaReturnLossDb,
  enaVswr,
  evaluateCalibrationValidity,
  evaluateEnaReceiverSafety,
  estimateEnaPaCompressionDb,
  estimateEnaTraceNoiseDbRms,
  gammaToImpedance,
  generateEnaSweep,
  parseE5080bScpi,
  queryE5080bScpi,
  readE5080bScpi,
  signalE5080bTriggerEvent,
  writeE5080bScpi,
  type EnaSweepState,
} from '../../src/lib/instruments/ena';

const sweep: EnaSweepState = {
  startHz: 1e9,
  stopHz: 6e9,
  points: 201,
  ifBandwidthHz: 1e3,
  sourcePowerDbm: -30,
  averagingEnabled: false,
  averagingCount: 4,
  sweepType: 'LIN',
};

describe('E5080B command catalog and SCPI reducer', () => {
  it('scopes every command to E5080B A.20.25.03 and an official Keysight source', () => {
    expect(e5080bCommandCatalog.length).toBeGreaterThanOrEqual(20);
    for (const command of e5080bCommandCatalog) {
      expect(command.supportedModels).toEqual(['E5080B']);
      expect(command.firmwareScope).toBe('A.20.25.03');
      expect(command.source.organization).toBe('Keysight Technologies');
      expect(command.source.url).toMatch(/^https:\/\/(helpfiles\.)?keysight\.com\//);
      expect(command.longForm).not.toBe('');
      expect(command.shortForm).not.toBe('');
    }
  });

  it('keeps IEEE 488.2 common commands as fixed mnemonics without invented long forms', () => {
    const common = new Map(e5080bCommandCatalog
      .filter(({ shortForm }) => shortForm.startsWith('*'))
      .map(({ id, longForm, shortForm }) => [id, { longForm, shortForm }]));
    expect(common.get('identity')).toEqual({ longForm: '*IDN?', shortForm: '*IDN?' });
    expect(common.get('options')).toEqual({ longForm: '*OPT?', shortForm: '*OPT?' });
    expect(common.get('clear-status')).toEqual({ longForm: '*CLS', shortForm: '*CLS' });
    expect(common.get('operation-complete')).toEqual({ longForm: '*OPC?', shortForm: '*OPC?' });
    expect(common.get('bus-trigger')).toEqual({ longForm: '*TRG', shortForm: '*TRG' });
  });

  it('accepts conservative long/short forms and rejects batches/unknown commands', () => {
    expect(parseE5080bScpi('SENS1:FREQ:STAR 1 GHZ')).toMatchObject({ ok: true, command: { id: 'frequency-start', form: 'write' } });
    expect(parseE5080bScpi('SENSE1:FREQUENCY:START?')).toMatchObject({ ok: true, command: { id: 'frequency-start', form: 'query' } });
    expect(parseE5080bScpi('OUTP OFF;SOUR1:POW -30')).toMatchObject({ ok: false, error: { code: -102 } });
    expect(parseE5080bScpi('PNA:ONLY 1')).toMatchObject({ ok: false, error: { code: -113 } });
  });

  it('models sweep, averaging, correction and binary-transfer state explicitly', () => {
    let session = createE5080bSession();
    session = writeE5080bScpi(session, 'SENS1:SWE:TYPE LOG');
    session = writeE5080bScpi(session, 'SENS1:AVER:STAT ON');
    session = writeE5080bScpi(session, 'SENS1:AVER:COUN 8');
    session = writeE5080bScpi(session, 'FORM:DATA REAL,32');
    session = writeE5080bScpi(session, 'FORM:BORD NORM');
    expect(session.state.sweep).toMatchObject({ sweepType: 'LOG', averagingEnabled: true, averagingCount: 8 });
    expect(session.state).toMatchObject({ dataFormat: 'REAL32', byteOrder: 'NORM' });
    expect(queryE5080bScpi(session, 'FORM:DATA?').response).toBe('REAL,32');
  });

  it('keeps RF OFF until an explicit enabled power limit is satisfied', () => {
    let session = createE5080bSession();
    session = writeE5080bScpi(session, 'OUTP ON');
    expect(session.state.rfOutputEnabled).toBe(false);
    expect(session.errorQueue.at(-1)?.code).toBe(-221);

    session = writeE5080bScpi(session, '*CLS');
    session = writeE5080bScpi(session, 'SYST:POW1:LIM -20 DBM');
    session = writeE5080bScpi(session, 'SYST:POW1:LIM:STAT ON');
    session = writeE5080bScpi(session, 'SOUR1:POW1 -30 DBM');
    session = writeE5080bScpi(session, 'OUTP ON');
    expect(session.state.rfOutputEnabled).toBe(true);
  });

  it('separates output and error queues and makes *OPC? deterministic', () => {
    let session = writeE5080bScpi(createE5080bSession(), 'INIT1:IMM');
    expect(session.pendingOperations).toEqual(['sweep']);
    session = writeE5080bScpi(session, '*OPC?');
    expect(session.outputQueue).toEqual(['1']);
    expect(session.pendingOperations).toEqual([]);
    const read = readE5080bScpi(session);
    expect(read.response).toBe('1');
    expect(read.session.outputQueue).toEqual([]);

    const unknown = writeE5080bScpi(read.session, 'NOPE 1');
    expect(unknown.errorQueue.at(-1)?.code).toBe(-113);
    expect(queryE5080bScpi(unknown, 'SYST:ERR?').response).toContain('-113');
  });

  it.each(['MAN', 'EXT'] as const)('keeps %s trigger armed and data stale until an event and completion', (trigger) => {
    let session = createE5080bSession();
    session = writeE5080bScpi(session, `TRIG:SOUR ${trigger}`);
    session = writeE5080bScpi(session, 'INIT1:IMM');
    expect(session.acquisition).toMatchObject({ status: 'armed', armedTrigger: trigger, dataFresh: false });
    expect(session.pendingOperations[0]).toContain('awaiting');

    const prematureOpc = queryE5080bScpi(session, '*OPC?');
    expect(prematureOpc.response).toBeNull();
    expect(prematureOpc.session.acquisition.status).toBe('armed');
    expect(prematureOpc.session.pendingOperations).not.toEqual([]);

    const prematureData = queryE5080bScpi(prematureOpc.session, 'CALC1:MEAS1:DATA:SDAT?');
    expect(prematureData.response).toBeNull();
    expect(prematureData.session.errorQueue.at(-1)).toMatchObject({ code: -230 });
    const prematureFormattedData = queryE5080bScpi(prematureData.session, 'CALC1:MEAS1:DATA:FDAT?');
    expect(prematureFormattedData.response).toBeNull();
    expect(prematureFormattedData.session.errorQueue.at(-1)).toMatchObject({ code: -230 });

    session = trigger === 'MAN'
      ? writeE5080bScpi(prematureFormattedData.session, '*TRG')
      : signalE5080bTriggerEvent(prematureFormattedData.session, 'EXT');
    expect(session.acquisition.status).toBe('sweeping');
    const complete = queryE5080bScpi(session, '*OPC?');
    expect(complete.response).toBe('1');
    expect(complete.session.acquisition).toMatchObject({ status: 'complete', dataFresh: true, sweepCount: 1 });
    expect(queryE5080bScpi(complete.session, 'CALC1:MEAS1:DATA:SDAT?').response).not.toBeNull();
  });

  it('does not let *TRG impersonate an external trigger edge', () => {
    let session = writeE5080bScpi(createE5080bSession(), 'TRIG:SOUR EXT');
    session = writeE5080bScpi(session, 'INIT1:IMM');
    session = writeE5080bScpi(session, '*TRG');
    expect(session.acquisition).toMatchObject({ status: 'armed', armedTrigger: 'EXT', dataFresh: false });
    expect(session.errorQueue.at(-1)).toMatchObject({ code: -221 });
  });

  it('keeps the canonical program RF OFF and ends with cleanup', () => {
    const program = createE5080bSafeSweepProgram(sweep);
    expect(program.some(({ message }) => message === 'OUTP ON')).toBe(false);
    expect(program.at(0)?.message).toBe('*IDN?');
    expect(program.find(({ id }) => id === 'rf-off-first')?.message).toBe('OUTP OFF');
    expect(program.at(-1)?.message).toBe('OUTP OFF');
  });
});

describe('E5080B RF math, calibration, fixture and PA safety', () => {
  it('converts gamma to impedance, return loss, and VSWR with fixed 50 ohm convention', () => {
    expect(gammaToImpedance({ re: 0, im: 0 })).toEqual({ re: 50, im: 0 });
    expect(gammaToImpedance({ re: 1 / 3, im: 0 }).re).toBeCloseTo(100, 9);
    expect(enaReturnLossDb({ re: 0.1, im: 0 })).toBeCloseTo(20, 9);
    expect(enaVswr({ re: 1 / 3, im: 0 })).toBeCloseTo(2, 9);
    expect(enaLogMagnitudeDb({ re: 0.5, im: 0 })).toBeCloseTo(-6.0206, 4);
  });

  it('produces a deterministic complex sweep and about 1.35 ns group delay', () => {
    const data = generateEnaSweep(sweep);
    expect(data).toHaveLength(201);
    expect(data[0]?.frequencyHz).toBe(1e9);
    expect(data.at(-1)?.frequencyHz).toBe(6e9);
    const delays = calculateGroupDelaySeconds(data);
    expect(delays[100]).toBeCloseTo(1.35e-9, 11);
  });

  it('makes IFBW change deterministic trace roughness, not only sweep-time text', () => {
    const narrowSweep = { ...sweep, ifBandwidthHz: 100 };
    const wideSweep = { ...sweep, ifBandwidthHz: 10_000 };
    const narrow = generateEnaSweep(narrowSweep).map(({ s21 }) => enaLogMagnitudeDb(s21));
    const wide = generateEnaSweep(wideSweep).map(({ s21 }) => enaLogMagnitudeDb(s21));
    const roughness = (values: readonly number[]) => values.slice(1, -1).reduce((sum, value, index) => (
      sum + Math.abs(values[index]! - 2 * value + values[index + 2]!)
    ), 0) / (values.length - 2);

    expect(estimateEnaTraceNoiseDbRms(wideSweep) / estimateEnaTraceNoiseDbRms(narrowSweep)).toBeCloseTo(10, 10);
    expect(roughness(wide)).toBeGreaterThan(roughness(narrow) * 3);
    expect(wide).not.toEqual(narrow);
  });

  it('keeps the PA compression model exactly zero below its drive threshold', () => {
    expect(estimateEnaPaCompressionDb(-40)).toBe(0);
    expect(estimateEnaPaCompressionDb(-25)).toBe(0);
    expect(estimateEnaPaCompressionDb(-15)).toBe(0);
    expect(estimateEnaPaCompressionDb(-7)).toBeCloseTo(1, 12);
  });

  it('classifies calibration stimulus changes without calling interpolation valid', () => {
    const calibration = calibrateEna(sweep, 'ECal', 'cable ends');
    expect(evaluateCalibrationValidity(calibration, sweep).status).toBe('valid');
    expect(evaluateCalibrationValidity(calibration, { ...sweep, startHz: 2e9, points: 301 }).status).toBe('interpolated');
    expect(evaluateCalibrationValidity(calibration, { ...sweep, stopHz: 7e9 }).status).toBe('outside-range');
    expect(evaluateCalibrationValidity(calibration, { ...sweep, sourcePowerDbm: -20 }).status).toBe('questionable');
    expect(evaluateCalibrationValidity(calibration, { ...sweep, ifBandwidthHz: 100 }).status).toBe('questionable');
  });

  it('keeps fixture model error and receiver guard visible', () => {
    expect(deembedSymmetricFixture(-3, 0.5, 0.1)).toEqual({ measuredS21Db: -3, deembeddedS21Db: -2, fixtureLossDb: 1, residualUncertaintyDb: 0.1 });
    expect(evaluateEnaReceiverSafety(25, 30, 0, 3)).toMatchObject({ port2ReceiverInputDbm: -5, permittedDbm: -3, safe: true });
    expect(evaluateEnaReceiverSafety(25, 20, 0, 3)).toMatchObject({ port2ReceiverInputDbm: 5, permittedDbm: -3, safe: false });
  });
});
