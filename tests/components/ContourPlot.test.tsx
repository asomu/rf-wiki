import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ContourPlot,
  createContourAccessibilityModel,
} from '../../src/components/plots/ContourPlot';

describe('ContourPlot accessibility encoding', () => {
  it('exposes three value levels for descriptions and table alternatives', () => {
    const higherIsBetter = createContourAccessibilityModel(10, 40, '%');
    const lowerIsBetter = createContourAccessibilityModel(2, 8, '%', true);

    expect(higherIsBetter.levels).toHaveLength(3);
    expect(higherIsBetter.levels.map(({ shape }) => shape)).toEqual(['ring', 'square', 'diamond']);
    expect(higherIsBetter.levels.map(({ value }) => value)).toEqual([16, 25, 34]);
    lowerIsBetter.levels.forEach((level, index) => {
      expect(level.value).toBeCloseTo([6.8, 5, 3.2][index]!, 10);
    });
    expect(higherIsBetter.summary).toContain('dash');
  });

  it('renders color-independent glyphs and directly labeled values', () => {
    const model = createContourAccessibilityModel(10, 40, '%');
    const { container } = render(
      <ContourPlot
        title="PAE contour"
        description="Synthetic PAE surface."
        points={[
          { re: -0.2, im: 0, value: 12 },
          { re: 0, im: 0, value: 25 },
          { re: 0.2, im: 0, value: 38 },
        ]}
        marker={{ re: 0, im: 0 }}
        min={10}
        max={40}
        unit="%"
        accessibilityModel={model}
      />,
    );

    expect(screen.getByRole('img', { name: /PAE contour/ })).toBeInTheDocument();
    expect(container.querySelector('svg desc')).toHaveTextContent(/불리한 영역/);
    expect(container.querySelectorAll('[data-contour-level]')).toHaveLength(3);
    expect(container.querySelector('.contour-sample-glyph--low')).toBeInTheDocument();
    expect(container.querySelector('.contour-sample-glyph--middle')).toBeInTheDocument();
    expect(container.querySelector('.contour-sample-glyph--high')).toBeInTheDocument();
    for (const level of model.levels) {
      expect(screen.getByText(`${level.label} · ${level.valueLabel}`)).toBeInTheDocument();
    }
  });
});
