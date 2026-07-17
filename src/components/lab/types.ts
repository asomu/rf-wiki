import type { ReactNode } from 'react';

export type SignalStageId = 'source' | 'dut' | 'acquisition' | 'dsp' | 'display';

export type SignalStageMap = Readonly<Record<string, readonly SignalStageId[]>>;

export interface SignalStage {
  id: SignalStageId;
  label: string;
  detail: string;
}

export interface LedgerEntry {
  label: '변경' | '직접 효과' | '화면 결과' | '비용·한계';
  value: string;
  tone?: 'neutral' | 'active' | 'warning';
}

export interface PredictionSpec {
  id: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
}

export interface LabShellProps {
  labId: string;
  title: string;
  question: string;
  description: string;
  activeStages: readonly SignalStageId[];
  stageMap?: SignalStageMap;
  controls: ReactNode;
  children: ReactNode;
  ledger: readonly LedgerEntry[];
  prediction?: PredictionSpec;
  note?: string;
  layoutVariant?: 'default' | 'prediction-first';
  controlsTitle?: string;
  controlsHint?: string;
}

export const defaultSignalStages: readonly SignalStage[] = [
  { id: 'source', label: 'Source', detail: '파형·전력·할당' },
  { id: 'dut', label: 'DUT', detail: '전달·반사·비선형' },
  { id: 'acquisition', label: 'Acquisition', detail: 'mixer·IF·ADC' },
  { id: 'dsp', label: 'DSP / Math', detail: 'RBW·FFT·복소수' },
  { id: 'display', label: 'Display', detail: 'trace·marker·grid' }
] as const;
