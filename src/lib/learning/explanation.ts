export interface CausalExplanationAssessment {
  readonly ready: boolean;
  readonly characterCount: number;
  readonly hasCausalLink: boolean;
  readonly hasStage: boolean;
  readonly hasObservedResult: boolean;
  readonly hasTradeoff: boolean;
  readonly missing: readonly string[];
}

const CAUSAL_LINK = /(→|때문|따라서|그래서|영향|결과|원인|caus|therefore|because|so that)/i;
const STAGE = /(source|소스|generator|dut|장비|회로|pa\b|acquisition|획득|mixer|adc|if\b|dsp|fft|ifft|filter|필터|math|계산|display|표시)/i;
const OBSERVED_RESULT = /(화면|trace|트레이스|spectrum|스펙트럼|noise|노이즈|floor|evm|aclr|vswr|smith|gain|이득|전력|power|위상|phase|폭|bandwidth|rb\b|iq|marker|값)/i;
const TRADEOFF = /(비용|한계|대신|하지만|느려|시간|speed|latency|resolution|해상도|uncertainty|불확도|오차|trade.?off|제약|필요)/i;

/**
 * Lightweight structure check, not an RF truth grader. It ensures a learner
 * names a cause, affected signal stage, visible result, and cost/limit before
 * local completion is recorded.
 */
export function assessCausalExplanation(text: string): CausalExplanationAssessment {
  const normalized = text.trim();
  const characterCount = normalized.replace(/\s/g, '').length;
  const hasCausalLink = CAUSAL_LINK.test(normalized);
  const hasStage = STAGE.test(normalized);
  const hasObservedResult = OBSERVED_RESULT.test(normalized);
  const hasTradeoff = TRADEOFF.test(normalized);
  const missing: string[] = [];

  if (characterCount < 24) missing.push(`설명 ${Math.max(0, 24 - characterCount)}자`);
  if (!hasCausalLink) missing.push('원인 연결어');
  if (!hasStage) missing.push('영향받은 stage');
  if (!hasObservedResult) missing.push('화면에서 본 결과');
  if (!hasTradeoff) missing.push('비용 또는 한계');

  return {
    ready: missing.length === 0,
    characterCount,
    hasCausalLink,
    hasStage,
    hasObservedResult,
    hasTradeoff,
    missing,
  };
}
