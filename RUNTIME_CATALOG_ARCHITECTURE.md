# SHINING SUPERSTAR Runtime Catalog Architecture — 4.1

**Primary runtime:** Player → Cloudflare Worker → D1 logical binding → published PNG → edge cache.

The browser no longer needs to preload/decrypt every source bundle during a healthy launch. Encrypted bundles remain a fallback path only.

Logical asset routes used by the game:

- `card:<group>:<theme>:<member>:<grade>:<size>`
- `profile:<group>:<theme>:<member>`
- `ghost:<group>:<theme>:<member>:<size>`
- `wallpaper-alias:<alias>`

Metadata comes from `/api/theme-data` and `/api/wallpapers`; catalog version/counts come from `/api/bootstrap`.

---

# SHINING SUPERSTAR Runtime Catalog

## Goal

Do not ship encrypted source ZIP bundles to every player. Decrypt and index them once during build/deployment, then serve immutable individual images through normal static hosting/CDN caching.

## Build pipeline

1. Read `dev/2.0.0/manifest_hashes`.
2. Verify each source bundle MD5.
3. Decrypt each extensionless WinZip AES bundle with `pyzipper`.
4. Detect each extensionless image by magic bytes.
5. Write immutable content-hashed files under `dist/catalog/assets/`.
6. Merge `themeData.json`, `wallpaperData.json`, source bundle metadata, and exact extracted asset names into `runtime_manifest.json`.
7. Deploy `dist/catalog/` to the static site/CDN.

## Browser runtime

The browser loads only `runtime_manifest.json`. It resolves exact image URLs from the manifest and requests images only when a screen needs them. There is no `zip.js`, source bundle password, source bundle download, browser-side AES extraction, MD5 verification loop, or 222-bundle startup gate.

Use long-lived caching for hashed assets (`Cache-Control: public, max-age=31536000, immutable`) and short/no-cache behavior for `runtime_manifest.json`. A new image produces a new hash/URL, so old cached assets remain safe and the browser only downloads changed/new files.

## Important

A browser must still download the bytes of an image it displays. The optimization is moving *catalog processing* off the user's device and making the browser download only the final assets it actually needs.
