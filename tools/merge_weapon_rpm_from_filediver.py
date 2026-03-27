#!/usr/bin/env python3
"""
Merge scalar RPM values from a filediver entity/component dump into weapondata.csv.

Primary extraction rules:
- Code: EncyclopediaEntryComponentData.prefix
- Name: EncyclopediaEntryComponentData.loc_name
- RPM: ProjectileWeaponComponentData.rounds_per_minute.default
       or ArcWeaponComponentData.rounds_per_minute

The script is intentionally conservative:
- It only writes clear scalar RPM values
- It joins by Code first, then Name
- It preserves existing RPM values for unmatched rows unless --clear-unmatched is set
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


def normalize_name(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def normalize_rpm(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        rpm = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(rpm) or rpm <= 0:
        return None
    return rpm


def format_rpm(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text


def extract_filediver_entries(payload: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], list[str], list[str]]:
    by_code_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_name_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unsupported: list[str] = []

    for key, entity in payload.items():
        if not isinstance(entity, dict):
            continue

        components = entity.get("components")
        if not isinstance(components, dict):
            continue

        entry = components.get("EncyclopediaEntryComponentData")
        if not isinstance(entry, dict):
            continue

        code = str(entry.get("prefix") or "").strip()
        name = str(entry.get("loc_name") or "").strip()
        if not code or not name:
            continue

        rpm = None
        source = None

        projectile = components.get("ProjectileWeaponComponentData")
        if isinstance(projectile, dict):
            projectile_rpm = projectile.get("rounds_per_minute")
            if isinstance(projectile_rpm, dict):
                rpm = normalize_rpm(projectile_rpm.get("default"))
                if rpm is not None:
                    source = "projectile"
            else:
                rpm = normalize_rpm(projectile_rpm)
                if rpm is not None:
                    source = "projectile"

        arc = components.get("ArcWeaponComponentData")
        if rpm is None and isinstance(arc, dict):
            rpm = normalize_rpm(arc.get("rounds_per_minute"))
            if rpm is not None:
                source = "arc"

        if rpm is None:
            if "BeamWeaponComponentData" in components:
                unsupported.append(f"{code} | {name} | beam")
            continue

        candidate = {
            "code": code,
            "name": name,
            "rpm": rpm,
            "source": source,
            "key": key,
        }
        by_code_candidates[code].append(candidate)
        by_name_candidates[normalize_name(name)].append(candidate)

    def collapse(candidates: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, dict[str, Any]], list[str]]:
        clear: dict[str, dict[str, Any]] = {}
        ambiguous: list[str] = []
        for join_key, entries in candidates.items():
            distinct = {
                (item["code"], item["name"], format_rpm(item["rpm"]), item["source"])
                for item in entries
            }
            if len(distinct) == 1:
                clear[join_key] = entries[0]
            else:
                ambiguous.append(join_key)
        return clear, sorted(ambiguous)

    clear_by_code, ambiguous_codes = collapse(by_code_candidates)
    clear_by_name, ambiguous_names = collapse(by_name_candidates)
    return clear_by_code, clear_by_name, ambiguous_codes, ambiguous_names + sorted(unsupported)


def extract_wiki_entries(payload: Any) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], list[str]]:
    entries = payload if isinstance(payload, list) else []
    by_code_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_name_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for item in entries:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code") or "").strip()
        name = str(item.get("name") or "").strip()
        rpm = normalize_rpm(item.get("rpm"))
        if rpm is None:
            rpms = item.get("rpms")
            if isinstance(rpms, list) and len(rpms) == 1:
                rpm = normalize_rpm(rpms[0])
        if rpm is None or not code or not name:
            continue
        candidate = {
            "code": code,
            "name": name,
            "rpm": rpm,
            "source": "wiki",
        }
        by_code_candidates[code].append(candidate)
        by_name_candidates[normalize_name(name)].append(candidate)

    def collapse(candidates: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, dict[str, Any]], list[str]]:
        clear: dict[str, dict[str, Any]] = {}
        ambiguous: list[str] = []
        for join_key, items in candidates.items():
            distinct = {
                (item["code"], item["name"], format_rpm(item["rpm"]))
                for item in items
            }
            if len(distinct) == 1:
                clear[join_key] = items[0]
            else:
                ambiguous.append(join_key)
        return clear, sorted(ambiguous)

    clear_by_code, ambiguous_codes = collapse(by_code_candidates)
    clear_by_name, ambiguous_names = collapse(by_name_candidates)
    return clear_by_code, clear_by_name, ambiguous_codes + ambiguous_names


def load_json(path: str | None, url: str | None) -> Any:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    if url:
        request = Request(
            url,
            headers={
                "User-Agent": "supercalc-rpm-refresh/1.0",
                "Accept": "application/json,text/plain,*/*",
            },
        )
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    return None


def merge_rpm(
    csv_rows: list[dict[str, str]],
    fieldnames: list[str],
    clear_by_code: dict[str, dict[str, Any]],
    clear_by_name: dict[str, dict[str, Any]],
    wiki_by_code: dict[str, dict[str, Any]],
    wiki_by_name: dict[str, dict[str, Any]],
    clear_unmatched: bool,
) -> tuple[list[dict[str, str]], list[str], dict[str, int]]:
    if "RPM" not in fieldnames:
        try:
            name_index = fieldnames.index("Name")
            fieldnames.insert(name_index + 1, "RPM")
        except ValueError:
            fieldnames.append("RPM")

    unresolved: list[str] = []
    counts = {"filediver": 0, "wiki": 0}

    for row in csv_rows:
        code = str(row.get("Code") or "").strip()
        name = str(row.get("Name") or "").strip()
        existing_rpm = str(row.get("RPM") or "").strip()

        match = None
        if code and code != "-":
            match = clear_by_code.get(code)
        if match is None and name:
            match = clear_by_name.get(normalize_name(name))
        if match is None and code and code != "-":
            match = wiki_by_code.get(code)
            if match is not None:
                counts["wiki"] += 1
        if match is None and name:
            match = wiki_by_name.get(normalize_name(name))
            if match is not None:
                counts["wiki"] += 1

        if match is not None:
            if match["source"] != "wiki":
                counts["filediver"] += 1
            row["RPM"] = format_rpm(match["rpm"])
            continue

        unresolved_key = code if code and code != "-" else name
        if unresolved_key:
            unresolved.append(unresolved_key)

        if clear_unmatched:
            row["RPM"] = ""
        elif existing_rpm:
            row["RPM"] = existing_rpm
        else:
            row["RPM"] = ""

    return csv_rows, sorted(set(unresolved)), counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge RPM values from a filediver entity dump into weapondata.csv.")
    parser.add_argument("--dump", required=True, help="Path to entity-component-settings.json from filediver")
    parser.add_argument("--csv", default=r"weapons\weapondata.csv", help="Input CSV path")
    parser.add_argument("--output", default=None, help="Output CSV path (defaults to input path)")
    parser.add_argument("--clear-unmatched", action="store_true", help="Blank RPM values for rows that do not match filediver output")
    wiki_group = parser.add_mutually_exclusive_group()
    wiki_group.add_argument("--wiki-json", help="Optional local raw JSON export from the wiki weapons data module")
    wiki_group.add_argument("--wiki-url", help="Optional wiki raw JSON URL for fallback values")
    args = parser.parse_args()

    dump_path = Path(args.dump)
    csv_path = Path(args.csv)
    output_path = Path(args.output) if args.output else csv_path

    dump_data = load_json(str(dump_path), None)

    clear_by_code, clear_by_name, ambiguous_codes, unsupported_or_ambiguous_names = extract_filediver_entries(dump_data)
    wiki_payload = load_json(args.wiki_json, args.wiki_url)
    wiki_by_code, wiki_by_name, ambiguous_wiki = extract_wiki_entries(wiki_payload) if wiki_payload is not None else ({}, {}, [])

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    merged_rows, unresolved, counts = merge_rpm(
        rows,
        fieldnames,
        clear_by_code,
        clear_by_name,
        wiki_by_code,
        wiki_by_name,
        args.clear_unmatched,
    )

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged_rows)

    unique_csv_codes = {
        str(row.get("Code") or "").strip()
        for row in rows
        if str(row.get("Code") or "").strip() and str(row.get("Code") or "").strip() != "-"
    }
    covered_codes = sorted(set(unique_csv_codes) & set(clear_by_code))

    print(f"Clear filediver code matches: {len(clear_by_code)}")
    print(f"CSV codes covered by filediver: {len(covered_codes)} / {len(unique_csv_codes)}")
    print(f"Ambiguous filediver code keys: {len(ambiguous_codes)}")
    if wiki_payload is not None:
        print(f"Clear wiki code matches: {len(wiki_by_code)}")
        print(f"Ambiguous wiki keys: {len(ambiguous_wiki)}")
    print(f"Rows filled from filediver: {counts['filediver']}")
    print(f"Rows filled from wiki fallback: {counts['wiki']}")
    print(f"Rows unresolved after merge: {len(unresolved)}")
    if ambiguous_codes:
        print("Ambiguous code samples:", ", ".join(ambiguous_codes[:20]))
    if ambiguous_wiki:
        print("Ambiguous wiki samples:", ", ".join(ambiguous_wiki[:20]))
    if unsupported_or_ambiguous_names:
        print("Unsupported/ambiguous samples:", ", ".join(unsupported_or_ambiguous_names[:20]))
    if unresolved:
        print("Unresolved row samples:", ", ".join(unresolved[:20]))
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
