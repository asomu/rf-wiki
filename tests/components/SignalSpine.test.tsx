import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalSpine } from '../../src/components/lab/SignalSpine';

describe('SignalSpine', () => {
  it('pauses and resumes one reusable indicator per active stage', () => {
    const { container, rerender } = render(
      <SignalSpine activeStages={['source', 'dsp', 'display']} activeControlId="rbw" />,
    );

    const spine = container.querySelector('.signal-spine');
    const pause = screen.getByRole('button', { name: '신호 흐름 일시정지' });
    expect(spine).toHaveAttribute('data-flow-state', 'running');
    expect(container.querySelectorAll('.signal-spine__flow-indicator')).toHaveLength(3);

    fireEvent.click(pause);
    expect(spine).toHaveAttribute('data-flow-state', 'paused');
    expect(screen.getByRole('button', { name: '신호 흐름 재생' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '신호 흐름 재생' }));
    rerender(<SignalSpine activeStages={['acquisition', 'dsp', 'display']} activeControlId="detector" />);
    expect(spine).toHaveAttribute('data-flow-state', 'running');
    expect(spine).toHaveAttribute('data-active-control', 'detector');
    expect(container.querySelectorAll('.signal-spine__flow-indicator')).toHaveLength(3);
  });

  it('keeps state cues but removes movement for reduced-motion users', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/lab/lab.css'),
      'utf8',
    );

    expect(css).toMatch(/signal-spine\[data-flow-state='paused'\][\s\S]*animation-play-state:\s*paused/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*signal-spine__flow-indicator[\s\S]*animation:\s*none/);
  });
});
