import type {
  MxgCommandId,
  MxgSession,
  MxgState,
  ParsedScpiCommand,
  ScpiError,
  ScpiParseResult,
  ScpiQueryResult,
  ScpiReadResult,
  ScpiTranscriptEntry,
} from '@/types/instruments';
import { dbm, hertz } from '@/types/units';
import { n5182bCommandById } from './catalog';
import {
  createN5182bResetState,
  evaluatePaSafety,
  getN5182bArbSampleRateMaxHz,
  getN5182bFrequencyMaxHz,
  N5182B_ERROR_QUEUE_CAPACITY,
  N5182B_FREQUENCY_MIN_HZ,
  N5182B_POWER_MAX_DBM,
  N5182B_POWER_MIN_DBM,
} from './mxg';

const commandAliases: Readonly<Record<string, MxgCommandId>> = Object.freeze({
  '*IDN': 'identify',
  '*OPT': 'options',
  '*CLS': 'clear-status',
  '*OPC': 'operation-complete',
  '*RST': 'reset',
  'SYST:ERR': 'system-error-next',
  'SYST:ERR:NEXT': 'system-error-next',
  'SYSTEM:ERROR': 'system-error-next',
  'SYSTEM:ERROR:NEXT': 'system-error-next',
  FREQ: 'frequency-cw',
  'FREQ:CW': 'frequency-cw',
  FREQUENCY: 'frequency-cw',
  'FREQUENCY:CW': 'frequency-cw',
  'SOUR:FREQ': 'frequency-cw',
  'SOUR:FREQ:CW': 'frequency-cw',
  'SOURCE:FREQUENCY': 'frequency-cw',
  'SOURCE:FREQUENCY:CW': 'frequency-cw',
  POW: 'power-amplitude',
  POWER: 'power-amplitude',
  'SOUR:POW': 'power-amplitude',
  'SOUR:POW:LEV:IMM:AMPL': 'power-amplitude',
  'SOURCE:POWER': 'power-amplitude',
  'SOURCE:POWER:LEVEL:IMMEDIATE:AMPLITUDE': 'power-amplitude',
  OUTP: 'rf-output',
  'OUTP:STAT': 'rf-output',
  OUTPUT: 'rf-output',
  'OUTPUT:STATE': 'rf-output',
  'OUTP:MOD': 'modulation-output',
  'OUTP:MOD:STAT': 'modulation-output',
  'OUTPUT:MODULATION': 'modulation-output',
  'OUTPUT:MODULATION:STATE': 'modulation-output',
  'RAD:ARB:WAV': 'arb-waveform',
  'RAD:ARB:WAVEFORM': 'arb-waveform',
  'RADIO:ARB:WAVEFORM': 'arb-waveform',
  'SOUR:RAD:ARB:WAV': 'arb-waveform',
  'SOURCE:RADIO:ARB:WAVEFORM': 'arb-waveform',
  'RAD:ARB:SCL:RATE': 'arb-sample-clock',
  'RADIO:ARB:SCLOCK:RATE': 'arb-sample-clock',
  'SOUR:RAD:ARB:SCL:RATE': 'arb-sample-clock',
  'SOURCE:RADIO:ARB:SCLOCK:RATE': 'arb-sample-clock',
  'RAD:ARB:RSC': 'arb-runtime-scaling',
  'RADIO:ARB:RSCALING': 'arb-runtime-scaling',
  'SOUR:RAD:ARB:RSC': 'arb-runtime-scaling',
  'SOURCE:RADIO:ARB:RSCALING': 'arb-runtime-scaling',
  'RAD:ARB:TRIG': 'arb-trigger-source',
  'RAD:ARB:TRIG:SOUR': 'arb-trigger-source',
  'RADIO:ARB:TRIGGER': 'arb-trigger-source',
  'RADIO:ARB:TRIGGER:SOURCE': 'arb-trigger-source',
  'SOUR:RAD:ARB:TRIG': 'arb-trigger-source',
  'SOUR:RAD:ARB:TRIG:SOUR': 'arb-trigger-source',
  'SOURCE:RADIO:ARB:TRIGGER': 'arb-trigger-source',
  'SOURCE:RADIO:ARB:TRIGGER:SOURCE': 'arb-trigger-source',
  'RAD:ARB': 'arb-state',
  'RAD:ARB:STAT': 'arb-state',
  'RADIO:ARB': 'arb-state',
  'RADIO:ARB:STATE': 'arb-state',
  'SOUR:RAD:ARB': 'arb-state',
  'SOUR:RAD:ARB:STAT': 'arb-state',
  'SOURCE:RADIO:ARB': 'arb-state',
  'SOURCE:RADIO:ARB:STATE': 'arb-state',
  'MMEM:DATA': 'waveform-data',
  'MMEMORY:DATA': 'waveform-data',
});

const errors = Object.freeze({
  syntax: { code: -102, message: 'Syntax error; send one SCPI command per program message' },
  parameterNotAllowed: { code: -108, message: 'Parameter not allowed' },
  missingParameter: { code: -109, message: 'Missing parameter' },
  undefinedHeader: { code: -113, message: 'Undefined header' },
  dataOutOfRange: { code: -222, message: 'Data out of range' },
  illegalParameter: { code: -224, message: 'Illegal parameter value' },
  settingsConflict: { code: -221, message: 'Settings conflict' },
  fileNotFound: { code: -256, message: 'File name not found' },
  queryInterrupted: { code: -410, message: 'Query INTERRUPTED' },
  queueOverflow: { code: -350, message: 'Queue overflow' },
} satisfies Readonly<Record<string, ScpiError>>);

function cloneError(error: ScpiError, detail?: string): ScpiError {
  return {
    code: error.code,
    message: detail ? `${error.message}; ${detail}` : error.message,
  };
}

function splitHeaderAndArgument(message: string): { header: string; argument: string | null } {
  const whitespace = message.search(/\s/);
  if (whitespace < 0) return { header: message, argument: null };
  const argument = message.slice(whitespace).trim();
  return {
    header: message.slice(0, whitespace),
    argument: argument === '' ? null : argument,
  };
}

export function parseN5182bScpi(message: string): ScpiParseResult {
  const raw = message.trim();
  if (raw === '' || raw.includes(';') || /[\r\n]/.test(raw)) {
    return { ok: false, error: errors.syntax };
  }

  const { header: rawHeader, argument } = splitHeaderAndArgument(raw);
  const form = rawHeader.endsWith('?') ? 'query' : 'write';
  const headerWithoutQuery = form === 'query' ? rawHeader.slice(0, -1) : rawHeader;
  const normalizedHeader = headerWithoutQuery.replace(/^:/, '').toUpperCase();
  const commandId = commandAliases[normalizedHeader];
  if (!commandId) return { ok: false, error: errors.undefinedHeader };

  const definition = n5182bCommandById[commandId];
  if ((form === 'query' && definition.operation === 'write')
      || (form === 'write' && definition.operation === 'query')) {
    return { ok: false, error: errors.undefinedHeader };
  }
  if (form === 'query' && argument !== null) {
    return { ok: false, error: errors.parameterNotAllowed };
  }
  if (form === 'write' && definition.parameters.length > 0 && argument === null) {
    return { ok: false, error: errors.missingParameter };
  }
  if (definition.parameters.length === 0 && argument !== null) {
    return { ok: false, error: errors.parameterNotAllowed };
  }

  const command: ParsedScpiCommand = { commandId, form, raw, argument };
  return { ok: true, command };
}

function nextTranscriptEntry(
  session: MxgSession,
  direction: 'write' | 'read',
  message: string,
  commandId: MxgCommandId | null,
  outcome: ScpiTranscriptEntry['outcome'],
  error: ScpiError | null = null,
): ScpiTranscriptEntry {
  return {
    index: session.transcript.length + 1,
    direction,
    message,
    commandId,
    outcome,
    error,
  };
}

export function enqueueN5182bError(
  queue: readonly ScpiError[],
  error: ScpiError,
): readonly ScpiError[] {
  if (queue.length < N5182B_ERROR_QUEUE_CAPACITY) return [...queue, error];
  if (queue.at(-1)?.code === errors.queueOverflow.code) return queue;
  return [
    ...queue.slice(0, N5182B_ERROR_QUEUE_CAPACITY - 1),
    errors.queueOverflow,
  ];
}

function withWriteError(session: MxgSession, raw: string, error: ScpiError): MxgSession {
  return {
    ...session,
    errorQueue: enqueueN5182bError(session.errorQueue, error),
    transcript: [
      ...session.transcript,
      nextTranscriptEntry(session, 'write', raw, null, 'error', error),
    ],
  };
}

function withAcceptedWrite(
  session: MxgSession,
  command: ParsedScpiCommand,
  updates: Partial<MxgSession> = {},
): MxgSession {
  return {
    ...session,
    ...updates,
    transcript: [
      ...session.transcript,
      nextTranscriptEntry(session, 'write', command.raw, command.commandId, 'accepted'),
    ],
  };
}

function withCommandError(
  session: MxgSession,
  command: ParsedScpiCommand,
  error: ScpiError,
): MxgSession {
  return {
    ...session,
    errorQueue: enqueueN5182bError(session.errorQueue, error),
    transcript: [
      ...session.transcript,
      nextTranscriptEntry(session, 'write', command.raw, command.commandId, 'error', error),
    ],
  };
}

function queueResponse(session: MxgSession, command: ParsedScpiCommand, response: string): MxgSession {
  return withAcceptedWrite(session, command, {
    outputQueue: [...session.outputQueue, response],
  });
}

function supportsRequiredOption(session: MxgSession, commandId: MxgCommandId): boolean {
  const required = n5182bCommandById[commandId].requiredAnyOfOptions;
  return required.length === 0 || required.some((option) => session.installedOptions.includes(option));
}

function parseBoolean(argument: string | null): boolean | null {
  if (argument === null) return null;
  const normalized = argument.toUpperCase();
  if (normalized === 'ON' || normalized === '1') return true;
  if (normalized === 'OFF' || normalized === '0') return false;
  return null;
}

function parseNumberWithUnit(
  argument: string | null,
  multipliers: Readonly<Record<string, number>>,
): number | null {
  if (argument === null) return null;
  const match = argument.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?)\s*([A-Z]+)?$/i);
  if (!match?.[1]) return null;
  const unit = (match[2] ?? '').toUpperCase();
  const multiplier = multipliers[unit];
  if (multiplier === undefined) return null;
  const value = Number(match[1]) * multiplier;
  return Number.isFinite(value) ? value : null;
}

function parseFrequencyHz(argument: string | null): number | null {
  return parseNumberWithUnit(argument, {
    '': 1,
    HZ: 1,
    KHZ: 1e3,
    MHZ: 1e6,
    GHZ: 1e9,
  });
}

function parsePowerDbm(argument: string | null): number | null {
  return parseNumberWithUnit(argument, { '': 1, DBM: 1 });
}

function parsePercentage(argument: string | null): number | null {
  return parseNumberWithUnit(argument, { '': 1 });
}

function parseQuotedString(argument: string | null): string | null {
  if (argument === null) return null;
  const match = argument.match(/^"([^"]+)"$/);
  return match?.[1] ?? null;
}

function formatError(error: ScpiError | undefined): string {
  return error
    ? `${error.code},"${error.message.replaceAll('"', "'")}"`
    : '+0,"No error"';
}

function interruptOutstandingQuery(session: MxgSession): MxgSession {
  if (session.outputQueue.length === 0) return session;
  return {
    ...session,
    outputQueue: [],
    errorQueue: enqueueN5182bError(session.errorQueue, errors.queryInterrupted),
  };
}

function assertRfOffForStimulusChange(
  session: MxgSession,
  command: ParsedScpiCommand,
): MxgSession | null {
  if (session.instrumentState.rfOutputEnabled
      && session.safetyEnvelope?.requireRfOffForStimulusChange) {
    return withCommandError(
      session,
      command,
      cloneError(
        errors.settingsConflict,
        'turn RF output off before changing frequency, power, modulation, or ARB stimulus state',
      ),
    );
  }
  return null;
}

function setFrequency(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, String(session.instrumentState.frequencyHz));
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const value = parseFrequencyHz(command.argument);
  if (value === null) return withCommandError(session, command, errors.illegalParameter);
  const frequencyMaxHz = getN5182bFrequencyMaxHz(session.installedOptions);
  if (frequencyMaxHz === null) {
    return withCommandError(
      session,
      command,
      cloneError(errors.settingsConflict, 'requires frequency option 501, 503, or 506'),
    );
  }
  if (value < N5182B_FREQUENCY_MIN_HZ || value > frequencyMaxHz) {
    return withCommandError(session, command, errors.dataOutOfRange);
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, frequencyHz: hertz(value) },
  });
}

function setPower(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, String(session.instrumentState.powerDbm));
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const value = parsePowerDbm(command.argument);
  if (value === null) return withCommandError(session, command, errors.illegalParameter);
  if (value < N5182B_POWER_MIN_DBM || value > N5182B_POWER_MAX_DBM) {
    return withCommandError(session, command, errors.dataOutOfRange);
  }

  const candidateState: MxgState = { ...session.instrumentState, powerDbm: dbm(value) };
  if (session.instrumentState.rfOutputEnabled && session.safetyEnvelope) {
    const safety = evaluatePaSafety(candidateState, session.safetyEnvelope);
    if (!safety.allowed) {
      return withCommandError(
        session,
        command,
        cloneError(errors.settingsConflict, 'PA safety envelope blocks this power while RF output is on'),
      );
    }
  }
  return withAcceptedWrite(session, command, { instrumentState: candidateState });
}

function setRfOutput(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, session.instrumentState.rfOutputEnabled ? '1' : '0');
  }
  const enabled = parseBoolean(command.argument);
  if (enabled === null) return withCommandError(session, command, errors.illegalParameter);
  if (enabled && session.safetyEnvelope) {
    const safety = evaluatePaSafety(session.instrumentState, session.safetyEnvelope);
    if (!safety.allowed) {
      return withCommandError(
        session,
        command,
        cloneError(errors.settingsConflict, `PA safety envelope blocks RF output: ${safety.reasons.join(' ')}`),
      );
    }
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, rfOutputEnabled: enabled },
  });
}

function setModulation(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, session.instrumentState.modulationEnabled ? '1' : '0');
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const enabled = parseBoolean(command.argument);
  if (enabled === null) return withCommandError(session, command, errors.illegalParameter);
  const candidateState: MxgState = { ...session.instrumentState, modulationEnabled: enabled };
  if (enabled && session.instrumentState.rfOutputEnabled && session.safetyEnvelope) {
    const safety = evaluatePaSafety(candidateState, session.safetyEnvelope);
    if (!safety.allowed) {
      return withCommandError(
        session,
        command,
        cloneError(errors.settingsConflict, 'PA safety envelope blocks modulation while RF output is on'),
      );
    }
  }
  return withAcceptedWrite(session, command, {
    instrumentState: candidateState,
  });
}

function selectWaveform(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(
      session,
      command,
      session.instrumentState.selectedWaveformPath
        ? `"${session.instrumentState.selectedWaveformPath}"`
        : '""',
    );
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const memoryPath = parseQuotedString(command.argument);
  if (memoryPath === null) return withCommandError(session, command, errors.illegalParameter);
  const record = session.instrumentState.waveformMemory.find(
    (candidate) => candidate.memoryPath.toUpperCase() === memoryPath.toUpperCase(),
  );
  if (!record) return withCommandError(session, command, errors.fileNotFound);
  const pending = {
    id: session.transcript.length + session.pendingOperations.length + 1,
    kind: 'waveform-select' as const,
    description: `Select ${record.memoryPath} for ARB playback.`,
  };
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, selectedWaveformPath: record.memoryPath },
    pendingOperations: [...session.pendingOperations, pending],
  });
}

function setArbSampleClock(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, String(session.instrumentState.arbSampleClockRateHz));
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const value = parseFrequencyHz(command.argument);
  if (value === null) return withCommandError(session, command, errors.illegalParameter);
  const sampleRateMaxHz = getN5182bArbSampleRateMaxHz(session.installedOptions);
  if (sampleRateMaxHz === null) {
    return withCommandError(
      session,
      command,
      cloneError(errors.settingsConflict, 'requires baseband generator option 656'),
    );
  }
  if (value < 100 || value > sampleRateMaxHz) {
    return withCommandError(session, command, errors.dataOutOfRange);
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, arbSampleClockRateHz: hertz(value) },
  });
}

function setArbRuntimeScaling(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(
      session,
      command,
      String(session.instrumentState.arbRuntimeScalingPercent),
    );
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const value = parsePercentage(command.argument);
  if (value === null) return withCommandError(session, command, errors.illegalParameter);
  if (value < 1 || value > 100) {
    return withCommandError(session, command, errors.dataOutOfRange);
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, arbRuntimeScalingPercent: value },
  });
}

function setArbTriggerSource(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, session.instrumentState.arbTriggerSource);
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const normalized = command.argument?.trim().toUpperCase();
  const triggerSource = normalized === 'EXTERNAL' ? 'EXT' : normalized;
  if (triggerSource !== 'KEY' && triggerSource !== 'EXT' && triggerSource !== 'BUS') {
    return withCommandError(session, command, errors.illegalParameter);
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, arbTriggerSource: triggerSource },
  });
}

function setArbState(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (command.form === 'query') {
    return queueResponse(session, command, session.instrumentState.arbEnabled ? '1' : '0');
  }
  const unsafe = assertRfOffForStimulusChange(session, command);
  if (unsafe) return unsafe;
  const enabled = parseBoolean(command.argument);
  if (enabled === null) return withCommandError(session, command, errors.illegalParameter);
  if (enabled && session.instrumentState.selectedWaveformPath === null) {
    return withCommandError(
      session,
      command,
      cloneError(errors.settingsConflict, 'select an ARB waveform before enabling playback'),
    );
  }
  return withAcceptedWrite(session, command, {
    instrumentState: { ...session.instrumentState, arbEnabled: enabled },
  });
}

function executeParsedCommand(session: MxgSession, command: ParsedScpiCommand): MxgSession {
  if (!supportsRequiredOption(session, command.commandId)) {
    return withCommandError(
      session,
      command,
      cloneError(
        errors.settingsConflict,
        `requires one of options ${n5182bCommandById[command.commandId].requiredAnyOfOptions.join(', ')}`,
      ),
    );
  }

  switch (command.commandId) {
    case 'identify':
      return queueResponse(
        session,
        command,
        'Keysight Technologies,N5182B,MY00000000,B.01.96',
      );
    case 'options':
      return queueResponse(session, command, session.installedOptions.join(',') || '0');
    case 'clear-status':
      return withAcceptedWrite(session, command, { errorQueue: [] });
    case 'operation-complete':
      return withAcceptedWrite(session, command, {
        pendingOperations: [],
        outputQueue: [...session.outputQueue, '1'],
      });
    case 'reset': {
      const resetOperation = {
        id: session.transcript.length + session.pendingOperations.length + 1,
        kind: 'reset' as const,
        description: 'Apply the documented N5182B SCPI reset subset.',
      };
      return withAcceptedWrite(session, command, {
        instrumentState: createN5182bResetState(
          session.instrumentState.waveformMemory,
          session.installedOptions,
        ),
        pendingOperations: [...session.pendingOperations, resetOperation],
      });
    }
    case 'system-error-next': {
      const [nextError, ...remaining] = session.errorQueue;
      return withAcceptedWrite(session, command, {
        errorQueue: remaining,
        outputQueue: [...session.outputQueue, formatError(nextError)],
      });
    }
    case 'frequency-cw':
      return setFrequency(session, command);
    case 'power-amplitude':
      return setPower(session, command);
    case 'rf-output':
      return setRfOutput(session, command);
    case 'modulation-output':
      return setModulation(session, command);
    case 'arb-waveform':
      return selectWaveform(session, command);
    case 'arb-sample-clock':
      return setArbSampleClock(session, command);
    case 'arb-runtime-scaling':
      return setArbRuntimeScaling(session, command);
    case 'arb-trigger-source':
      return setArbTriggerSource(session, command);
    case 'arb-state':
      return setArbState(session, command);
    case 'waveform-data':
      return withCommandError(
        session,
        command,
        cloneError(errors.parameterNotAllowed, 'use buildN5182bWaveformTransfer for binary block data'),
      );
  }
}

export function writeN5182bScpi(session: MxgSession, message: string): MxgSession {
  const prepared = interruptOutstandingQuery(session);
  const parsed = parseN5182bScpi(message);
  if (!parsed.ok) return withWriteError(prepared, message.trim(), parsed.error);
  return executeParsedCommand(prepared, parsed.command);
}

export function readN5182bScpi(session: MxgSession): ScpiReadResult {
  const [response, ...remaining] = session.outputQueue;
  if (response === undefined) {
    return {
      status: 'would-time-out',
      response: null,
      session: {
        ...session,
        transcript: [
          ...session.transcript,
          nextTranscriptEntry(session, 'read', 'READ', null, 'would-time-out'),
        ],
      },
    };
  }
  return {
    status: 'response',
    response,
    session: {
      ...session,
      outputQueue: remaining,
      transcript: [
        ...session.transcript,
        nextTranscriptEntry(session, 'read', response, null, 'response'),
      ],
    },
  };
}

export function queryN5182bScpi(session: MxgSession, message: string): ScpiQueryResult {
  return readN5182bScpi(writeN5182bScpi(session, message));
}
