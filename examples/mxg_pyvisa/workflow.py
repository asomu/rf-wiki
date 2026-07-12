"""One-shot safe workflow shared by the CLI and fake-transport tests."""

from contextlib import contextmanager
from dataclasses import dataclass
import math
import time
from types import TracebackType
from typing import Callable, Iterator, Optional, Set, Tuple

from .driver import (
    CleanupReport,
    InstrumentCapabilities,
    InstrumentIdentity,
    MxgError,
    MxgN5182B,
)
from .transport import ScpiTransport
from .waveform import generate_iq_tone


@dataclass(frozen=True)
class RunConfig:
    mode: str = "cw"
    frequency_hz: float = 1_000_000_000.0
    power_dbm: float = -30.0
    power_limit_dbm: float = -10.0
    rf_on: bool = False
    hold_seconds: float = 2.0
    waveform_name: str = "RF_WIKI_IQ"
    sample_rate_hz: float = 100_000_000.0
    sample_count: int = 4000
    tone_offset_hz: float = 1_000_000.0
    iq_amplitude: float = 0.5
    runtime_scale_percent: float = 70.0

    def validate(self) -> None:
        if self.mode not in {"cw", "waveform"}:
            raise ValueError("mode must be 'cw' or 'waveform'")
        if (
            not math.isfinite(self.hold_seconds)
            or self.hold_seconds < 0
            or self.hold_seconds > 60
        ):
            raise ValueError("hold_seconds must be in [0, 60]")


@dataclass(frozen=True)
class RunResult:
    identity: InstrumentIdentity
    option_codes: Set[str]
    rf_was_enabled: bool
    preexisting_errors: Tuple[str, ...]


@dataclass(frozen=True)
class OpenedMxgSession:
    controller: MxgN5182B
    identity: InstrumentIdentity
    capabilities: InstrumentCapabilities
    preexisting_errors: Tuple[str, ...]


@dataclass(frozen=True)
class IdentificationResult:
    identity: InstrumentIdentity
    capabilities: InstrumentCapabilities
    preexisting_errors: Tuple[str, ...]


class SessionSafetyError(MxgError):
    """A primary operation or session close was followed by incomplete cleanup."""

    def __init__(
        self,
        cleanup: CleanupReport,
        close_error: Optional[BaseException] = None,
        primary_error: Optional[BaseException] = None,
    ) -> None:
        details = ["cleanup RF state: {}".format(cleanup.rf_state.upper())]
        details.extend("cleanup failure: {}".format(item) for item in cleanup.failures)
        if close_error is not None:
            details.append(
                "transport close failure: {}: {}".format(
                    type(close_error).__name__, close_error
                )
            )
        if primary_error is not None:
            details.append(
                "primary failure preserved: {}: {}".format(
                    type(primary_error).__name__, primary_error
                )
            )
        super().__init__("; ".join(details))
        self.cleanup = cleanup
        self.close_error = close_error
        self.primary_error = primary_error

    @property
    def rf_state(self) -> str:
        return self.cleanup.rf_state


@contextmanager
def managed_mxg_session(
    transport: ScpiTransport,
    event_sink: Optional[Callable[[str], None]] = None,
) -> Iterator[OpenedMxgSession]:
    """Open a verified N5182B session and enforce one cleanup policy."""

    controller = MxgN5182B(transport)
    primary_error: Optional[BaseException] = None
    primary_traceback: Optional[TracebackType] = None
    try:
        controller.emergency_rf_off()
        identity = controller.identify()
        capabilities = controller.read_capabilities()
        preexisting_errors = tuple(controller.drain_errors())
        if event_sink is not None:
            for error in preexisting_errors:
                event_sink("Pre-existing error before *CLS: {}".format(error))
        controller.clear_status()
        yield OpenedMxgSession(
            controller,
            identity,
            capabilities,
            preexisting_errors,
        )
    except BaseException as error:
        primary_error = error
        primary_traceback = error.__traceback__

    try:
        cleanup = controller.cleanup_rf_off()
    except BaseException as error:
        cleanup = CleanupReport(
            "unknown",
            ("internal cleanup failure: {}: {}".format(type(error).__name__, error),),
        )

    close_error: Optional[BaseException] = None
    try:
        transport.close()
    except BaseException as error:
        close_error = error

    if not cleanup.ok or close_error is not None:
        safety_error = SessionSafetyError(cleanup, close_error, primary_error)
        if primary_error is not None:
            raise safety_error from primary_error
        if close_error is not None:
            raise safety_error from close_error
        raise safety_error

    if primary_error is not None:
        raise primary_error.with_traceback(primary_traceback)


def run_identification_session(
    transport: ScpiTransport,
    event_sink: Optional[Callable[[str], None]] = None,
) -> IdentificationResult:
    with managed_mxg_session(transport, event_sink) as session:
        return IdentificationResult(
            session.identity,
            session.capabilities,
            session.preexisting_errors,
        )


def run_session(
    transport: ScpiTransport,
    config: RunConfig,
    sleep_fn: Callable[[float], None] = time.sleep,
    event_sink: Optional[Callable[[str], None]] = None,
) -> RunResult:
    """Configure the instrument and return only after RF OFF is confirmed."""

    with managed_mxg_session(transport, event_sink) as session:
        config.validate()

        if config.mode == "cw":
            session.controller.configure_cw(
                config.frequency_hz, config.power_dbm, config.power_limit_dbm
            )
        else:
            samples = generate_iq_tone(
                config.sample_count,
                config.sample_rate_hz,
                config.tone_offset_hz,
                config.iq_amplitude,
            )
            session.controller.configure_iq_waveform(
                config.waveform_name,
                samples,
                config.sample_rate_hz,
                config.runtime_scale_percent,
                config.frequency_hz,
                config.power_dbm,
                config.power_limit_dbm,
            )

        if config.rf_on:
            session.controller.rf_on()
            sleep_fn(config.hold_seconds)

        return RunResult(
            session.identity,
            session.capabilities.option_codes,
            config.rf_on,
            session.preexisting_errors,
        )
