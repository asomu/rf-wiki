"""Build a conservative PA bias sweep plan; dry-run does not energize hardware."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BiasPoint:
    voltage_v: float
    current_limit_a: float
    dwell_s: float


def validate_plan(points: list[BiasPoint]) -> None:
    if not points:
        raise ValueError("at least one bias point is required")
    for point in points:
        if not 0 <= point.voltage_v <= 50:
            raise ValueError("voltage outside N6752A scope")
        if not 0 < point.current_limit_a <= 10:
            raise ValueError("current outside N6752A scope")
        if point.voltage_v * point.current_limit_a > 100:
            raise ValueError("point exceeds conservative 100 W envelope")
        if not 0 < point.dwell_s <= 262.144:
            raise ValueError("dwell outside LIST scope")


def default_plan() -> list[BiasPoint]:
    points = [
        BiasPoint(5.0, 0.10, 0.100),
        BiasPoint(12.0, 0.15, 0.100),
        BiasPoint(20.0, 0.20, 0.200),
        BiasPoint(28.0, 0.25, 0.500),
    ]
    validate_plan(points)
    return points


if __name__ == "__main__":
    for index, point in enumerate(default_plan(), start=1):
        print(f"{index}: {point.voltage_v:g} V · {point.current_limit_a:g} A limit · {point.dwell_s:g} s")
