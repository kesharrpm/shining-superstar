# SHINING Catalog Studio v4.1 — Local Export Fix

This build removes the forced GitHub metadata write that previously blocked exports with HTTP 403 errors.

Current behavior:
- Pending `themeData.json` and `wallpaperData.json` edits stay in the studio/local draft until you export.
- `EXPORT UPDATE KIT` packages the current metadata, manifest, and staged bundles directly.
- No GitHub personal access token is required to export a kit.
- The exported kit includes `METADATA_SNAPSHOT.json` so you can verify what was packaged.
- GitHub publishing remains a separate, intentional step in Publish Center.
- Bundle passwords and admin tokens remain session-only and are not exported.
