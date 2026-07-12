"""Safe-by-default N9020B Swept-SA and PowerSuite workflows."""

from __future__ import annotations

from dataclasses import dataclass
import math

from .driver import (
    CleanupError,
    N9020B,
    PowerSuiteResult,
    SAFE_BASELINE_ATTENUATION_DB,
    SpectrumTrace,
)


CONSERVATIVE_CONNECTOR_CAP_DBM = 20.0
DOCUMENTED_AVERAGE_DAMAGE_LIMIT_DBM = 30.0
CONSERVATIVE_DC_LIMIT_V = 0.2
CONSERVATIVE_MIXER_LEVEL_LIMIT_DBM = -12.0


@dataclass(frozen=True)
class SpectrumRequest:
    center_hz: float = 3.5e9
    span_hz: float = 100e6
    reference_level_dbm: float = 0.0
    rbw_hz: float = 100e3
    vbw_hz: float = 300e3
    points: int = 1001
    detector: str = "NORM"
    trigger_source: str = "IMM"
    attenuation_db: float = SAFE_BASELINE_ATTENUATION_DB


@dataclass(frozen=True)
class PowerSuiteRequest:
    measurement: str = "ACP"
    center_hz: float = 3.5e9
    reference_level_dbm: float = 0.0
    attenuation_db: float = SAFE_BASELINE_ATTENUATION_DB
    use_read: bool = False


@dataclass(frozen=True)
class InputSafetyEstimate:
    connector_average_worst_dbm: float
    connector_peak_worst_dbm: float
    mixer_peak_worst_dbm: float
    reference_headroom_db: float


@dataclass(frozen=True)
class SaInputSafetyEnvelope:
    """Bench-owned limits at the physical RF-input connector.

    ``path_gain_db`` is signed. A 40 dB external coupler/attenuator path is
    therefore ``-40``. The N9020B input attenuator is checked separately and
    must never be counted as connector protection.
    """

    source_max_average_dbm: float
    path_gain_db: float
    waveform_papr_db: float
    connector_average_limit_dbm: float
    connector_peak_limit_dbm: float
    dc_volts: float
    uncertainty_db: float = 1.0
    guard_margin_db: float = 3.0

    def evaluate(
        self,
        *,
        input_attenuation_db: float,
        reference_level_dbm: float,
        preamp_enabled: bool = False,
    ) -> InputSafetyEstimate:
        values = (
            self.source_max_average_dbm,
            self.path_gain_db,
            self.waveform_papr_db,
            self.connector_average_limit_dbm,
            self.connector_peak_limit_dbm,
            self.dc_volts,
            self.uncertainty_db,
            self.guard_margin_db,
            input_attenuation_db,
            reference_level_dbm,
        )
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Every analyzer input-safety value must be finite")
        if self.waveform_papr_db < 0 or self.uncertainty_db < 0 or self.guard_margin_db < 0:
            raise ValueError("PAPR, uncertainty, and guard margin must be non-negative")
        if self.connector_average_limit_dbm > CONSERVATIVE_CONNECTOR_CAP_DBM:
            raise ValueError(
                "This example refuses connector average working limits above +20 dBm; "
                "+30 dBm is a damage limit, not a target"
            )
        if self.connector_peak_limit_dbm > CONSERVATIVE_CONNECTOR_CAP_DBM:
            raise ValueError(
                "This example does not automate the +50 dBm narrow-pulse exception; "
                "connector peak working limit must be +20 dBm or lower"
            )
        if self.connector_peak_limit_dbm < self.connector_average_limit_dbm:
            raise ValueError("connector_peak_limit_dbm must not be below connector_average_limit_dbm")
        if abs(self.dc_volts) > CONSERVATIVE_DC_LIMIT_V:
            raise ValueError(
                "Declared connector DC {:.3g} V exceeds this example's ±0.2 V DC-coupled guard; "
                "verify an appropriate DC block/coupling path before connecting".format(self.dc_volts)
            )
        if preamp_enabled:
            raise ValueError("Safe high-level acquisition requires preamp OFF")

        connector_average = (
            self.source_max_average_dbm
            + self.path_gain_db
            + self.uncertainty_db
            + self.guard_margin_db
        )
        connector_peak = connector_average + self.waveform_papr_db
        if connector_average > self.connector_average_limit_dbm:
            raise ValueError(
                "Worst-case connector average {:.2f} dBm exceeds station working limit {:.2f} dBm".format(
                    connector_average, self.connector_average_limit_dbm
                )
            )
        if connector_peak > self.connector_peak_limit_dbm:
            raise ValueError(
                "Worst-case connector peak {:.2f} dBm exceeds station working limit {:.2f} dBm".format(
                    connector_peak, self.connector_peak_limit_dbm
                )
            )
        mixer_peak = connector_peak - input_attenuation_db
        if mixer_peak > CONSERVATIVE_MIXER_LEVEL_LIMIT_DBM:
            raise ValueError(
                "Worst-case mixer peak {:.2f} dBm exceeds the -12 dBm wideband guard; "
                "increase external path loss or analyzer attenuation".format(mixer_peak)
            )
        reference_headroom = reference_level_dbm - connector_peak
        if reference_headroom < 0:
            raise ValueError(
                "Reference level {:.2f} dBm is below worst-case connector peak {:.2f} dBm".format(
                    reference_level_dbm, connector_peak
                )
            )
        return InputSafetyEstimate(
            connector_average,
            connector_peak,
            mixer_peak,
            reference_headroom,
        )


def require_input_safety_envelope(
    *,
    required: bool,
    source_max_average_dbm: float | None,
    path_gain_db: float | None,
    waveform_papr_db: float | None,
    connector_average_limit_dbm: float | None,
    connector_peak_limit_dbm: float | None,
    dc_volts: float | None,
    uncertainty_db: float,
    guard_margin_db: float,
) -> SaInputSafetyEnvelope | None:
    supplied = {
        "--source-max-average-dbm": source_max_average_dbm,
        "--path-gain-db": path_gain_db,
        "--waveform-papr-db": waveform_papr_db,
        "--connector-average-limit-dbm": connector_average_limit_dbm,
        "--connector-peak-limit-dbm": connector_peak_limit_dbm,
        "--dc-volts": dc_volts,
    }
    missing = [name for name, value in supplied.items() if value is None]
    if required and missing:
        raise ValueError(
            "Real N9020B access requires an explicit connector safety envelope: {}".format(
                ", ".join(missing)
            )
        )
    if missing:
        return None
    return SaInputSafetyEnvelope(
        source_max_average_dbm=float(source_max_average_dbm),
        path_gain_db=float(path_gain_db),
        waveform_papr_db=float(waveform_papr_db),
        connector_average_limit_dbm=float(connector_average_limit_dbm),
        connector_peak_limit_dbm=float(connector_peak_limit_dbm),
        dc_volts=float(dc_volts),
        uncertainty_db=uncertainty_db,
        guard_margin_db=guard_margin_db,
    )


def dry_run_input_envelope() -> SaInputSafetyEnvelope:
    return SaInputSafetyEnvelope(
        source_max_average_dbm=0.0,
        path_gain_db=-40.0,
        waveform_papr_db=8.0,
        connector_average_limit_dbm=-20.0,
        connector_peak_limit_dbm=-10.0,
        dc_volts=0.0,
    )


def run_safe_spectrum(
    analyzer: N9020B,
    request: SpectrumRequest,
    *,
    acquire: bool,
    safety_envelope: SaInputSafetyEnvelope | None,
) -> SpectrumTrace | None:
    """Configure Swept SA and optionally acquire; cleanup always starts with ABOR."""

    result: SpectrumTrace | None = None
    try:
        analyzer.identify()
        _apply_initial_safe_state(analyzer, request.attenuation_db, swept_sa=True)
        analyzer.configure_spectrum(
            center_hz=request.center_hz,
            span_hz=request.span_hz,
            reference_level_dbm=request.reference_level_dbm,
            rbw_hz=request.rbw_hz,
            vbw_hz=request.vbw_hz,
            points=request.points,
            detector=request.detector,
            trigger_source=request.trigger_source,
        )
        analyzer.verify_safe_baseline(request.attenuation_db)
        analyzer.verify_spectrum_configuration(
            center_hz=request.center_hz,
            span_hz=request.span_hz,
            reference_level_dbm=request.reference_level_dbm,
            rbw_hz=request.rbw_hz,
            vbw_hz=request.vbw_hz,
            points=request.points,
            detector=request.detector,
            trigger_source=request.trigger_source,
        )
        analyzer.assert_no_errors("after Swept-SA configuration and query-back")
        if acquire:
            if safety_envelope is None:
                raise PermissionError("Acquisition requires an explicit analyzer input safety envelope")
            safety_envelope.evaluate(
                input_attenuation_db=request.attenuation_db,
                reference_level_dbm=request.reference_level_dbm,
                preamp_enabled=False,
            )
            analyzer.initiate_and_wait()
            result = analyzer.read_trace(
                center_hz=request.center_hz,
                span_hz=request.span_hz,
                points=request.points,
            )
            analyzer.assert_no_errors("after TRACE1 and peak-marker acquisition")
    finally:
        _cleanup(analyzer)
    return result


def run_powersuite_measurement(
    analyzer: N9020B,
    request: PowerSuiteRequest,
    *,
    acquire: bool,
    safety_envelope: SaInputSafetyEnvelope | None,
) -> PowerSuiteResult | None:
    """Demonstrate CHP/ACP/OBW CONF + READ or INIT/*OPC?/FETC semantics.

    This intentionally does not claim a standards-compliant channel setup.
    Carrier/offset integration bandwidths and limits are waveform/test-plan data.
    """

    result: PowerSuiteResult | None = None
    try:
        analyzer.identify()
        analyzer.abort()
        analyzer.clear_status()
        analyzer.configure_powersuite(
            request.measurement,
            center_hz=request.center_hz,
            reference_level_dbm=request.reference_level_dbm,
        )
        analyzer.set_single_acquisition()
        analyzer.set_input_protection(request.attenuation_db)
        analyzer.verify_safe_baseline(request.attenuation_db)
        analyzer.verify_powersuite_configuration(
            center_hz=request.center_hz,
            reference_level_dbm=request.reference_level_dbm,
        )
        analyzer.assert_no_errors("after PowerSuite configuration and query-back")
        if acquire:
            if safety_envelope is None:
                raise PermissionError("Acquisition requires an explicit analyzer input safety envelope")
            safety_envelope.evaluate(
                input_attenuation_db=request.attenuation_db,
                reference_level_dbm=request.reference_level_dbm,
                preamp_enabled=False,
            )
            if request.use_read:
                result = analyzer.read_powersuite()
            else:
                analyzer.initiate_and_wait()
                result = analyzer.fetch_powersuite()
            analyzer.assert_no_errors("after PowerSuite acquisition")
    finally:
        _cleanup(analyzer)
    return result


def _apply_initial_safe_state(analyzer: N9020B, attenuation_db: float, *, swept_sa: bool) -> None:
    # Order is deliberate and mirrored in the guide/tests.
    analyzer.abort()
    analyzer.clear_status()
    if swept_sa:
        analyzer.select_default_swept_sa()
    analyzer.set_single_acquisition()
    analyzer.set_input_protection(attenuation_db)


def _cleanup(analyzer: N9020B) -> None:
    failures = []
    # ABOR must be the first cleanup action. It cannot remove RF/DC at the connector.
    for label, action in (
        ("ABOR", analyzer.abort),
        ("INIT:CONT OFF", analyzer.set_single_acquisition),
        (
            "POW:ATT high / POW:GAIN OFF",
            lambda: analyzer.set_input_protection(SAFE_BASELINE_ATTENUATION_DB),
        ),
        (
            "safe-state query-back",
            lambda: analyzer.verify_safe_baseline(SAFE_BASELINE_ATTENUATION_DB),
        ),
        ("bounded error drain", lambda: analyzer.assert_no_errors("cleanup")),
    ):
        try:
            action()
        except Exception as error:  # cleanup must keep attempting later protections
            failures.append("{}: {}".format(label, error))
    try:
        analyzer.close()
    except Exception as error:
        failures.append("close: {}".format(error))
    if failures:
        raise CleanupError("N9020B cleanup failed: {}".format("; ".join(failures)))
