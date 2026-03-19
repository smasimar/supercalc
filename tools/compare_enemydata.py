#!/usr/bin/env python3
"""
Compare generated enemy data against the checked-in enemy dataset.

The goal is review, not blind application:

- normalize noise such as MainCap bool/int and default ExMult
- preserve existing readable zone names only when a unique, safe alias match
  exists for a generated zone
- report added units, missing/manual-only units, and overlapping stat changes
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


HASH_NAME_RE = re.compile(r"^0x[0-9a-fA-F]+$")


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SystemExit(f"Expected top-level object in {path}")
    return data


def ensure_parent_dir(path: Path) -> None:
    if path.parent and not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)


def normalize_zone(zone: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}

    for key, value in zone.items():
        if key == "zone_name":
            continue
        if key == "MainCap":
            normalized[key] = bool(value)
            continue
        normalized[key] = value

    normalized.setdefault("MainCap", False)
    normalized.setdefault("ExMult", 1)
    return normalized


def full_signature(zone: Dict[str, Any]) -> str:
    return json.dumps(normalize_zone(zone), sort_keys=True, separators=(",", ":"))


def is_opaque_zone_name(name: Any) -> bool:
    if not isinstance(name, str):
        return True
    stripped = name.strip()
    if not stripped:
        return True
    return stripped == "[unknown]" or stripped.isdigit() or bool(HASH_NAME_RE.fullmatch(stripped))


def has_readable_zone_name(zone: Dict[str, Any]) -> bool:
    return not is_opaque_zone_name(zone.get("zone_name"))


def group_zones(zones: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}

    for zone in zones:
        signature = full_signature(zone)
        bucket = grouped.setdefault(
            signature,
            {
                "signature": json.loads(signature),
                "count": 0,
                "zone_names": [],
            },
        )
        bucket["count"] += 1
        name = zone.get("zone_name")
        if isinstance(name, str) and name:
            bucket["zone_names"].append(name)

    for bucket in grouped.values():
        bucket["zone_names"].sort()

    return grouped


def apply_safe_aliases(
    current_unit: Dict[str, Any],
    generated_unit: Dict[str, Any],
) -> Tuple[Dict[str, Any], int]:
    current_by_signature: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    generated_by_signature: Dict[str, List[Tuple[int, Dict[str, Any]]]] = defaultdict(list)

    aliased_unit = copy.deepcopy(generated_unit)
    generated_zones = aliased_unit.get("damageable_zones") or []
    if not isinstance(generated_zones, list):
        return aliased_unit, 0

    for zone in current_unit.get("damageable_zones") or []:
        if isinstance(zone, dict):
            current_by_signature[full_signature(zone)].append(zone)

    for index, zone in enumerate(generated_zones):
        if isinstance(zone, dict):
            generated_by_signature[full_signature(zone)].append((index, zone))

    alias_count = 0

    for signature, current_matches in current_by_signature.items():
        generated_matches = generated_by_signature.get(signature, [])
        if len(current_matches) != 1 or len(generated_matches) != 1:
            continue

        current_zone = current_matches[0]
        generated_index, generated_zone = generated_matches[0]
        current_name = current_zone.get("zone_name")

        if not has_readable_zone_name(current_zone):
            continue

        if generated_zone.get("zone_name") == current_name:
            continue

        if has_readable_zone_name(generated_zone):
            continue

        aliased_unit["damageable_zones"][generated_index]["zone_name"] = current_name
        alias_count += 1

    return aliased_unit, alias_count


def diff_unit(current_unit: Dict[str, Any], generated_unit: Dict[str, Any]) -> Dict[str, Any]:
    current_health = current_unit.get("health")
    generated_health = generated_unit.get("health")

    current_groups = group_zones(current_unit.get("damageable_zones") or [])
    generated_groups = group_zones(generated_unit.get("damageable_zones") or [])

    removed_groups: List[Dict[str, Any]] = []
    added_groups: List[Dict[str, Any]] = []

    current_counts = Counter({signature: bucket["count"] for signature, bucket in current_groups.items()})
    generated_counts = Counter({signature: bucket["count"] for signature, bucket in generated_groups.items()})

    for signature, count in sorted(current_counts.items()):
        delta = count - generated_counts.get(signature, 0)
        if delta > 0:
            bucket = current_groups[signature]
            removed_groups.append(
                {
                    "count_delta": delta,
                    "signature": bucket["signature"],
                    "zone_names": bucket["zone_names"],
                }
            )

    for signature, count in sorted(generated_counts.items()):
        delta = count - current_counts.get(signature, 0)
        if delta > 0:
            bucket = generated_groups[signature]
            added_groups.append(
                {
                    "count_delta": delta,
                    "signature": bucket["signature"],
                    "zone_names": bucket["zone_names"],
                }
            )

    if current_health == generated_health and not removed_groups and not added_groups:
        return {}

    return {
        "current_health": current_health,
        "generated_health": generated_health,
        "current_zone_count": sum(current_counts.values()),
        "generated_zone_count": sum(generated_counts.values()),
        "removed_zone_groups": removed_groups,
        "added_zone_groups": added_groups,
    }


def diff_unit_zone_names(
    current_unit: Dict[str, Any],
    generated_unit: Dict[str, Any],
) -> List[Dict[str, Any]]:
    current_groups = group_zones(current_unit.get("damageable_zones") or [])
    generated_groups = group_zones(generated_unit.get("damageable_zones") or [])

    renamed_groups: List[Dict[str, Any]] = []

    for signature in sorted(set(current_groups) & set(generated_groups)):
        current_bucket = current_groups[signature]
        generated_bucket = generated_groups[signature]

        if current_bucket["count"] != generated_bucket["count"]:
            continue

        current_names = current_bucket["zone_names"]
        generated_names = generated_bucket["zone_names"]

        if current_names == generated_names:
            continue

        if not current_names and not generated_names:
            continue

        renamed_groups.append(
            {
                "signature": current_bucket["signature"],
                "current_zone_names": current_names,
                "generated_zone_names": generated_names,
            }
        )

    return renamed_groups


def count_units(data: Dict[str, Any]) -> int:
    total = 0
    for units in data.values():
        if isinstance(units, dict):
            total += len(units)
    return total


def compare_datasets(
    current: Dict[str, Any],
    generated: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    normalized_generated = copy.deepcopy(generated)
    faction_report: Dict[str, Any] = {}

    total_aliases = 0
    total_added = 0
    total_missing = 0
    total_stat_changed = 0
    total_name_changed = 0

    all_factions = sorted(set(current) | set(generated))

    for faction in all_factions:
        current_units = current.get(faction)
        generated_units = generated.get(faction)

        if not isinstance(current_units, dict):
            current_units = {}
        if not isinstance(generated_units, dict):
            generated_units = {}

        added_units = sorted(set(generated_units) - set(current_units))
        missing_units = sorted(set(current_units) - set(generated_units))
        overlapping_units = sorted(set(current_units) & set(generated_units))

        stat_changed_units: Dict[str, Any] = {}
        name_only_units: Dict[str, Any] = {}

        for unit_name in overlapping_units:
            current_unit = current_units[unit_name]
            generated_unit = generated_units[unit_name]
            if not isinstance(current_unit, dict) or not isinstance(generated_unit, dict):
                continue

            aliased_unit, alias_count = apply_safe_aliases(current_unit, generated_unit)
            total_aliases += alias_count
            normalized_generated.setdefault(faction, {})[unit_name] = aliased_unit

            unit_diff = diff_unit(current_unit, aliased_unit)
            name_diff = diff_unit_zone_names(current_unit, aliased_unit)

            if unit_diff:
                if name_diff:
                    unit_diff["renamed_zone_groups"] = name_diff
                if alias_count:
                    unit_diff["safe_aliases_applied"] = alias_count
                stat_changed_units[unit_name] = unit_diff
            elif name_diff:
                name_only_units[unit_name] = {
                    "renamed_zone_groups": name_diff,
                }
                if alias_count:
                    name_only_units[unit_name]["safe_aliases_applied"] = alias_count

        if added_units or missing_units or stat_changed_units or name_only_units:
            faction_report[faction] = {}
            if added_units:
                faction_report[faction]["added_units"] = added_units
            if missing_units:
                faction_report[faction]["missing_units"] = missing_units
            if stat_changed_units:
                faction_report[faction]["stat_changed_units"] = stat_changed_units
            if name_only_units:
                faction_report[faction]["name_only_units"] = name_only_units

        total_added += len(added_units)
        total_missing += len(missing_units)
        total_stat_changed += len(stat_changed_units)
        total_name_changed += len(name_only_units)

    report = {
        "summary": {
            "current_unit_count": count_units(current),
            "generated_unit_count": count_units(generated),
            "added_unit_count": total_added,
            "missing_unit_count": total_missing,
            "stat_changed_unit_count": total_stat_changed,
            "name_changed_unit_count": total_name_changed,
            "safe_aliases_applied": total_aliases,
        },
        "factions": faction_report,
    }

    return report, normalized_generated


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    default_current = repo_root / "enemies" / "enemydata.json"

    parser = argparse.ArgumentParser(
        description="Compare generated enemy data against the checked-in dataset.",
    )
    parser.add_argument(
        "--current",
        default=str(default_current),
        help="Path to the checked-in or curated enemydata.json file.",
    )
    parser.add_argument(
        "--generated",
        required=True,
        help="Path to the generated enemydata JSON file to review.",
    )
    parser.add_argument(
        "--report",
        help="Optional path to write the JSON diff report.",
    )
    parser.add_argument(
        "--normalized-generated",
        help="Optional path to write a copy of the generated data with safe aliases applied.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    current_path = Path(args.current.strip())
    generated_path = Path(args.generated.strip())
    report_path = Path(args.report.strip()) if args.report else None
    normalized_output_path = (
        Path(args.normalized_generated.strip()) if args.normalized_generated else None
    )

    if not current_path.exists():
        raise SystemExit(f"Current enemy data file not found: {current_path}")
    if not generated_path.exists():
        raise SystemExit(f"Generated enemy data file not found: {generated_path}")

    current = load_json(current_path)
    generated = load_json(generated_path)
    report, normalized_generated = compare_datasets(current, generated)

    if report_path is not None:
        ensure_parent_dir(report_path)
        with report_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(report, handle, indent=2, sort_keys=True, ensure_ascii=False)
            handle.write("\n")

    if normalized_output_path is not None:
        ensure_parent_dir(normalized_output_path)
        with normalized_output_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(normalized_generated, handle, indent=2, sort_keys=True, ensure_ascii=False)
            handle.write("\n")

    print(
        "Summary:",
        f"current={report['summary']['current_unit_count']}",
        f"generated={report['summary']['generated_unit_count']}",
        f"added={report['summary']['added_unit_count']}",
        f"missing={report['summary']['missing_unit_count']}",
        f"stat_changed={report['summary']['stat_changed_unit_count']}",
        f"name_changed={report['summary']['name_changed_unit_count']}",
        f"aliases={report['summary']['safe_aliases_applied']}",
    )

    if report_path is None:
        print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))
    else:
        print(f"Wrote report to {report_path}")

    if normalized_output_path is not None:
        print(f"Wrote normalized generated data to {normalized_output_path}")


if __name__ == "__main__":
    main()
