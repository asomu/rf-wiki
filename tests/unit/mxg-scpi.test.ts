import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type {
  MxgSession,
  PaSafetyEnvelope,
  ScpiError,
} from '../../src/types/instruments';
import { dbm, decibels } from '../../src/types/units';
import {
  createN5182bSession,
  createN5182bSafeCwProgram,
  enqueueN5182bError,
  evaluatePaPowerBudget,
  evaluatePaSafety,
  getN5182bArbSampleRateMaxHz,
  getN5182bFrequencyMaxHz,
  N5182B_ERROR_DRAIN_MAX_QUERIES,
  N5182B_ERROR_QUEUE_CAPACITY,
  n5182bBuiltInWaveformRecords,
  n5182bCommandCatalog,
  n5182bProgrammingReference,
  n5182bScpiReference,
  parseN5182bScpi,
  queryN5182bScpi,
  readN5182bScpi,
  writeN5182bScpi,
} from '../../src/lib/instruments';

function writeMany(session: MxgSession, ...commands: readonly string[]): MxgSession {
  return commands.reduce(writeN5182bScpi, session);
}

describe('N5182B command catalog and one-command parser', () => {
  it('gives every command explicit N5182B, option, mock, and official-source metadata', () => {
    expect(n5182bCommandCatalog.length).toBeGreaterThanOrEqual(12);
    for (const command of n5182bCommandCatalog) {
      expect(command.supportedModels).toEqual(['N5182B']);
      expect(['session', 'encoding-only']).toContain(command.mockSupport);
      expect(command.source.organization).toBe('Keysight Technologies');
      expect(command.source.url).toMatch(/^https:\/\/www\.keysight\.com\//);
      expect(command.source.documentNumber).not.toBe('');
      expect(command.source.section).not.toBe('');
    }

    expect(n5182bCommandCatalog.find(({ id }) => id === 'arb-waveform')?.requiredAnyOfOptions)
      .toEqual(['656']);
    for (const commandId of [
      'arb-sample-clock',
      'arb-runtime-scaling',
      'arb-trigger-source',
    ] as const) {
      expect(n5182bCommandCatalog.find(({ id }) => id === commandId)?.requiredAnyOfOptions)
        .toEqual(['656']);
    }
    expect(n5182bScpiReference).toMatchObject({
      documentNumber: 'N5180-90057',
      assetId: '9018-03690',
    });
    expect(n5182bProgrammingReference).toMatchObject({
      documentNumber: 'N5180-90074',
      assetId: '9018-03987',
    });
  });

  it('accepts conservative short/long forms and normalizes one command', () => {
    expect(parseN5182bScpi(':SOUR:FREQ 3.5 GHZ')).toEqual({
      ok: true,
      command: {
        commandId: 'frequency-cw',
        form: 'write',
        raw: ':SOUR:FREQ 3.5 GHZ',
        argument: '3.5 GHZ',
      },
    });
    expect(parseN5182bScpi('SOURCE:FREQUENCY:CW?')).toMatchObject({
      ok: true,
      command: { commandId: 'frequency-cw', form: 'query', argument: null },
    });
    expect(parseN5182bScpi(':OUTP:MOD 0')).toMatchObject({
      ok: true,
      command: { commandId: 'modulation-output', form: 'write' },
    });
    expect(parseN5182bScpi(':SOUR:RAD:ARB:SCL:RATE 80 MHZ')).toMatchObject({
      ok: true,
      command: { commandId: 'arb-sample-clock', form: 'write' },
    });
    expect(parseN5182bScpi(':SOURCE:RADIO:ARB:TRIGGER:SOURCE?')).toMatchObject({
      ok: true,
      command: { commandId: 'arb-trigger-source', form: 'query' },
    });
  });

  it('rejects semicolon batches, unknown headers, and invalid query parameters', () => {
    expect(parseN5182bScpi('FREQ 1 GHZ;POW -30 DBM')).toMatchObject({
      ok: false,
      error: { code: -102 },
    });
    expect(parseN5182bScpi('NOT:A:COMMAND 1')).toMatchObject({
      ok: false,
      error: { code: -113 },
    });
    expect(parseN5182bScpi('FREQ? 1 GHZ')).toMatchObject({
      ok: false,
      error: { code: -108 },
    });
  });
});

describe('N5182B SCPI session, queues, and reducer', () => {
  it('derives RF and ARB capabilities from a consistent installed-option set', () => {
    expect(createN5182bSession().installedOptions).toEqual(['506', '656']);
    expect(getN5182bFrequencyMaxHz(['501'])).toBe(1e9);
    expect(getN5182bFrequencyMaxHz(['503'])).toBe(3e9);
    expect(getN5182bFrequencyMaxHz(['506'])).toBe(6e9);
    expect(getN5182bFrequencyMaxHz(['656'])).toBeNull();
    expect(getN5182bArbSampleRateMaxHz(['506'])).toBeNull();
    expect(getN5182bArbSampleRateMaxHz(['506', '656'])).toBe(100e6);
    expect(getN5182bArbSampleRateMaxHz(['506', '656', '657'])).toBe(200e6);
    expect(() => createN5182bSession({ installedOptions: ['506', '657'] }))
      .toThrow(/657 requires.*656/);

    const option503 = createN5182bSession({
      installedOptions: ['503', '656'],
      safetyEnvelope: null,
    });
    const atLimit = writeN5182bScpi(option503, 'FREQ 3 GHZ');
    expect(atLimit.instrumentState.frequencyHz).toBe(3e9);
    const aboveLimit = writeN5182bScpi(atLimit, 'FREQ 3.1 GHZ');
    expect(aboveLimit.instrumentState.frequencyHz).toBe(3e9);
    expect(aboveLimit.errorQueue.at(-1)).toMatchObject({ code: -222 });

    const withoutFrequencyOption = writeN5182bScpi(
      createN5182bSession({ installedOptions: ['656'] }),
      'FREQ 1 GHZ',
    );
    expect(withoutFrequencyOption.errorQueue.at(-1)).toMatchObject({
      code: -221,
      message: expect.stringContaining('501, 503, or 506'),
    });
  });

  it('runs the canonical safe-CW program through the deterministic reducer', () => {
    const program = createN5182bSafeCwProgram({ frequencyHz: 2.4e9, powerDbm: -35 });
    expect(program.some(({ phase }) => phase === 'rf-enable')).toBe(false);
    const drainSteps = program.filter(({ commandId }) => commandId === 'system-error-next');
    expect(drainSteps).toHaveLength(3);
    expect(drainSteps.every(({ repeatQueryUntil }) => (
      repeatQueryUntil?.maximumQueries === N5182B_ERROR_DRAIN_MAX_QUERIES
      && repeatQueryUntil.untilResponseCode === 0
    ))).toBe(true);

    let session = createN5182bSession();
    for (const step of program) {
      session = step.operation === 'query'
        ? queryN5182bScpi(session, step.message).session
        : writeN5182bScpi(session, step.message);
    }

    expect(session.instrumentState).toMatchObject({
      frequencyHz: 2.4e9,
      powerDbm: -35,
      rfOutputEnabled: false,
    });
    expect(session.outputQueue).toEqual([]);
    expect(session.errorQueue).toEqual([]);
    expect(session.pendingOperations).toEqual([]);
  });

  it('keeps the downloadable Python dry-run in canonical safe-CW program order', () => {
    const program = createN5182bSafeCwProgram({ frequencyHz: 3.5e9, powerDbm: -30 });
    const dryRun = spawnSync(
      'python3',
      [
        '-m',
        'examples.mxg_pyvisa',
        '--frequency-hz',
        '3500000000',
        '--power-dbm',
        '-30',
        '--hold-seconds',
        '0',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONNOUSERSITE: '1',
        },
      },
    );
    expect(dryRun.status, `${dryRun.stdout}\n${dryRun.stderr}`).toBe(0);

    let cursor = 0;
    for (const step of program) {
      const next = dryRun.stdout.indexOf(step.message, cursor);
      expect(next, `Python dry-run is missing ordered step ${step.id}: ${step.message}`)
        .toBeGreaterThanOrEqual(cursor);
      cursor = next + step.message.length;
    }
  });

  it('keeps query responses in the output queue until a separate read', () => {
    const written = writeN5182bScpi(createN5182bSession(), '*IDN?');
    expect(written.outputQueue).toEqual([
      'Keysight Technologies,N5182B,MY00000000,B.01.96',
    ]);

    const read = readN5182bScpi(written);
    expect(read.status).toBe('response');
    expect(read.response).toBe('Keysight Technologies,N5182B,MY00000000,B.01.96');
    expect(read.session.outputQueue).toEqual([]);
    expect(read.session.transcript.map(({ direction }) => direction)).toEqual(['write', 'read']);
  });

  it('reports an empty read as a deterministic would-time-out host condition', () => {
    const result = readN5182bScpi(createN5182bSession());
    expect(result).toMatchObject({ status: 'would-time-out', response: null });
    expect(result.session.errorQueue).toEqual([]);
    expect(result.session.transcript.at(-1)?.outcome).toBe('would-time-out');
  });

  it('interrupts an unread query response and exposes -410 through SYST:ERR?', () => {
    let session = writeN5182bScpi(createN5182bSession(), '*IDN?');
    session = writeN5182bScpi(session, 'FREQ 2 GHZ');
    expect(session.outputQueue).toEqual([]);
    expect(session.errorQueue[0]).toMatchObject({ code: -410, message: 'Query INTERRUPTED' });

    const errorResult = queryN5182bScpi(session, 'SYST:ERR?');
    expect(errorResult.response).toBe('-410,"Query INTERRUPTED"');
    expect(errorResult.session.errorQueue).toEqual([]);
  });

  it('keeps the remote error queue FIFO and *CLS clears it without resetting settings', () => {
    let session = createN5182bSession();
    session = writeN5182bScpi(session, 'NOPE 1');
    session = writeN5182bScpi(session, 'FREQ 8 KHZ');
    expect(session.errorQueue.map(({ code }) => code)).toEqual([-113, -222]);

    const first = queryN5182bScpi(session, 'SYSTEM:ERROR:NEXT?');
    expect(first.response).toBe('-113,"Undefined header"');
    expect(first.session.errorQueue.map(({ code }) => code)).toEqual([-222]);

    const configured = writeN5182bScpi(first.session, 'FREQ 2.4 GHZ');
    const cleared = writeN5182bScpi(configured, '*CLS');
    expect(cleared.errorQueue).toEqual([]);
    expect(cleared.instrumentState.frequencyHz).toBe(2.4e9);
    expect(queryN5182bScpi(cleared, 'SYST:ERR?').response).toBe('+0,"No error"');
  });

  it('retains the exact error on each transcript entry after a multi-error queue is drained', () => {
    let session = createN5182bSession();
    session = writeN5182bScpi(session, 'NOPE 1');
    session = writeN5182bScpi(session, 'FREQ 8 KHZ');

    expect(session.transcript.filter(({ outcome }) => outcome === 'error').map(({ error }) => error))
      .toEqual([
        { code: -113, message: 'Undefined header' },
        { code: -222, message: 'Data out of range' },
      ]);

    session = queryN5182bScpi(session, 'SYST:ERR?').session;
    session = queryN5182bScpi(session, 'SYST:ERR?').session;
    expect(session.errorQueue).toEqual([]);
    expect(session.transcript.filter(({ outcome }) => outcome === 'error').map(({ error }) => error))
      .toEqual([
        { code: -113, message: 'Undefined header' },
        { code: -222, message: 'Data out of range' },
      ]);
    expect(session.transcript.filter(({ outcome }) => outcome !== 'error').every(({ error }) => error === null))
      .toBe(true);
  });

  it('caps the X-Series error queue at 30 and replaces the newest slot with overflow', () => {
    let queue: readonly ScpiError[] = [];
    for (let index = 0; index < N5182B_ERROR_QUEUE_CAPACITY + 5; index += 1) {
      queue = enqueueN5182bError(queue, { code: -113, message: `Undefined ${index}` });
    }
    expect(queue).toHaveLength(30);
    expect(queue.at(-1)).toEqual({ code: -350, message: 'Queue overflow' });
    expect(queue[0]).toEqual({ code: -113, message: 'Undefined 0' });
  });

  it('uses the canonical 31-query bound to drain 30 errors and confirm the +0 terminator', () => {
    const drainStep = createN5182bSafeCwProgram({ frequencyHz: 1e9, powerDbm: -30 })
      .find(({ id }) => id === 'configure-error-drain');
    expect(drainStep?.repeatQueryUntil).toEqual({
      maximumQueries: N5182B_ERROR_QUEUE_CAPACITY + 1,
      untilResponseCode: 0,
    });

    let session = createN5182bSession();
    for (let index = 0; index < N5182B_ERROR_QUEUE_CAPACITY; index += 1) {
      session = writeN5182bScpi(session, `NOPE:${index}`);
    }

    const responses: string[] = [];
    const repeat = drainStep?.repeatQueryUntil;
    expect(repeat).toBeDefined();
    if (!repeat) return;
    for (let queryIndex = 0; queryIndex < repeat.maximumQueries; queryIndex += 1) {
      const result = queryN5182bScpi(session, drainStep.message);
      session = result.session;
      responses.push(result.response ?? '');
      if (Number.parseInt(result.response ?? '', 10) === repeat.untilResponseCode) break;
    }

    expect(responses).toHaveLength(N5182B_ERROR_DRAIN_MAX_QUERIES);
    expect(responses.at(-1)).toBe('+0,"No error"');
    expect(session.errorQueue).toEqual([]);
  });

  it('applies frequency, power, output, and reset state transitions deterministically', () => {
    let session = writeMany(
      createN5182bSession({ safetyEnvelope: null }),
      'FREQ 3.5 GHZ',
      'POW -20 DBM',
      'OUTP ON',
      'OUTP:MOD OFF',
    );
    expect(session.instrumentState).toMatchObject({
      frequencyHz: 3.5e9,
      powerDbm: -20,
      rfOutputEnabled: true,
      modulationEnabled: false,
    });
    expect(queryN5182bScpi(session, 'FREQ?').response).toBe('3500000000');

    session = writeN5182bScpi(session, '*RST');
    expect(session.instrumentState).toMatchObject({
      frequencyHz: 1e9,
      powerDbm: -135,
      rfOutputEnabled: false,
      modulationEnabled: true,
      arbEnabled: false,
    });
    expect(session.pendingOperations.at(-1)?.kind).toBe('reset');

    const opc = queryN5182bScpi(session, '*OPC?');
    expect(opc.response).toBe('1');
    expect(opc.session.pendingOperations).toEqual([]);
  });

  it('selects and enables a built-in ARB waveform only when an ARB option is installed', () => {
    let session = createN5182bSession();
    session = writeN5182bScpi(session, 'RAD:ARB:WAV "WFM1:QPSK-DEMO"');
    expect(session.instrumentState.selectedWaveformPath).toBe('WFM1:QPSK-DEMO');
    expect(session.pendingOperations.at(-1)?.kind).toBe('waveform-select');
    session = writeN5182bScpi(session, 'RAD:ARB ON');
    expect(session.instrumentState.arbEnabled).toBe(true);

    const noOption = writeN5182bScpi(
      createN5182bSession({ installedOptions: [] }),
      'RAD:ARB:WAV "WFM1:QPSK-DEMO"',
    );
    expect(noOption.instrumentState.selectedWaveformPath).toBeNull();
    expect(noOption.errorQueue.at(-1)).toMatchObject({ code: -221 });
  });

  it('controls sample clock, runtime scaling, and trigger source with option-aware limits', () => {
    let session = createN5182bSession();
    expect(session.instrumentState).toMatchObject({
      arbSampleClockRateHz: 100e6,
      arbRuntimeScalingPercent: 70,
      arbTriggerSource: 'EXT',
    });

    session = writeMany(
      session,
      'SOUR:RAD:ARB:SCL:RATE 80 MHZ',
      'SOUR:RAD:ARB:RSC 42.5',
      'SOUR:RAD:ARB:TRIG:SOUR BUS',
    );
    expect(session.instrumentState).toMatchObject({
      arbSampleClockRateHz: 80e6,
      arbRuntimeScalingPercent: 42.5,
      arbTriggerSource: 'BUS',
    });
    expect(queryN5182bScpi(session, 'RAD:ARB:SCL:RATE?').response).toBe('80000000');
    expect(queryN5182bScpi(session, 'RAD:ARB:RSC?').response).toBe('42.5');
    expect(queryN5182bScpi(session, 'RAD:ARB:TRIG?').response).toBe('BUS');

    const over656Limit = writeN5182bScpi(session, 'RAD:ARB:SCL:RATE 100.1 MHZ');
    expect(over656Limit.instrumentState.arbSampleClockRateHz).toBe(80e6);
    expect(over656Limit.errorQueue.at(-1)).toMatchObject({ code: -222 });
    const belowMinimum = writeN5182bScpi(session, 'RAD:ARB:SCL:RATE 99 HZ');
    expect(belowMinimum.instrumentState.arbSampleClockRateHz).toBe(80e6);
    expect(belowMinimum.errorQueue.at(-1)).toMatchObject({ code: -222 });
    expect(writeN5182bScpi(session, 'RAD:ARB:RSC 0').errorQueue.at(-1))
      .toMatchObject({ code: -222 });
    expect(writeN5182bScpi(session, 'RAD:ARB:TRIG:SOUR IMM').errorQueue.at(-1))
      .toMatchObject({ code: -224 });

    let upgraded = createN5182bSession({ installedOptions: ['506', '656', '657'] });
    expect(upgraded.instrumentState.arbSampleClockRateHz).toBe(200e6);
    upgraded = writeMany(
      upgraded,
      'RAD:ARB:SCL:RATE 150 MHZ',
      'RAD:ARB:RSC 35',
      'RAD:ARB:TRIG:SOUR KEY',
      '*RST',
    );
    expect(upgraded.instrumentState).toMatchObject({
      arbSampleClockRateHz: 200e6,
      arbRuntimeScalingPercent: 70,
      arbTriggerSource: 'EXT',
    });

    const noArbOption = writeN5182bScpi(
      createN5182bSession({ installedOptions: ['506'] }),
      'RAD:ARB:RSC 70',
    );
    expect(noArbOption.errorQueue.at(-1)).toMatchObject({ code: -221 });
  });

  it('keeps missing waveforms and malformed values out of instrument state', () => {
    const initial = createN5182bSession();
    const missing = writeN5182bScpi(initial, 'RAD:ARB:WAV "WFM1:ABSENT"');
    expect(missing.instrumentState).toEqual(initial.instrumentState);
    expect(missing.errorQueue.at(-1)).toMatchObject({ code: -256 });

    const malformed = writeN5182bScpi(initial, 'POW LOUD');
    expect(malformed.instrumentState.powerDbm).toBe(-135);
    expect(malformed.errorQueue.at(-1)).toMatchObject({ code: -224 });
  });
});

describe('PA safety envelope', () => {
  const envelope: PaSafetyEnvelope = {
    dutMaxInputDbm: dbm(0),
    sourceToDutGainDb: decibels(10),
    pathUncertaintyDb: decibels(1),
    guardMarginDb: decibels(3),
    maximumDutyCyclePercent: 100,
    requireRfOffForStimulusChange: true,
  };

  it('keeps guard margin out of the physical DUT estimate and applies it only to the permitted limit', () => {
    const baseInput = {
      sourceAveragePowerDbm: dbm(-25),
      waveformCrestFactorDb: decibels(8),
      envelope: {
        ...envelope,
        dutMaxInputDbm: dbm(-10),
        sourceToDutGainDb: decibels(-3),
        pathUncertaintyDb: decibels(0.7),
        guardMarginDb: decibels(2),
      },
    };
    const decision = evaluatePaPowerBudget(baseInput);
    const largerGuard = evaluatePaPowerBudget({
      ...baseInput,
      envelope: { ...baseInput.envelope, guardMarginDb: decibels(5) },
    });

    expect(decision.estimatedDutInputDbm).toBeCloseTo(-19.3, 12);
    expect(largerGuard.estimatedDutInputDbm).toBeCloseTo(-19.3, 12);
    expect(decision.permittedDutInputDbm).toBe(-12);
    expect(largerGuard.permittedDutInputDbm).toBe(-15);
    expect(decision.headroomDb).toBeCloseTo(7.3, 12);
    expect(largerGuard.headroomDb).toBeCloseTo(4.3, 12);
  });

  it('blocks RF enable and unsafe hot power changes while preserving the prior state', () => {
    let session = createN5182bSession({ safetyEnvelope: envelope });
    session = writeN5182bScpi(session, 'POW -5 DBM');
    const blockedEnable = writeN5182bScpi(session, 'OUTP ON');
    expect(blockedEnable.instrumentState.rfOutputEnabled).toBe(false);
    expect(blockedEnable.errorQueue.at(-1)).toMatchObject({ code: -221 });

    session = writeMany(session, 'POW -20 DBM', 'OUTP ON');
    expect(session.instrumentState.rfOutputEnabled).toBe(true);
    const blockedPower = writeN5182bScpi(session, 'POW 0 DBM');
    expect(blockedPower.instrumentState.powerDbm).toBe(-20);
    expect(blockedPower.instrumentState.rfOutputEnabled).toBe(true);
    expect(blockedPower.errorQueue.at(-1)).toMatchObject({ code: -221 });
  });

  it('requires RF off before selecting or changing ARB playback state', () => {
    let session = writeMany(
      createN5182bSession({ safetyEnvelope: envelope }),
      'POW -20 DBM',
      'OUTP ON',
    );
    const blocked = writeN5182bScpi(session, 'RAD:ARB:WAV "WFM1:QPSK-DEMO"');
    expect(blocked.instrumentState.selectedWaveformPath).toBeNull();
    expect(blocked.errorQueue.at(-1)?.message).toContain('turn RF output off');

    session = writeMany(blocked, 'OUTP OFF', '*CLS', 'RAD:ARB:WAV "WFM1:QPSK-DEMO"');
    expect(session.instrumentState.selectedWaveformPath).toBe('WFM1:QPSK-DEMO');
  });

  it('blocks every RF stimulus hot-change until RF output is off', () => {
    const enabled = writeMany(
      createN5182bSession({ safetyEnvelope: envelope }),
      'FREQ 2 GHZ',
      'POW -20 DBM',
      'RAD:ARB:WAV "WFM1:QPSK-DEMO"',
      'RAD:ARB:SCL:RATE 80 MHZ',
      'RAD:ARB:RSC 70',
      'RAD:ARB:TRIG:SOUR EXT',
      'RAD:ARB ON',
      'OUTP ON',
    );
    expect(enabled.instrumentState.rfOutputEnabled).toBe(true);

    const hotChanges = [
      'FREQ 2.1 GHZ',
      'POW -25 DBM',
      'OUTP:MOD OFF',
      'RAD:ARB:WAV "WFM1:TWO_TONE"',
      'RAD:ARB:SCL:RATE 90 MHZ',
      'RAD:ARB:RSC 50',
      'RAD:ARB:TRIG:SOUR BUS',
      'RAD:ARB OFF',
    ] as const;

    let session = enabled;
    for (const command of hotChanges) {
      const before = session.instrumentState;
      session = writeN5182bScpi(session, command);
      expect(session.instrumentState).toEqual(before);
      expect(session.errorQueue.at(-1)).toMatchObject({
        code: -221,
        message: expect.stringContaining('turn RF output off'),
      });
    }

    session = writeMany(session, 'OUTP OFF', '*CLS', 'FREQ 2.1 GHZ', 'RAD:ARB:RSC 50');
    expect(session.instrumentState).toMatchObject({
      rfOutputEnabled: false,
      frequencyHz: 2.1e9,
      arbRuntimeScalingPercent: 50,
    });
  });

  it('adds path uncertainty and a playing waveform crest factor to the DUT peak estimate', () => {
    const waveform = n5182bBuiltInWaveformRecords.find(({ id }) => id === 'ofdm_like');
    expect(waveform).toBeDefined();
    const waveformCrestFactorDb = waveform?.crestFactorDb ?? 0;
    expect(waveformCrestFactorDb).toBeGreaterThan(5);
    const peakEnvelope: PaSafetyEnvelope = {
      dutMaxInputDbm: dbm(0),
      sourceToDutGainDb: decibels(0),
      pathUncertaintyDb: decibels(1),
      guardMarginDb: decibels(2),
      maximumDutyCyclePercent: 100,
      requireRfOffForStimulusChange: true,
    };
    let session = writeN5182bScpi(
      createN5182bSession({ safetyEnvelope: peakEnvelope }),
      'POW -8 DBM',
    );

    const cwDecision = evaluatePaSafety(session.instrumentState, peakEnvelope);
    expect(cwDecision).toMatchObject({
      allowed: true,
      estimatedDutAverageDbm: -8,
      estimatedDutInputDbm: -7,
      waveformCrestFactorDb: 0,
      permittedDutInputDbm: -2,
    });

    session = writeMany(session, 'RAD:ARB:WAV "WFM1:OFDM_LIKE"', 'RAD:ARB ON');
    const modulatedDecision = evaluatePaSafety(session.instrumentState, peakEnvelope);
    expect(modulatedDecision.allowed).toBe(false);
    expect(modulatedDecision.estimatedDutAverageDbm).toBe(-8);
    expect(modulatedDecision.waveformCrestFactorDb).toBeCloseTo(waveformCrestFactorDb, 12);
    expect(modulatedDecision.estimatedDutInputDbm)
      .toBeCloseTo(-7 + waveformCrestFactorDb, 12);
    expect(modulatedDecision.permittedDutInputDbm).toBe(-2);
    expect(modulatedDecision.headroomDb)
      .toBeCloseTo(5 - waveformCrestFactorDb, 12);

    const blocked = writeN5182bScpi(session, 'OUTP ON');
    expect(blocked.instrumentState.rfOutputEnabled).toBe(false);
    expect(blocked.errorQueue.at(-1)).toMatchObject({ code: -221 });

    const hotCarrier = writeMany(
      createN5182bSession({ safetyEnvelope: peakEnvelope }),
      'POW -8 DBM',
      'RAD:ARB:WAV "WFM1:OFDM_LIKE"',
      'RAD:ARB ON',
      'OUTP:MOD OFF',
      'OUTP ON',
    );
    expect(hotCarrier.instrumentState.rfOutputEnabled).toBe(true);
    const blockedHotModulation = writeN5182bScpi(hotCarrier, 'OUTP:MOD ON');
    expect(blockedHotModulation.instrumentState.modulationEnabled).toBe(false);
    expect(blockedHotModulation.errorQueue.at(-1)).toMatchObject({ code: -221 });
  });

  it('rejects a planned PA duty cycle above the configured test-program limit', () => {
    const dutyEnvelope: PaSafetyEnvelope = {
      ...envelope,
      maximumDutyCyclePercent: 50,
    };
    const session = createN5182bSession({ safetyEnvelope: dutyEnvelope });
    const atLimit = evaluatePaSafety(
      { ...session.instrumentState, plannedDutyCyclePercent: 50 },
      dutyEnvelope,
    );
    expect(atLimit.allowed).toBe(true);

    const aboveLimit = evaluatePaSafety(
      { ...session.instrumentState, plannedDutyCyclePercent: 50.1 },
      dutyEnvelope,
    );
    expect(aboveLimit.allowed).toBe(false);
    expect(aboveLimit.reasons).toContain(
      'Planned duty cycle 50.1% exceeds the safety limit 50.0%.',
    );
    expect(() => evaluatePaSafety(
      { ...session.instrumentState, plannedDutyCyclePercent: 101 },
      dutyEnvelope,
    )).toThrow(/between 0 and 100/);
  });
});
