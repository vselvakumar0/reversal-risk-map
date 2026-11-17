#!/usr/bin/env python3
"""Turn the Earth Engine export into data/scores.json.

Usage:
    python3 pipeline/build_scores.py reversal_risk_indicators.csv

The site ranks and weights the indicators in the browser, so this script only
cleans the raw values and writes them out.
"""
import csv
import datetime
import json
import pathlib
import sys

ID_FIELD = "adm1_code"
MIN_FOREST_KM2 = 100  # below this, deforestation pressure is not meaningful


def num(value):
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    return x if x == x else None  # drop NaN


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = pathlib.Path(__file__).resolve().parent.parent
    known = {f["properties"]["id"]
             for f in json.load(open(root / "data" / "regions.geojson"))["features"]}

    regions = {}
    with open(sys.argv[1], newline="") as fh:
        for row in csv.DictReader(fh):
            rid = row[ID_FIELD]
            if rid not in known:
                continue
            fire, drought, cyclone = num(row.get("fire")), num(row.get("drought")), num(row.get("cyclone"))
            loss, forest = num(row.get("loss_km2")), num(row.get("forest_km2"))
            defor = None
            if loss is not None and forest is not None and forest >= MIN_FOREST_KM2:
                defor = round(100 * loss / forest, 2)
            regions[rid] = {
                "fire": None if fire is None else round(fire, 3),
                "drought": None if drought is None else round(drought, 4),
                "cyclone": None if cyclone is None else round(cyclone, 3),
                "deforestation": defor,
            }

    missing = sorted(known - set(regions))
    out = {
        "meta": {
            "source": "gee",
            "note": "Computed with pipeline/reversal_risk_gee.js",
            "period": "2001-2023 (cyclones from 1980)",
            "generated": datetime.date.today().isoformat(),
        },
        "regions": regions,
    }
    json.dump(out, open(root / "data" / "scores.json", "w"), separators=(",", ":"))
    print(f"Wrote {len(regions)} regions to data/scores.json")
    if missing:
        print(f"No rows for {len(missing)} regions, e.g. {', '.join(missing[:10])}")


if __name__ == "__main__":
    main()
