import type { GsmBurstDefinition, TimeHierarchy } from '../../types';

export const GSM_SYMBOL_RATE_HZ = 1_625_000 / 6;
export const GSM_SYMBOL_PERIOD_SECONDS = 1 / GSM_SYMBOL_RATE_HZ;
export const GSM_TIMESLOT_SYMBOL_PERIODS = 156.25;
export const GSM_TIMESLOT_SECONDS = GSM_TIMESLOT_SYMBOL_PERIODS / GSM_SYMBOL_RATE_HZ;
export const GSM_TDMA_FRAME_SECONDS = 8 * GSM_TIMESLOT_SECONDS;

export const GSM_NORMAL_BURST: GsmBurstDefinition = Object.freeze({
  id: 'normal',
  label: 'Normal burst',
  occupiedSymbolPeriods: 148,
  guardSymbolPeriods: 8.25,
  fields: [
    { id: 'tail-a', label: 'Tail', symbolPeriods: 3, role: 'equalizer와 transmitter 상태를 burst 경계에서 안정화' },
    { id: 'data-a', label: 'Data', symbolPeriods: 57, role: 'coded payload의 앞 절반' },
    { id: 'steal-a', label: 'Stealing', symbolPeriods: 1, role: 'traffic block이 control block으로 대체됐는지 표시' },
    { id: 'training', label: 'Training sequence', symbolPeriods: 26, role: '채널 추정과 equalization 기준' },
    { id: 'steal-b', label: 'Stealing', symbolPeriods: 1, role: 'payload 뒤 절반의 stealing indication' },
    { id: 'data-b', label: 'Data', symbolPeriods: 57, role: 'coded payload의 뒤 절반' },
    { id: 'tail-b', label: 'Tail', symbolPeriods: 3, role: 'burst 종료 경계' },
    { id: 'guard', label: 'Guard', symbolPeriods: 8.25, role: '다음 timeslot transmitter와의 시간 오차 흡수' },
  ],
});

export const GSM_TIME_HIERARCHY: TimeHierarchy = Object.freeze({
  generation: 'GSM',
  levels: [
    { id: 'symbol', label: 'symbol period', durationSeconds: GSM_SYMBOL_PERIOD_SECONDS },
    { id: 'timeslot', label: 'timeslot', count: 156.25, durationSeconds: GSM_TIMESLOT_SECONDS },
    { id: 'frame', label: 'TDMA frame', count: 8, durationSeconds: GSM_TDMA_FRAME_SECONDS },
    { id: '26-multiframe', label: '26-frame multiframe', count: 26, durationSeconds: 26 * GSM_TDMA_FRAME_SECONDS },
    { id: '51-multiframe', label: '51-frame multiframe', count: 51, durationSeconds: 51 * GSM_TDMA_FRAME_SECONDS },
  ],
});

export function gsmTimeslotStartSeconds(timeslot: number): number {
  if (!Number.isSafeInteger(timeslot) || timeslot < 0 || timeslot > 7) {
    throw new RangeError(`GSM timeslot must be an integer in 0…7; received ${timeslot}`);
  }
  return timeslot * GSM_TIMESLOT_SECONDS;
}

export function gsmMultislotDutyCycle(activeTimeslots: number): number {
  if (!Number.isSafeInteger(activeTimeslots) || activeTimeslots < 1 || activeTimeslots > 8) {
    throw new RangeError(`Active GSM timeslots must be an integer in 1…8; received ${activeTimeslots}`);
  }
  return activeTimeslots / 8;
}

export function gsmBurstDurationSeconds(definition: GsmBurstDefinition): number {
  const total = definition.fields.reduce((sum, field) => sum + field.symbolPeriods, 0);
  return total / GSM_SYMBOL_RATE_HZ;
}
