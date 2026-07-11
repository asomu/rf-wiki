import type { SParameterNetwork } from '../../types';
import { fromPolarDegrees } from './complex';
import { createSParameterNetwork } from './sparameters';

export type NetworkScenarioId = 'stable-amplifier' | 'conditional-pa' | 'passive-filter';

export interface NetworkScenario {
  readonly id: NetworkScenarioId;
  readonly label: string;
  readonly deviceKind: 'active' | 'passive';
  readonly description: string;
  readonly network: SParameterNetwork;
}

/**
 * Deterministic educational two-port fixtures. They are dimensionless
 * power-wave S-parameters at a single frequency and are not vendor models.
 */
export const RF_NETWORK_SCENARIOS: Readonly<Record<NetworkScenarioId, NetworkScenario>> = {
  'stable-amplifier': {
    id: 'stable-amplifier',
    label: 'Stable amplifier · 2.1 GHz',
    deviceKind: 'active',
    description: 'Moderate reverse feedback and K, μ, μ′ above one.',
    network: createSParameterNetwork(
      fromPolarDegrees(0.35, -60),
      fromPolarDegrees(0.03, 25),
      fromPolarDegrees(3.4, 70),
      fromPolarDegrees(0.30, -35),
    ),
  },
  'conditional-pa': {
    id: 'conditional-pa',
    label: 'Conditionally stable PA · 3.5 GHz',
    deviceKind: 'active',
    description: 'High gain and feedback create source/load regions where |Γout| or |Γin| exceeds one.',
    network: createSParameterNetwork(
      fromPolarDegrees(0.72, -120),
      fromPolarDegrees(0.08, 45),
      fromPolarDegrees(4.2, 70),
      fromPolarDegrees(0.65, -40),
    ),
  },
  'passive-filter': {
    id: 'passive-filter',
    label: 'Passive reciprocal filter · 1.8 GHz',
    deviceKind: 'passive',
    description: 'Reciprocal S12=S21 fixture where forward transmission is reported as insertion loss.',
    network: createSParameterNetwork(
      fromPolarDegrees(0.16, -20),
      fromPolarDegrees(0.83, -12),
      fromPolarDegrees(0.83, -12),
      fromPolarDegrees(0.18, 25),
    ),
  },
};

export function getNetworkScenario(id: NetworkScenarioId): NetworkScenario {
  return RF_NETWORK_SCENARIOS[id];
}
