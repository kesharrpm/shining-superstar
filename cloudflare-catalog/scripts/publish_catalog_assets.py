#!/usr/bin/env python3
import argparse, hashlib, json, os, re, shutil
from pathlib import Path
import pyzipper

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def slug(v):
    s = str(v or "").strip().lower().replace("’", "").replace("'", "").replace("&", "and")
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_.-]", "", s)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


def norm(v):
    s = str(v or "").replace("\\", "/").lstrip("/")
    if s.lower().startswith("images/"):
        s = s[7:]
    s = re.sub(r"\.(png|webp|jpe?g|gif|avif)$", "", s, flags=re.I)
    return s.lower()


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def theme_lookup(theme_data):
    items = []
    for group_name, info in (theme_data or {}).items():
        gs = slug(group_name)
        for theme in list(info.get("themes", [])) + list(info.get("le_themes", [])):
            items.append((gs, slug(theme)))
    items.sort(key=lambda x: len(x[0]) + len(x[1]), reverse=True)
    return items


def bundle_identity(key, lookup):
    low = key.lower()
    kind, tail = "unknown", low
    for prefix in ("empty_cards_", "profile_", "cards_", "bg_"):
        if low.startswith(prefix):
            kind, tail = prefix[:-1], low[len(prefix):]
            break
    if tail.endswith("_le"):
        tail = tail[:-3]
    for gs, ts in lookup:
        expected = f"{gs}_{ts}"
        if tail == expected or tail.startswith(expected + "_"):
            return kind, gs, ts
    return kind, None, None


def infer_binding(kind, gs, ts, original):
    name = norm(original)
    if kind == "profile" and gs and ts:
        pre = f"p_{ts}_"
        if name.startswith(pre):
            member = name[len(pre):]
            if member:
                return f"profile:{gs}:{ts}:{member}"
    if kind in ("cards", "empty_cards") and gs and ts:
        size, rest = None, None
        for pre, sz in ((f"c_l_{ts}_", "large"), (f"c_s_{ts}_", "small")):
            if name.startswith(pre):
                size, rest = sz, name[len(pre):]
                break
        if rest:
            parts, tail = rest.split("_"), rest.split("_")[-1]
            if tail == "em" or kind == "empty_cards":
                member = "_".join(parts[:-1] if tail == "em" else parts)
                if member:
                    return f"ghost:{gs}:{ts}:{member}:{size}"
            if tail in {"c", "b", "a", "s", "r"}:
                member = "_".join(parts[:-1])
                if member:
                    return f"card:{gs}:{ts}:{member}:{tail}:{size}"
            # Legacy grade-less card image. Treat as R; Worker resolver can fall back to this.
            return f"card:{gs}:{ts}:{rest}:r:{size}"
    if kind == "bg" or name.startswith("mybg_") or name.startswith("lobby_mybg_"):
        return f"wallpaper-alias:{name}"
    return None


def md5_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--publish", required=True)
    ap.add_argument("--password", required=True)
    args = ap.parse_args()

    source = Path(args.source)
    publish = Path(args.publish)
    publish.mkdir(parents=True, exist_ok=True)
    assets_dir = publish / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_json(source / "dev/2.0.0/manifest_hashes")
    theme_data = load_json(source / "qa/themeData.json")
    lookup = theme_lookup(theme_data)

    old_index = {}
    idx_path = publish / "catalog_index.json"
    if idx_path.exists():
        try:
            old_index = load_json(idx_path)
        except Exception:
            old_index = {}
    old_bundles = old_index.get("bundles", {}) if isinstance(old_index, dict) else {}

    new_index = {
        "version": "",
        "generated_from": "dev/2.0.0/manifest_hashes",
        "assets": {},
        "bindings": {},
        "aliases": {},
        "bundles": {},
    }

    changed = 0
    reused = 0
    password = args.password.encode("utf-8")

    for key, info in manifest.items():
        filename = str(info.get("file", ""))
        checksum = str(info.get("md5_checksum") or info.get("md5") or info.get("hash") or "").lower()
        old = old_bundles.get(key, {})
        if old.get("checksum") == checksum and old.get("assets"):
            reused += 1
            new_index["bundles"][key] = old
            for aid in old.get("assets", []):
                if aid in old_index.get("assets", {}):
                    new_index["assets"][aid] = old_index["assets"][aid]
            for bk, aid in old_index.get("bindings", {}).items():
                if aid in old.get("assets", []):
                    new_index["bindings"][bk] = aid
            for alias, aid in old_index.get("aliases", {}).items():
                if aid in old.get("assets", []):
                    new_index["aliases"][alias] = aid
            continue

        bundle_path = source / "dev/2.0.0" / filename
        if not bundle_path.exists():
            raise FileNotFoundError(f"Bundle missing: {bundle_path}")
        if checksum:
            actual = md5_file(bundle_path)
            if actual != checksum:
                raise RuntimeError(f"MD5 mismatch for {key}: expected {checksum}, got {actual}")

        kind, gs, ts = bundle_identity(key, lookup)
        bundle_assets = []
        with pyzipper.AESZipFile(bundle_path) as zf:
            zf.pwd = password
            for zi in zf.infolist():
                if zi.is_dir():
                    continue
                raw = zf.read(zi)
                if not raw.startswith(PNG_SIG):
                    continue
                original = norm(zi.filename)
                sha = hashlib.sha256(raw).hexdigest()
                aid = f"sha256:{sha}"
                rel = f"assets/{sha[:2]}/{sha}.png"
                out = publish / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                if not out.exists():
                    out.write_bytes(raw)
                new_index["assets"][aid] = {
                    "sha256": sha,
                    "size": len(raw),
                    "mime": "image/png",
                    "url": f"https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@catalog-assets/{rel}",
                    "original_name": original,
                    "source_bundle": key,
                }
                new_index["aliases"][original] = aid
                binding = infer_binding(kind, gs, ts, original)
                if binding:
                    new_index["bindings"][binding] = aid
                bundle_assets.append(aid)
        new_index["bundles"][key] = {
            "checksum": checksum,
            "source_file": filename,
            "kind": kind,
            "group": gs,
            "theme": ts,
            "assets": bundle_assets,
        }
        changed += 1
        print(f"processed {key}: {len(bundle_assets)} PNGs")

    # Stable version derived from the full source manifest.
    version_src = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    new_index["version"] = hashlib.sha256(version_src).hexdigest()[:16]

    # Remove orphaned published files so the branch doesn't grow forever.
    referenced = {Path(a["url"].split("@catalog-assets/", 1)[1]).as_posix() for a in new_index["assets"].values()}
    if assets_dir.exists():
        for p in assets_dir.rglob("*.png"):
            if p.relative_to(publish).as_posix() not in referenced:
                p.unlink()
        for d in sorted([p for p in assets_dir.rglob("*") if p.is_dir()], reverse=True):
            try: d.rmdir()
            except OSError: pass

    idx_path.write_text(json.dumps(new_index, indent=2, sort_keys=True), encoding="utf-8")
    (publish / "README.md").write_text("# SHINING SUPERSTAR processed catalog assets\n\nGenerated automatically. Do not edit by hand.\n", encoding="utf-8")
    print(f"done: changed bundles={changed}, reused bundles={reused}, assets={len(new_index['assets'])}, bindings={len(new_index['bindings'])}")

if __name__ == "__main__":
    main()
