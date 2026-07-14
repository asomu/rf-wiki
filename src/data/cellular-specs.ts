import type { SpecClauseReference } from '../types';

export const cellularSpecRegistry = {
  'gsm-45-002-4-3': {
    specification: '3GPP TS 45.002', version: '17.0.0', clause: '4.3', title: 'Timeslots, TDMA frames, and time groups',
    url: 'https://www.etsi.org/deliver/etsi_ts/145000_145099/145002/17.00.00_60/ts_145002v170000p.pdf', applicability: 'GSM/EDGE physical time resource', kind: 'normative',
  },
  'gsm-45-002-5-2': {
    specification: '3GPP TS 45.002', version: '17.0.0', clause: '5.2', title: 'Burst types and timing',
    url: 'https://www.etsi.org/deliver/etsi_ts/145000_145099/145002/17.00.00_60/ts_145002v170000p.pdf', applicability: 'GSM/EDGE normal, access, FCCH, synchronization and dummy bursts', kind: 'normative',
  },
  'gsm-45-002-6': {
    specification: '3GPP TS 45.002', version: '17.0.0', clause: '6 and 7', title: 'Logical-to-physical channel mapping',
    url: 'https://www.etsi.org/deliver/etsi_ts/145000_145099/145002/17.00.00_60/ts_145002v170000p.pdf', applicability: 'GSM/GPRS/EDGE multiframe and channel mapping', kind: 'normative',
  },
  'gsm-45-004-2': {
    specification: '3GPP TS 45.004', version: '17.0.0', clause: '2 and 3', title: 'GMSK and 8PSK modulation',
    url: 'https://www.etsi.org/deliver/etsi_ts/145000_145099/145004/17.00.00_60/ts_145004v170000p.pdf', applicability: 'GSM/EDGE modulation and pulse shaping', kind: 'normative',
  },
  'gsm-45-005-4': {
    specification: '3GPP TS 45.005', version: '17.0.0', clause: '4', title: 'Transmitter characteristics',
    url: 'https://www.etsi.org/deliver/etsi_ts/145000_145099/145005/17.00.00_60/ts_145005v170000p.pdf', applicability: 'GSM/EDGE UE RF transmitter requirements', kind: 'normative',
  },
  'lte-36-211-4': {
    specification: '3GPP TS 36.211', version: '17.4.0', clause: '4', title: 'Frame structure and physical resources',
    url: 'https://www.etsi.org/deliver/etsi_TS/136200_136299/136211/17.04.00_60/ts_136211v170400p.pdf', applicability: 'LTE uplink/downlink time-frequency grid', kind: 'normative',
  },
  'lte-36-211-5': {
    specification: '3GPP TS 36.211', version: '17.4.0', clause: '5', title: 'Uplink physical channels, SC-FDMA baseband and reference signals',
    url: 'https://www.etsi.org/deliver/etsi_TS/136200_136299/136211/17.04.00_60/ts_136211v170400p.pdf', applicability: 'LTE UE uplink PUSCH, PUCCH, PRACH, SRS and DM-RS', kind: 'normative',
  },
  'lte-36-211-6': {
    specification: '3GPP TS 36.211', version: '17.4.0', clause: '6', title: 'Downlink OFDM and physical channels',
    url: 'https://www.etsi.org/deliver/etsi_TS/136200_136299/136211/17.04.00_60/ts_136211v170400p.pdf', applicability: 'LTE downlink OFDMA context needed to read UL grants', kind: 'normative',
  },
  'lte-36-101-6-2': {
    specification: '3GPP TS 36.101', version: '17.6.0', clause: '6.2', title: 'UE transmitter output power and MPR',
    url: 'https://www.etsi.org/deliver/etsi_ts/136100_136199/136101/17.06.00_60/ts_136101v170600p.pdf', applicability: 'LTE UE uplink transmitter minimum requirements', kind: 'normative',
  },
  'lte-36-101-6-6': {
    specification: '3GPP TS 36.101', version: '17.6.0', clause: '6.6', title: 'UE output RF spectrum emissions',
    url: 'https://www.etsi.org/deliver/etsi_ts/136100_136199/136101/17.06.00_60/ts_136101v170600p.pdf', applicability: 'LTE UE ACLR, SEM and spurious emissions', kind: 'normative',
  },
  'lte-36-521-1-6': {
    specification: '3GPP TS 36.521-1', version: '17.7.0', clause: '6', title: 'LTE UE transmitter conformance tests',
    url: 'https://www.etsi.org/deliver/etsi_ts/136500_136599/13652101/17.07.00_60/ts_13652101v170700p.pdf', applicability: 'LTE UE conformance conditions; not a PAMiD component target', kind: 'conformance',
  },
  'nr-38-211-4': {
    specification: '3GPP TS 38.211', version: '17.7.0', clause: '4', title: 'Numerologies, frame structure and resource grids',
    url: 'https://www.etsi.org/deliver/etsi_ts/138200_138299/138211/17.07.00_60/ts_138211v170700p.pdf', applicability: 'NR frame, SCS, Point A/CRB/BWP/PRB resource model', kind: 'normative',
  },
  'nr-38-211-5': {
    specification: '3GPP TS 38.211', version: '17.7.0', clause: '5', title: 'Generic modulation and waveform functions',
    url: 'https://www.etsi.org/deliver/etsi_ts/138200_138299/138211/17.07.00_60/ts_138211v170700p.pdf', applicability: 'NR modulation, OFDM and transform precoding functions', kind: 'normative',
  },
  'nr-38-211-6': {
    specification: '3GPP TS 38.211', version: '17.7.0', clause: '6', title: 'Uplink physical channels and signals',
    url: 'https://www.etsi.org/deliver/etsi_ts/138200_138299/138211/17.07.00_60/ts_138211v170700p.pdf', applicability: 'NR UE PUSCH, PUCCH, PRACH, SRS, DM-RS and PT-RS', kind: 'normative',
  },
  'nr-38-213-11': {
    specification: '3GPP TS 38.213', version: '17.7.0', clause: '11.1', title: 'Slot configuration',
    url: 'https://www.etsi.org/deliver/etsi_ts/138200_138299/138213/17.07.00_60/ts_138213v170700p.pdf', applicability: 'NR TDD downlink/uplink/flexible symbol operation', kind: 'normative',
  },
  'nr-38-101-1-6-2': {
    specification: '3GPP TS 38.101-1', version: '17.10.0', clause: '6.2', title: 'FR1 UE transmitter output power and MPR',
    url: 'https://www.etsi.org/deliver/etsi_ts/138100_138199/13810101/17.10.00_60/ts_13810101v171000p.pdf', applicability: 'NR FR1 UE transmitter minimum requirements', kind: 'normative',
  },
  'nr-38-101-1-6-5': {
    specification: '3GPP TS 38.101-1', version: '17.10.0', clause: '6.5', title: 'FR1 UE output RF spectrum emissions',
    url: 'https://www.etsi.org/deliver/etsi_ts/138100_138199/13810101/17.10.00_60/ts_13810101v171000p.pdf', applicability: 'NR FR1 UE ACLR, SEM and spurious emissions', kind: 'normative',
  },
  'nr-38-521-1-6': {
    specification: '3GPP TS 38.521-1', version: '17.8.0', clause: '6', title: 'NR FR1 UE transmitter conformance tests',
    url: 'https://www.etsi.org/deliver/etsi_ts/138500_138599/13852101/17.08.00_60/ts_13852101v170800p.pdf', applicability: 'NR FR1 UE conformance conditions; not a PAMiD component target', kind: 'conformance',
  },
  'mipi-rffe-overview': {
    specification: 'MIPI Alliance RFFE', version: '3.2 public overview', clause: 'Overview', title: 'RF Front-End Control Interface',
    url: 'https://www.mipi.org/specifications/rf-front-end', applicability: 'Public roles, trigger and control concepts only; member-only register details excluded', kind: 'public-overview',
  },
  'keysight-et-dpd': {
    specification: 'Keysight application note', version: '2024', clause: 'System overview', title: 'Power Amplifier Envelope Tracking and Digital Predistortion Test Solution',
    url: 'https://www.keysight.com/zz/en/assets/3126-1400/application-notes/Power-Amplifier-Envelope-Tracking-and-Digital-Predistortion-Test-Solution.pdf', applicability: 'PA ET/DPD bench interpretation; not a 3GPP normative limit', kind: 'industry-reference',
  },
  'keysight-pa-kpi': {
    specification: 'Keysight application note', version: '2024', clause: 'Measurement concepts', title: 'Characterizing Key Performance Indicators of Power Amplifiers',
    url: 'https://www.keysight.com/zz/en/assets/3122-1770/application-notes/Characterizing-the-Key-Performance-Indicators-of-Power-Amplifiers.pdf', applicability: 'Pout, gain, PAE, EVM, ACLR and compression measurement practice', kind: 'industry-reference',
  },
} as const satisfies Readonly<Record<string, SpecClauseReference>>;

export type CellularSpecReferenceId = keyof typeof cellularSpecRegistry;

export function resolveCellularSpecReferences(ids: readonly string[]): readonly SpecClauseReference[] {
  return ids.map((id) => {
    const reference = cellularSpecRegistry[id as CellularSpecReferenceId];
    if (!reference) throw new RangeError(`Unknown cellular specification reference: ${id}`);
    return reference;
  });
}
