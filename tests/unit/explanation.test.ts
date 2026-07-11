import { describe, expect, it } from 'vitest';
import { assessCausalExplanation } from '../../src/lib/learning/explanation';

describe('causal explanation completion contract', () => {
  it('requires cause, stage, observed result, and tradeoff', () => {
    const result = assessCausalExplanation('RBW를 줄였기 때문에 DSP filter noise bandwidth가 감소해 화면 noise floor가 내려갔지만 sweep 시간 비용이 늘었다.');
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('does not accept length alone as an explanation', () => {
    const result = assessCausalExplanation('이것은 아주 길게 적은 문장이지만 아직 무엇이 변했는지는 전혀 말하지 않은 문장이다.');
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('영향받은 stage');
    expect(result.missing).toContain('화면에서 본 결과');
    expect(result.missing).toContain('비용 또는 한계');
  });
});
