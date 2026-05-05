#!/usr/bin/env python3
"""
Enemy unit extractor for Helldivers 2 data dumps
- Input : dump.json (master object keyed by content paths)
- Output: enemydata.json
    {
      "Terminid": {
        "Charger": {
          "health": 2400,
          "damageable_zones": [ { ... all zone fields ... } ]
        },
        ...
      },
      "Automaton": { ... },
      "Illuminate": { ... }
    }

Normalization rules:
  - Terminid  : fac_bugs
  - Automaton : fac_cyborgs
  - Illuminate: fac_illuminate
  - Ignore    : fac_super_earth, fac_helldivers, anything unmapped

Unit naming (duplicate loc_name):
  - Each top-level JSON key becomes its own output entry (no merging).
  - Name is loc_name when the asset slug equals the parent folder slug
    (e.g. .../cha_berserker/cha_berserker).
  - Otherwise append (Variant) where Variant is the asset tail after parent_,
    title-cased from snake_case (e.g. .../cha_berserker/cha_berserker_iron_fleet
    with loc_name "Berserker" -> "Berserker (Iron Fleet)").
  - If two keys still collide on that display string, a numeric suffix (2), (3), ...
    is appended (no hex signatures).

Zone field filtering/renames:
  - ignore: affected_by_collision_impact, armor_angle_check, bleedout_enabled, child_zones,
            damage_multiplier, damage_multiplier_dps, explosion_verification_mode,
            hit_effect_receiver_type, ignore_armor_on_self, immortal,
            kill_children_on_death, max_armor, regeneration_enabled
  - rename: affected_by_explosions → ExTarget (0 → "Main", non‑zero → "Part"),
            affects_main_health → ToMain%,
            main_health_affect_capped_by_zone_health → MainCap,
            projectile_durable_resistance → Dur%,
            armor → AV,
            constitution → Con
  - transform: explosion_damage_multiplier → ExMult (if -1.0 then "-"; if non‑zero keep value; if 0 or null omit)
  - aggregate: if any of [causes_death_on_death, causes_death_on_downed,
                          causes_downed_on_death, causes_downed_on_downed] == 1,
               set IsFatal: true (and drop the individual flags)
  - keep as‑is (plus redaction for strings): zone_name, health

Run:
  python parser_faction_units.py -i dump.json -o enemydata.json
"""

import json
import os
import re
import argparse
from typing import Union
from collections import defaultdict
from typing import Any, Dict, Optional

# --- Mapping helpers -------------------------------------------------------

def normalize_faction(raw: str):
    """Map fac_* folder segment to target faction label or None to ignore."""
    r = raw.strip().lower().replace("_", "")
    mapping = {
        # desired three buckets
        "bugs": "Terminid",
        "cyborgs": "Automaton",
        "cyborg": "Automaton",
        "illuminate": "Illuminate",
        "illuminates": "Illuminate",
        # explicitly ignored
        "superearth": None,
        "helldivers": None,
        "helldiver": None,
        "human": None,
        "humans": None,
    }
    return mapping.get(r, None)

# --- Core parsing ----------------------------------------------------------

def round_float(value: Any) -> Union[int, float]:
    """Round float values to 2 decimal places. Returns int if value is whole number, float otherwise."""
    if isinstance(value, float):
        rounded = round(value, 2)
        # Return as int if it's a whole number (e.g., 1.0 -> 1, but 0.4 -> 0.4)
        return int(rounded) if rounded == int(rounded) else rounded
    elif isinstance(value, (int, bool)):
        return value
    else:
        # Try to convert to float and round
        try:
            fval = float(value)
            rounded = round(fval, 2)
            return int(rounded) if rounded == int(rounded) else rounded
        except (ValueError, TypeError):
            return value

def sanitize_string(s: str) -> str:
    if "^_^" in s:
        s = s.split("^_^", 1)[0]
    s = s.strip()
    
    # If zone name is purely numerical, replace with [unknown]
    if s.isdigit():
        s = "[unknown]"
    
    return s

def sanitize(obj: Union[dict, list, str, int, float, None]):
    """Recursively sanitize any string values by removing '^_^' marker and trailing data."""
    if isinstance(obj, str):
        return sanitize_string(obj)
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            out[k] = sanitize(v)
        return out
    return obj

IGNORED_ZONE_KEYS = {
    "affected_by_collision_impact",
    "armor_angle_check",
    "bleedout_enabled",
    "child_zones",
    "damage_multiplier",
    "damage_multiplier_dps",
    "explosion_verification_mode",
    "hit_effect_receiver_type",
    "ignore_armor_on_self",
    "immortal",
    "kill_children_on_death",
    "max_armor",
    "regeneration_enabled",
}

FATAL_KEYS = [
    "causes_death_on_death",
    "causes_death_on_downed",
    "causes_downed_on_death",
    "causes_downed_on_downed",
]

def normalize_ex_target(v: Any):
    try:
        return "Main" if int(v) == 0 else "Part"
    except Exception:
        return "Part"

def transform_zone(zone: Dict[str, Any]) -> Dict[str, Any]:
    """Filter/rename a single zone dict according to spec; strings are sanitized.
    Accepts either a zone dict or a wrapper with an 'info' dict.
    Returns an empty dict if nothing relevant remains (caller may drop it)."""
    if not isinstance(zone, dict):
        return {}

    # Some inputs wrap the actual fields under 'info'
    src = zone.get("info") if isinstance(zone.get("info"), dict) else zone

    out: Dict[str, Any] = {}

    # Keep selected fields (sanitized if string)
    if "zone_name" in src and src["zone_name"] is not None:
        out["zone_name"] = sanitize_string(str(src["zone_name"]))
    
    # Keep health as-is, rename constitution to Con
    if "health" in src and src["health"] is not None:
        out["health"] = src["health"]
    
    if "constitution" in src and src["constitution"] is not None:
        out["Con"] = src["constitution"]
    
    # Rename armor to AV (Armor Value)
    if "armor" in src and src["armor"] is not None:
        out["AV"] = src["armor"]

    # Renames / transforms
    if "affected_by_explosions" in src:
        out["ExTarget"] = normalize_ex_target(src["affected_by_explosions"])

    # Percentage values: round to 2 decimal places
    if "affects_main_health" in src:
        out["ToMain%"] = round_float(src["affects_main_health"])

    if "main_health_affect_capped_by_zone_health" in src:
        out["MainCap"] = src["main_health_affect_capped_by_zone_health"]

    if "projectile_durable_resistance" in src:
        out["Dur%"] = round_float(src["projectile_durable_resistance"])

    if "explosion_damage_multiplier" in src:
        edm = src["explosion_damage_multiplier"]
        try:
            edm_val = float(edm)
            if edm_val == -1.0:
                out["ExMult"] = "-"
            elif edm_val != 0.0:
                out["ExMult"] = round_float(edm_val)
            # 0.0 → omit
        except Exception:
            s = sanitize_string(str(edm))
            if s:
                out["ExMult"] = s

    # Aggregate fatal flags
    if any(int(src.get(k, 0) or 0) == 1 for k in FATAL_KEYS):
        out["IsFatal"] = True

    return out


def humanize_variant_slug(variant_slug: str) -> str:
    """Turn snake_case tail into 'Title Case Words'."""
    parts = [p for p in str(variant_slug).split("_") if p]
    if not parts:
        return ""
    return " ".join(p.title() for p in parts)


def display_name_from_key(loc_name: str, content_key: str) -> str:
    """Build a unique-friendly display name from loc_name and the JSON object key path."""
    sanitized_loc = sanitize_string(str(loc_name))
    base = content_key.split("^_^", 1)[0].strip().rstrip("/")
    parts = base.split("/")
    if len(parts) < 2:
        return sanitized_loc
    parent_slug = parts[-2]
    asset_slug = parts[-1]
    if asset_slug == parent_slug:
        return sanitized_loc
    prefix = parent_slug + "_"
    if asset_slug.startswith(prefix):
        variant_slug = asset_slug[len(prefix) :]
        if variant_slug:
            label = humanize_variant_slug(variant_slug)
            if label:
                return f"{sanitized_loc} ({label})"
    return sanitized_loc


def extract_disambiguator_from_key(content_key: str) -> Optional[str]:
    """Return short 0x<id> token from keys like '... ^_^ 0x54e107dacf6929cb' for collision suffix."""
    m = re.search(r"\^_\^\s*0x([0-9a-fA-F]+)", content_key)
    if not m:
        return None
    hx = m.group(1)
    return f"0x{hx[:8]}"


def unique_display_name(
    desired: str, fac_dict: Dict[str, Dict[str, Any]], content_key: str
) -> str:
    """Ensure desired is unique within fac_dict; append numeric suffix if needed."""
    if desired not in fac_dict:
        return desired
    n = 2
    while True:
        candidate = f"{desired} ({n})"
        if candidate not in fac_dict:
            return candidate
        n += 1


def parse_enemy_units(src: dict) -> dict:
    """Return {Faction: {UnitName: {health, damageable_zones}}}."""
    per_faction: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    for key, payload in src.items():
        if not isinstance(key, str) or not isinstance(payload, dict):
            continue
        if not key.startswith("content/fac_"):
            continue

        m = re.search(r"content/fac_([^/]+)/", key)
        if not m:
            continue
        faction_raw = m.group(1)
        faction = normalize_faction(faction_raw)
        if faction is None:
            continue

        loc_name = payload.get("loc_name")
        if not loc_name or str(loc_name).strip().upper() == "N/A":
            continue

        display_name = display_name_from_key(str(loc_name), key)
        fac_dict = per_faction[faction]
        display_name = unique_display_name(display_name, fac_dict, key)

        # Build zones: transform and drop empties/non-dicts
        raw_zones = payload.get("damageable_zones") or []
        zones: list = []
        if isinstance(raw_zones, list):
            for z in raw_zones:
                if isinstance(z, dict):
                    tz = transform_zone(z)
                    if tz:  # drop empty dicts
                        zones.append(tz)

        # Process default_damageable_zone_info into a zone named "Main"
        default_zone_info = payload.get("default_damageable_zone_info")
        if isinstance(default_zone_info, dict):
            main_zone = transform_zone(default_zone_info)
            if main_zone:
                main_zone["zone_name"] = "Main"
                # Override health with unit's main health
                unit_health = payload.get("health")
                if unit_health is not None:
                    main_zone["health"] = unit_health
                zones.insert(0, main_zone)

        # Build a trimmed view of the payload we care about
        current = {
            "health": payload.get("health"),
            "damageable_zones": zones,
        }

        fac_dict[display_name] = current

    # Stable alphabetical unit order by key when serialized (sort_keys=True on dump)
    return per_faction

# --- CLI ------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description="Extract enemy units grouped by faction with health and damageable_zones.")
    ap.add_argument("-i", "--input", default="Filtered_Health.json", help="Path to master JSON")
    ap.add_argument("-o", "--output", default="enemydata.json", help="Path to write grouped JSON")
    args = ap.parse_args()

    # Validate input file path
    if not args.input or not args.input.strip():
        ap.error("Input file path cannot be empty")
    
    input_path = args.input.strip()
    if not os.path.exists(input_path):
        ap.error(f"Input file not found: {input_path}")
    
    if not os.path.isfile(input_path):
        ap.error(f"Input path is not a file: {input_path}")

    # Validate output file path
    if not args.output or not args.output.strip():
        ap.error("Output file path cannot be empty")
    
    output_path = args.output.strip()
    output_dir = os.path.dirname(output_path)
    
    # Check if output directory exists or can be created
    if output_dir and not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
        except OSError as e:
            ap.error(f"Cannot create output directory '{output_dir}': {e}")

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = parse_enemy_units(data)

    # Convert defaultdicts to plain dicts for serialization
    result_out = {fac: dict(units) for fac, units in result.items()}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result_out, f, ensure_ascii=False, indent=2, sort_keys=True)

    total_units = sum(len(units) for units in result_out.values())
    print(f"Wrote {output_path} with {total_units} units across {len(result_out)} factions.")
    for fac in sorted(result_out.keys()):
        print(f"- {fac}: {len(result_out[fac])}")

if __name__ == "__main__":
    main()
