import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CrossRatAtlas from '../../src/components/cellular/CrossRatAtlas';
import GsmTimeExplorer from '../../src/components/cellular/GsmTimeExplorer';
import CellularResourceExplorer from '../../src/components/cellular/CellularResourceExplorer';

describe('cellular linked views', () => {
  it('switches the cross-RAT atlas without losing direct labels', () => {
    render(<CrossRatAtlas />);
    expect(screen.getByText('Point A / CRB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'GSM' }));
    expect(screen.getByText('TDMA frame 4.615 ms')).toBeInTheDocument();
    expect(screen.getAllByText('Power-vs-time + gated ORFS')).toHaveLength(2);
  });

  it('uses exact GSM timing and updates nominal multislot occupancy', () => {
    render(<GsmTimeExplorer preset="multislot" />);
    expect(screen.getByText('4.615 ms')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /8개 timeslot/ })).toBeInTheDocument();
  });

  it('maps NR RB100 location zero into the actual 4096-point IFFT model', () => {
    render(<CellularResourceExplorer initialRat="NR" preset="rb100-location0" />);
    expect(screen.getByText('36.00 MHz')).toBeInTheDocument();
    expect(screen.getByText('1200 / 4096 bins')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /allocation 100 RB at location 0/ })).toBeInTheDocument();
  });
});
