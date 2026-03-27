#!/usr/bin/env python3
"""
Flatten a filediver entity-component dump into parser_faction_units.py input.

The current filediver dumper may emit component payloads either:

- directly at the top level (older shape), or
- under a nested "components" object (newer shape)

This script normalizes both shapes into the flat object expected by
tools\parser_faction_units.py:

{
  "content/fac_bugs/...": {
    "loc_name": "Hive Guard",
    "health": 500,
    "default_damageable_zone_info": {...},
    "damageable_zones": [...]
  }
}
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Optional


PATH_BUCKET_MAP = {
    "bugs": "bugs",
    "cyborgs": "cyborgs",
    "cyborg": "cyborgs",
    "illuminate": "illuminate",
    "illuminates": "illuminate",
}

FACTION_BUCKET_MAP = {
    "FactionType_Bugs": "bugs",
    "FactionType_Cyborg": "cyborgs",
    "FactionType_Cyborgs": "cyborgs",
    "FactionType_Illuminate": "illuminate",
    "FactionType_Illuminates": "illuminate",
}


def titlecase_upper(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned.title()


def ensure_parent_dir(path: Path) -> None:
    if path.parent and not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)


def resolve_components(payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None
    nested = payload.get("components")
    if isinstance(nested, dict):
        return nested
    return payload


def extract_bucket_from_path(path: Any) -> Optional[str]:
    if not isinstance(path, str):
        return None
    match = re.search(r"content/fac_([^/]+)/", path)
    if not match:
        return None
    return PATH_BUCKET_MAP.get(match.group(1).strip().lower())


def extract_bucket_from_factions(faction_component: Any) -> Optional[str]:
    if not isinstance(faction_component, dict):
        return None
    factions = faction_component.get("factions")
    if not isinstance(factions, list):
        return None
    for faction in factions:
        if faction in FACTION_BUCKET_MAP:
            return FACTION_BUCKET_MAP[faction]
    return None


def resolve_loc_name(entry: Any) -> Optional[str]:
    if not isinstance(entry, dict):
        return None

    loc_name = entry.get("loc_name")
    if isinstance(loc_name, str) and loc_name.strip():
        return loc_name.strip()

    return titlecase_upper(entry.get("loc_name_upper"))


def resolve_canonical_key(entity_key: str, components: Dict[str, Any]) -> Optional[str]:
    top_level_bucket = extract_bucket_from_path(entity_key)
    if top_level_bucket is not None:
        return entity_key

    for component_name in ("UnitComponentData", "LocalUnitComponentData"):
        component = components.get(component_name)
        if not isinstance(component, dict):
            continue
        unit_path = component.get("unit_path")
        bucket = extract_bucket_from_path(unit_path)
        if bucket is not None and isinstance(unit_path, str):
            return f"{unit_path}__{entity_key}"

    bucket = extract_bucket_from_factions(components.get("FactionComponentData"))
    if bucket is not None:
        return f"content/fac_{bucket}/__unresolved__/{entity_key}"

    return None


def flatten_entity_component_settings(src: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    flattened: Dict[str, Dict[str, Any]] = {}

    for entity_key, payload in src.items():
        if not isinstance(entity_key, str):
            continue

        components = resolve_components(payload)
        if components is None:
            continue

        entry = components.get("EncyclopediaEntryComponentData")
        health = components.get("HealthComponentData")
        if not isinstance(entry, dict) or not isinstance(health, dict):
            continue

        loc_name = resolve_loc_name(entry)
        if not loc_name:
            continue

        canonical_key = resolve_canonical_key(entity_key, components)
        if not canonical_key:
            continue

        output_key = canonical_key
        duplicate_index = 2
        while output_key in flattened:
            output_key = f"{canonical_key}__dup{duplicate_index}"
            duplicate_index += 1

        flattened[output_key] = {
            "loc_name": loc_name,
            "health": health.get("health"),
            "default_damageable_zone_info": health.get("default_damageable_zone_info"),
            "damageable_zones": health.get("damageable_zones"),
        }

    return flattened


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Flatten filediver entity-component settings into parser input.",
    )
    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Path to the raw entity-component-settings JSON dump.",
    )
    parser.add_argument(
        "-o",
        "--output",
        required=True,
        help="Path to write the flattened JSON file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_path = Path(args.input.strip())
    output_path = Path(args.output.strip())

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    if not input_path.is_file():
        raise SystemExit(f"Input path is not a file: {input_path}")

    ensure_parent_dir(output_path)

    with input_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict):
        raise SystemExit("Input JSON must be a top-level object")

    flattened = flatten_entity_component_settings(data)

    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(flattened, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")

    print(f"Wrote {output_path} with {len(flattened)} flattened entries.")


if __name__ == "__main__":
    main()
