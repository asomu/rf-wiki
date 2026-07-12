import type { ScpiProgramStep } from '@/types/instruments';
import { N5182B_ERROR_DRAIN_MAX_QUERIES } from './mxg';

export interface SafeCwProgramValues {
  readonly frequencyHz: number;
  readonly powerDbm: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  return value;
}

const errorDrainContract = Object.freeze({
  maximumQueries: N5182B_ERROR_DRAIN_MAX_QUERIES,
  untilResponseCode: 0,
});

/**
 * Canonical educational N5182B CW sequence used by the web transcript and
 * checked against the downloadable Python dry-run. RF enable is explicit and
 * intentionally excluded; callers add it only after external permits pass.
 */
export function createN5182bSafeCwProgram(
  values: SafeCwProgramValues,
): readonly ScpiProgramStep[] {
  const frequencyHz = finite(values.frequencyHz, 'frequencyHz');
  const powerDbm = finite(values.powerDbm, 'powerDbm');
  return Object.freeze([
    {
      id: 'emergency-rf-off',
      phase: 'safe-state',
      operation: 'write',
      commandId: 'rf-output',
      message: 'OUTP OFF',
      purpose: '모델을 신뢰하기 전 공통 command로 connector output을 먼저 닫는다.',
      safety: 'configuration',
    },
    {
      id: 'identify',
      phase: 'connect',
      operation: 'query',
      commandId: 'identify',
      message: '*IDN?',
      purpose: '연결된 장비가 N5182B인지 확인한다.',
      safety: 'read-only',
    },
    {
      id: 'options',
      phase: 'connect',
      operation: 'query',
      commandId: 'options',
      message: '*OPT?',
      purpose: '506·656 등 설치 capability를 확인한다.',
      safety: 'read-only',
    },
    {
      id: 'preexisting-error-drain',
      phase: 'connect',
      operation: 'query',
      commandId: 'system-error-next',
      message: 'SYST:ERR?',
      purpose: '기존 오류를 지우기 전에 FIFO로 읽고 response code +0 종결까지 station log에 남긴다.',
      safety: 'read-only',
      repeatQueryUntil: errorDrainContract,
    },
    {
      id: 'clear-status',
      phase: 'safe-state',
      operation: 'write',
      commandId: 'clear-status',
      message: '*CLS',
      purpose: '기록한 기존 status/error state를 명시적으로 정리한다.',
      safety: 'configuration',
    },
    {
      id: 'rf-off-configure',
      phase: 'safe-state',
      operation: 'write',
      commandId: 'rf-output',
      message: 'OUTP OFF',
      purpose: 'configuration 단계의 시작 상태를 다시 RF Off로 고정한다.',
      safety: 'configuration',
    },
    {
      id: 'modulation-off',
      phase: 'safe-state',
      operation: 'write',
      commandId: 'modulation-output',
      message: 'OUTP:MOD OFF',
      purpose: 'CW 시험에서 baseband modulation gate를 닫는다.',
      safety: 'configuration',
    },
    {
      id: 'arb-off',
      phase: 'safe-state',
      operation: 'write',
      commandId: 'arb-state',
      message: 'SOUR:RAD:ARB:STAT OFF',
      purpose: 'Option 656 ARB playback engine을 끈다.',
      safety: 'configuration',
    },
    {
      id: 'frequency',
      phase: 'configure',
      operation: 'write',
      commandId: 'frequency-cw',
      message: `SOUR:FREQ:CW ${frequencyHz}HZ`,
      purpose: 'CW carrier를 설정한다.',
      safety: 'configuration',
    },
    {
      id: 'power',
      phase: 'configure',
      operation: 'write',
      commandId: 'power-amplitude',
      message: `SOUR:POW:LEV:IMM:AMPL ${powerDbm}DBM`,
      purpose: '낮은 안전 source level을 설정한다.',
      safety: 'configuration',
    },
    {
      id: 'wait-complete',
      phase: 'synchronize',
      operation: 'query',
      commandId: 'operation-complete',
      message: '*OPC?',
      purpose: '앞선 operation이 끝날 때까지 동기화한다.',
      safety: 'read-only',
    },
    {
      id: 'configure-error-drain',
      phase: 'verify',
      operation: 'query',
      commandId: 'system-error-next',
      message: 'SYST:ERR?',
      purpose: 'configure operation의 오류를 FIFO로 읽고 response code +0 종결을 확인한다.',
      safety: 'read-only',
      repeatQueryUntil: errorDrainContract,
    },
    {
      id: 'frequency-query-back',
      phase: 'verify',
      operation: 'query',
      commandId: 'frequency-cw',
      message: 'SOUR:FREQ:CW?',
      purpose: 'coercion 없이 설정됐는지 확인한다.',
      safety: 'read-only',
    },
    {
      id: 'power-query-back',
      phase: 'verify',
      operation: 'query',
      commandId: 'power-amplitude',
      message: 'SOUR:POW:LEV:IMM:AMPL?',
      purpose: 'power state를 query-back한다.',
      safety: 'read-only',
    },
    {
      id: 'rf-off-query-back',
      phase: 'verify',
      operation: 'query',
      commandId: 'rf-output',
      message: 'OUTP?',
      purpose: 'RF가 여전히 Off인지 확인한다.',
      safety: 'read-only',
    },
    {
      id: 'query-back-error-drain',
      phase: 'verify',
      operation: 'query',
      commandId: 'system-error-next',
      message: 'SYST:ERR?',
      purpose: 'query-back 단계의 오류를 FIFO로 읽고 response code +0 종결을 확인한다.',
      safety: 'read-only',
      repeatQueryUntil: errorDrainContract,
    },
  ] satisfies readonly ScpiProgramStep[]);
}

export const n5182bSafeCwPreview = createN5182bSafeCwProgram({
  frequencyHz: 3_500_000_000,
  powerDbm: -30,
});
