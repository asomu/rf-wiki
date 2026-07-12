import { describe, expect, it } from 'vitest';
import {
  calculatePaDcMetrics,
  createN6705cMockState,
  createN6705cSafeBiasProgram,
  evaluateDigitizedCapture,
  evaluateN6752aOperatingPoint,
  evaluateRemoteSense,
  evaluateSlewTransient,
  executeN6705cMockCommand,
  getN6752aMaximumCurrentAtVoltage,
  N6752A_DIGITIZER_MAX_POINTS,
  N6752A_DIGITIZER_MAX_SAMPLE_RATE_HZ,
  n6705cCommandCatalog,
  n6705cProgrammingReference,
} from '../../src/lib/instruments/psu';

describe('N6705C/N6752A SCPI catalog provenance', () => {
  it('covers every semantic command handled by the reducer', () => {
    expect(n6705cCommandCatalog.map(({ id }) => id)).toEqual([
      'identity',
      'options',
      'channel-model',
      'channel-options',
      'operation-complete',
      'clear-status',
      'system-error',
      'output',
      'voltage',
      'current',
      'voltage-protection',
      'current-protection-state',
      'current-protection-delay',
      'voltage-slew',
      'operation-condition',
      'abort-transient',
      'abort-acquisition',
      'initiate-transient',
      'bus-trigger',
      'list-voltage',
      'list-dwell',
      'voltage-mode',
      'current-mode',
      'transient-trigger-source',
    ]);
    expect(new Set(n6705cCommandCatalog.map(({ id }) => id)).size)
      .toBe(n6705cCommandCatalog.length);
  });

  it('pins long/short forms, operation, safety and official applicability metadata', () => {
    expect(n6705cProgrammingReference).toMatchObject({
      organization: 'Keysight Technologies',
      documentNumber: '9018-03617',
    });
    for (const command of n6705cCommandCatalog) {
      expect(command.longForm.length).toBeGreaterThan(0);
      expect(command.shortForm.length).toBeGreaterThan(0);
      expect(command.forms.length).toBeGreaterThan(0);
      expect(command.stateEffect.length).toBeGreaterThan(0);
      expect(command.safetyClass.length).toBeGreaterThan(0);
      expect(command.supportedModels).toEqual(['N6705C + N6752A']);
      expect(command.firmwareScope).toBe('E_02_09_3271');
      expect(command.optionScope.length).toBeGreaterThan(0);
      expect(command.source).toMatchObject({
        organization: 'Keysight Technologies',
        documentNumber: '9018-03617',
      });
      expect(command.source.url).toMatch(/^https:\/\/www\.keysight\.com\//);
      expect(command.source.section.length).toBeGreaterThan(0);
    }
  });
});

describe('N6752A operating envelope and protection', () => {
  it('does not treat 50 V and 10 A as a simultaneous operating point', () => {
    expect(getN6752aMaximumCurrentAtVoltage(10)).toBe(10);
    expect(getN6752aMaximumCurrentAtVoltage(28)).toBeCloseTo(100 / 28, 8);
    expect(getN6752aMaximumCurrentAtVoltage(50)).toBe(2);
  });

  it('distinguishes CV, CC, power-envelope limiting and OCP trip', () => {
    const base = {
      voltageSetpointV: 28,
      currentLimitA: 3,
      outputEnabled: true,
      ovpLevelV: 30,
      ocpEnabled: false,
      ocpDelayMs: 20,
      timeInCurrentLimitMs: 0,
    };
    expect(evaluateN6752aOperatingPoint({ ...base, loadResistanceOhm: 20 }).mode).toBe('CV');
    expect(evaluateN6752aOperatingPoint({ ...base, currentLimitA: 1, loadResistanceOhm: 10 }).mode).toBe('CC');
    const envelope = evaluateN6752aOperatingPoint({ ...base, currentLimitA: 10, loadResistanceOhm: 5 });
    expect(envelope.mode).toBe('POWER_ENVELOPE');
    expect(envelope.powerW).toBeCloseTo(100, 8);
    const trip = evaluateN6752aOperatingPoint({
      ...base,
      currentLimitA: 1,
      loadResistanceOhm: 10,
      ocpEnabled: true,
      timeInCurrentLimitMs: 20,
    });
    expect(trip.mode).toBe('TRIPPED');
    expect(trip.protectionReason).toContain('OCP');
  });

  it('trips when the setpoint exceeds OVP', () => {
    const result = evaluateN6752aOperatingPoint({
      voltageSetpointV: 30,
      currentLimitA: 1,
      loadResistanceOhm: 100,
      outputEnabled: true,
      ovpLevelV: 29,
      ocpEnabled: false,
      ocpDelayMs: 20,
      timeInCurrentLimitMs: 0,
    });
    expect(result.mode).toBe('TRIPPED');
    expect(result.voltageV).toBe(0);
  });
});

describe('N6752A wiring, slew and acquisition', () => {
  it('moves voltage regulation from terminal to DUT while sense headroom remains', () => {
    const local = evaluateRemoteSense({
      setVoltageV: 28,
      loadCurrentA: 4,
      forceLeadResistanceOhmPerLead: 0.05,
      remoteSenseEnabled: false,
    });
    const remote = evaluateRemoteSense({
      setVoltageV: 28,
      loadCurrentA: 4,
      forceLeadResistanceOhmPerLead: 0.05,
      remoteSenseEnabled: true,
    });
    expect(local.dutVoltageV).toBeCloseTo(27.6);
    expect(remote.dutVoltageV).toBeCloseTo(28);
    expect(remote.outputTerminalVoltageV).toBeCloseTo(28.4);
    expect(remote.compensationLimited).toBe(false);
  });

  it('reports the one-volt-per-lead remote-sense limit', () => {
    const result = evaluateRemoteSense({
      setVoltageV: 49,
      loadCurrentA: 10,
      forceLeadResistanceOhmPerLead: 0.2,
      remoteSenseEnabled: true,
    });
    expect(result.compensationLimited).toBe(true);
    expect(result.outputTerminalVoltageV).toBe(50);
    expect(result.dutVoltageV).toBe(46);
  });

  it('derives inrush from capacitance and programmed slew', () => {
    const result = evaluateSlewTransient({
      voltageStepV: 28,
      programmedSlewVPerSecond: 1_000,
      loadCapacitanceMicrofarad: 1_000,
      steadyLoadCurrentA: 0.5,
      currentLimitA: 1,
    });
    expect(result.capacitiveCurrentA).toBeCloseTo(1);
    expect(result.predictedPeakCurrentA).toBeCloseTo(1.5);
    expect(result.currentLimited).toBe(true);
    expect(result.effectiveSlewVPerSecond).toBeCloseTo(500);
  });

  it('uses the module-specific 10.24 microsecond minimum and point memory', () => {
    const result = evaluateDigitizedCapture({
      points: 4_096,
      sampleIntervalSeconds: 10.24e-6,
      parameterCount: 1,
    });
    expect(result.sampleRateHz).toBeCloseTo(N6752A_DIGITIZER_MAX_SAMPLE_RATE_HZ);
    expect(result.durationSeconds).toBeCloseTo(0.04194304);
    expect(() => evaluateDigitizedCapture({
      points: N6752A_DIGITIZER_MAX_POINTS / 2 + 1,
      sampleIntervalSeconds: 10.24e-6,
      parameterCount: 2,
    })).toThrow(RangeError);
  });
});

describe('PA DC metrics and deterministic SCPI model', () => {
  it('combines DC and DUT-plane RF watts for PAE', () => {
    const result = calculatePaDcMetrics({ voltageV: 28, currentA: 1.5, pinDbm: -10, poutDbm: 28 });
    expect(result.dcInputPowerW).toBe(42);
    expect(result.rfInputPowerW).toBeCloseTo(0.0001);
    expect(result.rfOutputPowerW).toBeCloseTo(0.6309573);
    expect(result.paePercent).toBeCloseTo(1.502, 3);
  });

  it('puts output ON only behind an explicit program option and cleans up OFF first', () => {
    const defaultProgram = createN6705cSafeBiasProgram({ voltageV: 28, currentLimitA: 0.25, ovpV: 30 });
    expect(defaultProgram.some((step) => step.message.startsWith('OUTP ON'))).toBe(false);
    const enabled = createN6705cSafeBiasProgram({ voltageV: 28, currentLimitA: 0.25, ovpV: 30, includeOutputOn: true });
    expect(enabled.some((step) => step.message === 'OUTP ON,(@1)')).toBe(true);
    const cleanup = enabled.filter((step) => step.phase === 'cleanup');
    expect(cleanup.map((step) => step.message)).toEqual([
      'OUTP OFF,(@1)',
      'ABOR:TRAN (@1)',
      'ABOR:ACQ (@1)',
    ]);
  });

  it('rejects a program whose current limit exceeds the 100 W autoranging envelope', () => {
    expect(() => createN6705cSafeBiasProgram({
      voltageV: 50,
      currentLimitA: 2.5,
      ovpV: 52,
      includeOutputOn: true,
    })).toThrow(/100 W envelope/);
    expect(() => createN6705cSafeBiasProgram({
      voltageV: 50,
      currentLimitA: 2,
      ovpV: 52,
      includeOutputOn: true,
    })).not.toThrow();
  });

  it('keeps state, error FIFO, *CLS and OPC deterministic', () => {
    let state = createN6705cMockState();
    state = executeN6705cMockCommand(state, 'VOLT 28,(@1)').state;
    state = executeN6705cMockCommand(state, 'CURR 1,(@1)').state;
    expect(state.voltageSetpointV).toBe(28);
    expect(state.outputEnabled).toBe(false);
    state = executeN6705cMockCommand(state, 'BAD:COMMAND').state;
    state = executeN6705cMockCommand(state, 'LIST:VOLT 60').state;
    const first = executeN6705cMockCommand(state, 'SYST:ERR?');
    expect(first.response).toContain('-113');
    const second = executeN6705cMockCommand(first.state, 'SYST:ERR?');
    expect(second.response).toContain('-222');
    expect(executeN6705cMockCommand(second.state, '*OPC?').response).toBe('1');
    expect(executeN6705cMockCommand(state, '*CLS').state.errors).toEqual([]);
  });

  it('rejects raw OUTP ON until the safe program and one-shot permit are complete', () => {
    const raw = executeN6705cMockCommand(
      createN6705cMockState(),
      'OUTP ON,(@1)',
      { outputEnablePermit: true },
    );
    expect(raw.state.outputEnabled).toBe(false);
    expect(raw.state.errors.at(-1)).toContain('identity, slot-1 N6752A and Option 761 not verified');

    const program = createN6705cSafeBiasProgram({
      voltageV: 28,
      currentLimitA: 0.25,
      ovpV: 30,
      includeOutputOn: true,
    });
    let state = createN6705cMockState();
    for (const step of program) {
      if (step.phase === 'cleanup') break;
      if (step.message === 'OUTP ON,(@1)') {
        const withoutPermit = executeN6705cMockCommand(state, step.message);
        expect(withoutPermit.state.outputEnabled).toBe(false);
        expect(withoutPermit.state.errors.at(-1)).toContain('explicit application permit missing');
        state = executeN6705cMockCommand(state, step.message, {
          outputEnablePermit: true,
        }).state;
      } else {
        state = executeN6705cMockCommand(state, step.message).state;
      }
    }
    expect(state.outputEnabled).toBe(true);
  });

  it('rechecks query-back, the 100 W envelope and error queue before OUTP ON', () => {
    const program = createN6705cSafeBiasProgram({
      voltageV: 50,
      currentLimitA: 2,
      ovpV: 52,
    });
    let state = createN6705cMockState();
    for (const step of program) {
      if (step.phase === 'cleanup') break;
      state = executeN6705cMockCommand(state, step.message).state;
    }
    state = executeN6705cMockCommand(state, 'CURR 2.5,(@1)').state;
    state = executeN6705cMockCommand(state, 'CURR? (@1)').state;
    state = executeN6705cMockCommand(state, 'SYST:ERR?').state;
    const blocked = executeN6705cMockCommand(state, 'OUTP ON,(@1)', {
      outputEnablePermit: true,
    });
    expect(blocked.state.outputEnabled).toBe(false);
    expect(blocked.state.errors.at(-1)).toContain('100 W envelope');
  });

  it('arms LIST, waits for trigger and applies the first list point', () => {
    let state = createN6705cMockState();
    state = executeN6705cMockCommand(state, 'LIST:VOLT 5,12,28').state;
    state = executeN6705cMockCommand(state, 'LIST:DWEL 0.05,0.1,0.5').state;
    state = executeN6705cMockCommand(state, 'TRIG:TRAN:SOUR BUS').state;
    expect(state.errors).toEqual([]);
    expect(state.transientArmed).toBe(false);
    state = executeN6705cMockCommand(state, 'INIT:TRAN').state;
    expect(state.transientArmed).toBe(true);
    state = executeN6705cMockCommand(state, '*TRG').state;
    expect(state.transientArmed).toBe(false);
    expect(state.voltageSetpointV).toBe(5);
  });
});
