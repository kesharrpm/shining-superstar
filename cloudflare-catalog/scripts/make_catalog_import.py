#!/usr/bin/env python3
"""Merge the three current SHINING SUPERSTAR source databases into one ADMIN import payload.

This file is uploaded to the Cloudflare Worker at /admin/import/metadata.
It is NOT a player runtime manifest.
"""
import argparse
import json
from pathlib import Path


def load(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme-data", required=True)
    ap.add_argument("--wallpaper-data", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--version", default="1")
    ap.add_argument("--out", default="catalog_import.json")
    args = ap.parse_args()

    payload = {
        "catalogVersion": str(args.version),
        "themeData": load(args.theme_data),
        "wallpaperData": load(args.wallpaper_data),
        "sourceManifest": load(args.manifest),
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {args.out}")
    print(f"Groups: {len(payload['themeData'])}")
    print(f"Wallpapers: {len(payload['wallpaperData'])}")
    print(f"Bundles: {len(payload['sourceManifest'])}")


if __name__ == "__main__":
    main()
