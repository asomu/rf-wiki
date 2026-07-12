import { describe, expect, it } from 'vitest';
import {
  N9020B_ANALYSIS_BANDWIDTH_MAX_HZ,
  calculateAclrDb,
  calculateIqCapture,
  calculateOccupiedBandwidth,
  completeN9020bTrigger,
  createN9020bSession,
  estimateSweepTimeSeconds,
  evaluateN9020bInputSafety,
  generateN9020bSpectrum,
  n9020bCommandCatalog,
  n9020bPreampMaxGainDb,
  queryN9020bScpi,
  readN9020bScpi,
  writeN9020bScpi,
} from '../../src/lib/instruments/sa';

describe('N9020B input level plan', () => {
  it('separates connector damage headroom from mixer/ADC headroom', () => {
    const decision = evaluateN9020bInputSafety({
      dutOutputAverageDbm: 40,
      dutOutputPeakDbm: 48,
      pathGainDb: -30,
      uncertaintyDb: 0.5,
      guardMarginDb: 1,
      pulseWidthSeconds: 100e-6,
      dutyCyclePercent: 10,
      dcVolts: 0,
      acCoupled: true,
      inputAttenuationDb: 20,
      preampGainDb: 0,
    });
    expect(decision.connectorAverageDbm).toBe(10);
    expect(decision.worstCasePeakDbm).toBe(19.5);
    expect(decision.averageHeadroomDb).toBe(18.5);
    expect(decision.mixerAverageDbm).toBe(-8.5);
    expect(decision.allowed).toBe(false);
    expect(decision.mixerHeadroomDb).toBeLessThan(0);
    expect(decision.reasons.join(' ')).toMatch(/ADC full-scale assumption/);
  });

  it('rejects connector over-power and DC independently', () => {
    const decision = evaluateN9020bInputSafety({
      dutOutputAverageDbm: 45,
      dutOutputPeakDbm: 46,
      pathGainDb: -10,
      uncertaintyDb: 1,
      guardMarginDb: 1,
      pulseWidthSeconds: 20e-6,
      dutyCyclePercent: 5,
      dcVolts: 1,
      acCoupled: false,
      inputAttenuationDb: 40,
      preampGainDb: 0,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/average connector power/);
    expect(decision.reasons.join(' ')).toMatch(/DC voltage/);
  });
});

describe('N9020B sweep and IQ calculations', () => {
  it('derives IQ sample rate, duration and bin spacing from analysis bandwidth', () => {
    const capture = calculateIqCapture(100e6, 200_000, 25);
    expect(capture.sampleRateHz).toBe(125e6);
    expect(capture.durationSeconds).toBeCloseTo(1.6e-3, 12);
    expect(capture.binSpacingHz).toBe(625);
    expect(capture.pretriggerSamples).toBe(50_000);
    expect(() => calculateIqCapture(N9020B_ANALYSIS_BANDWIDTH_MAX_HZ + 1, 1024)).toThrow();
  });

  it('uses the P26 low/high-band maximum nominal gain instead of one fixed value', () => {
    expect(n9020bPreampMaxGainDb(3.5e9)).toBe(20);
    expect(n9020bPreampMaxGainDb(4e9)).toBe(35);
  });

  it('makes a narrower RBW slower under the same span and points', () => {
    const wide = estimateSweepTimeSeconds(100e6, 1e6, 1001);
    const narrow = estimateSweepTimeSeconds(100e6, 100e3, 1001);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('generates deterministic trace data and recovers useful OBW/ACLR metrics', () => {
    const config = {
      centerHz: 3.5e9,
      spanHz: 400e6,
      channelBandwidthHz: 100e6,
      channelPowerDbm: -10,
      aclrDb: 45,
      rbwHz: 100e3,
      vbwHz: 300e3,
      detector: 'NORM' as const,
      points: 1001,
    };
    const first = generateN9020bSpectrum(config);
    const second = generateN9020bSpectrum(config);
    expect(second).toEqual(first);
    expect(first).toHaveLength(1001);
    expect(calculateOccupiedBandwidth(first, 99)).toBeGreaterThan(80e6);
    const aclr = calculateAclrDb(first, config.centerHz, config.channelBandwidthHz, config.rbwHz);
    expect(aclr.lowerDb).toBeGreaterThan(20);
    expect(aclr.upperDb).toBeGreaterThan(20);
  });
});

describe('bounded N9020B SCPI session', () => {
  it('keeps output and error queues separate and FIFO', () => {
    let session = createN9020bSession();
    session = queryN9020bScpi(session, '*IDN?');
    session = queryN9020bScpi(session, '*OPT?');
    session = writeN9020bScpi(session, 'NO:SYSTEM 1');
    expect(session.outputQueue).toHaveLength(2);
    expect(session.errorQueue).toHaveLength(1);
    let read = readN9020bScpi(session);
    expect(read.response).toContain('N9020B');
    read = readN9020bScpi(read.session);
    expect(read.response).toContain('B1X');
    expect(read.response).toContain('MPB');
    const errorQuery = queryN9020bScpi(read.session, 'SYST:ERR?');
    const errorRead = readN9020bScpi(errorQuery);
    expect(errorRead.response).toContain('-113');
  });

  it('requires a fresh acquisition before trace or marker data', () => {
    let session = createN9020bSession();
    session = queryN9020bScpi(session, 'TRAC? TRACE1');
    expect(session.errorQueue.at(-1)?.code).toBe(-230);
    session = writeN9020bScpi(session, '*CLS');
    session = writeN9020bScpi(session, 'INIT:IMM');
    session = writeN9020bScpi(session, 'CALC:MARK1:MAX');
    session = queryN9020bScpi(session, 'CALC:MARK1:Y?');
    expect(session.outputQueue).toHaveLength(1);
  });

  it('does not let FETCh initiate a one-button measurement implicitly', () => {
    let session = createN9020bSession();
    session = writeN9020bScpi(session, 'CONF:CHP');
    session = queryN9020bScpi(session, 'FETC:CHP?');
    expect(session.errorQueue.at(-1)?.code).toBe(-230);
    session = writeN9020bScpi(session, '*CLS');
    session = writeN9020bScpi(session, 'INIT:IMM');
    session = queryN9020bScpi(session, 'FETC:CHP?');
    expect(session.outputQueue).toHaveLength(1);
  });

  it('keeps non-immediate acquisitions pending until a matching host event', () => {
    let session = createN9020bSession();
    session = writeN9020bScpi(session, 'TRIG:SAN:SOUR EXT1');
    session = writeN9020bScpi(session, 'INIT:IMM');
    expect(session.state.acquisitionPending).toBe(true);
    expect(session.state.traceFresh).toBe(false);
    session = queryN9020bScpi(session, '*OPC?');
    expect(session.outputQueue).toHaveLength(0);
    expect(session.transcript.at(-1)?.outcome).toBe('would-time-out');
    session = completeN9020bTrigger(session, 'EXT1');
    expect(session.state.acquisitionPending).toBe(false);
    expect(session.state.traceFresh).toBe(true);
    session = queryN9020bScpi(session, '*OPC?');
    expect(session.outputQueue).toEqual(['1']);
  });

  it('uses measurement-qualified center-frequency state for PowerSuite measurements', () => {
    let session = createN9020bSession();
    session = writeN9020bScpi(session, 'CHP:FREQ:CENT 3.6 GHZ');
    expect(session.errorQueue.at(-1)?.code).toBe(-221);
    session = writeN9020bScpi(session, '*CLS');
    session = writeN9020bScpi(session, 'CONF:CHP');
    session = writeN9020bScpi(session, 'FREQ:CENT 3.9 GHZ');
    expect(session.errorQueue.at(-1)?.code).toBe(-221);
    session = writeN9020bScpi(session, '*CLS');
    session = writeN9020bScpi(session, 'CHP:FREQ:CENT 3.6 GHZ');
    expect(session.state.centerHz).toBe(3.6e9);
    session = queryN9020bScpi(session, 'CHP:FREQ:CENT?');
    expect(readN9020bScpi(session).response).toBe('3600000000');
    session = writeN9020bScpi(session, 'CONF:ACP');
    session = writeN9020bScpi(session, 'ACP:FREQ:CENT 3.7 GHZ');
    session = writeN9020bScpi(session, 'CONF:CHP');
    expect(session.state.centerHz).toBe(3.6e9);
  });

  it('rejects multi-command messages and unsupported analyzer applications', () => {
    let session = createN9020bSession();
    session = writeN9020bScpi(session, 'FREQ:CENT 3.5 GHZ;FREQ:SPAN 100 MHZ');
    expect(session.errorQueue.at(-1)?.code).toBe(-113);
    session = writeN9020bScpi(session, 'INST:SEL RTSA');
    expect(session.errorQueue.at(-1)?.code).toBe(-113);
  });

  it('keeps center/span and start/stop as two views of the same frequency range', () => {
    let session = createN9020bSession({ centerHz: 3.5e9, spanHz: 200e6 });
    session = writeN9020bScpi(session, 'FREQ:STAR 3.3 GHZ');
    expect(session.state.centerHz).toBe(3.45e9);
    expect(session.state.spanHz).toBe(300e6);
    session = queryN9020bScpi(session, 'FREQ:STOP?');
    const read = readN9020bScpi(session);
    expect(Number(read.response)).toBe(3.6e9);
  });

  it('tracks ASCII versus binary trace-transfer metadata without pretending text is binary bytes', () => {
    let session = createN9020bSession();
    session = writeN9020bScpi(session, 'FORM:DATA REAL,32');
    session = writeN9020bScpi(session, 'FORM:BORD SWAP');
    session = writeN9020bScpi(session, 'INIT:IMM');
    session = queryN9020bScpi(session, 'TRAC? TRACE1');
    const read = readN9020bScpi(session);
    expect(read.response).toBe('#MOCK-BINARY:REAL,32:SWAP:1001');
  });

  it('provides provenance for every implemented command', () => {
    expect(n9020bCommandCatalog.length).toBeGreaterThan(20);
    for (const command of n9020bCommandCatalog) {
      expect(command.supportedModels).toEqual(['N9020B']);
      expect(command.firmwareScope).toBe('A.43.49');
      expect(command.source.url).toMatch(/^https:\/\//);
      expect(command.source.section.length).toBeGreaterThan(0);
    }
    expect(n9020bCommandCatalog.find(({ id }) => id === 'configure-acp')?.longForm).toBe('CONFIGURE:ACPOWER');
    expect(n9020bCommandCatalog.find(({ id }) => id === 'configure-obw')?.longForm).toBe('CONFIGURE:OBWIDTH');
  });
});
