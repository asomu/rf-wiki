import { useId } from 'react';

interface Props {
  totalRb: number;
  bwpStartRb?: number;
  bwpCountRb?: number;
  startRb: number;
  countRb: number;
  scsKhz: number;
  label: string;
}

export function ResourceGridPlot({ totalRb, bwpStartRb = 0, bwpCountRb = totalRb, startRb, countRb, scsKhz, label }: Props) {
  const id = useId();
  const width = 760;
  const height = 250;
  const left = 48;
  const right = 24;
  const top = 44;
  const carrierWidth = width - left - right;
  const allocationX = left + (startRb / totalRb) * carrierWidth;
  const allocationWidth = (countRb / totalRb) * carrierWidth;
  const bwpX = left + (bwpStartRb / totalRb) * carrierWidth;
  const bwpWidth = (bwpCountRb / totalRb) * carrierWidth;
  const rbWidthKhz = 12 * scsKhz;
  const occupiedMhz = (countRb * rbWidthKhz) / 1000;
  const detailCols = 12;
  const detailRows = 14;
  const detailX = 414;
  const detailY = 142;
  const cellW = 24;
  const cellH = 6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="resource-grid-plot">
      <title id={`${id}-title`}>{`${label} resource allocation`}</title>
      <desc id={`${id}-desc`}>전체 {totalRb} RB 중 {startRb}번부터 {countRb}개 RB가 선택되어 {occupiedMhz.toFixed(2)} MHz를 점유한다.</desc>
      <text x={left} y="22" className="plot-label-strong">Carrier grid · {totalRb} RB</text>
      <rect x={left} y={top} width={carrierWidth} height="62" rx="4" className="resource-carrier" />
      {Array.from({ length: Math.min(totalRb, 60) + 1 }, (_, index) => {
        const x = left + (index / Math.min(totalRb, 60)) * carrierWidth;
        return <line key={index} x1={x} x2={x} y1={top} y2={top + 62} className="resource-tick" />;
      })}
      <line x1={bwpX} x2={bwpX} y1={top - 6} y2={top + 66} className="resource-marker" />
      <line x1={bwpX + bwpWidth} x2={bwpX + bwpWidth} y1={top - 6} y2={top + 66} className="resource-marker" />
      <text x={Math.max(left, bwpX)} y={top - 12} className="plot-label-reference">BWP {bwpStartRb}…{bwpStartRb + bwpCountRb - 1}</text>
      <rect x={allocationX} y={top + 4} width={Math.max(allocationWidth, 2)} height="54" rx="3" className="resource-allocation" />
      <line x1={allocationX} x2={allocationX} y1={top - 10} y2={top + 66} className="resource-marker" />
      <text x={Math.max(left, allocationX)} y={top + 84} className="plot-label-reference">PRB {startRb}…{startRb + countRb - 1}</text>
      <text x={left} y={top + 105}>한 RB = 12 × {scsKhz} kHz = {rbWidthKhz} kHz</text>
      <text x={left} y={top + 124}>Allocation = {countRb} RB = {occupiedMhz.toFixed(2)} MHz</text>

      <text x={detailX} y={detailY - 12} className="plot-label-strong">선택 RB 상세 · 12 subcarriers × 14 symbols</text>
      {Array.from({ length: detailRows }, (_, row) =>
        Array.from({ length: detailCols }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={detailX + col * cellW}
            y={detailY + row * cellH}
            width={cellW - 1}
            height={cellH - 1}
            className={(col === 0 || col === 11) && row % 4 === 0 ? 'resource-re resource-re--reference' : 'resource-re'}
          />
        ))
      )}
      <text x={detailX + detailCols * cellW + 8} y={detailY + 9}>frequency ↑</text>
      <text x={detailX} y={detailY + detailRows * cellH + 16}>time / OFDM symbols →</text>
    </svg>
  );
}
