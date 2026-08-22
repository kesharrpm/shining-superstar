# SHINING SUPERSTAR — Cloudflare Internal Catalog

This is the architecture where **Cloudflare is the catalog**.

The player's browser does not download your encrypted ZIP bundles and does not keep the master catalog database. Bundles are source/import packages only.

## Storage model

- **D1**: groups, members, themes, availability, wallpapers, logical asset bindings, bundle registry.
- **R2**: encrypted source bundles plus extracted content-addressed PNG objects.
- **Worker**: catalog API + logical asset resolver + R2 streamer + admin ingestion endpoints.

A card can be addressed logically as:

`card:red_velvet:chill_kill:irene:r:large`

The browser uses:

`/a/<catalogVersion>/card%3Ared_velvet%3Achill_kill%3Airene%3Ar%3Alarge`

The Worker resolves that logical key in D1 and streams the private R2 object. The real R2 key is never required by the game.

## Player startup

1. `GET /api/bootstrap`
2. The browser receives the catalog version and group list only.
3. `GET /api/group/red_velvet` only when that group is opened.
4. Images use `/a/<version>/<logical-id>` and are loaded only when rendered.

No 222-bundle preload. No browser AES ZIP extraction. No blob URL registry.

## Admin/import flow

1. Import metadata once:
   - `themeData.json`
   - `wallpaperData.json`
   - `manifest_hashes`
2. Upload each encrypted source bundle to `/admin/ingest/bundle`.
3. The Worker saves the original bundle in R2, decrypts/extracts it, hashes PNGs, stores extracted assets in R2, and creates D1 aliases/bindings.
4. Bundle is marked `imported`.
5. Catalog version is bumped, which automatically changes public asset cache URLs.

### Secrets

Never put these into `wrangler.toml`:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put BUNDLE_PASSWORD
```

## Initial setup

```bash
npm install
npx wrangler login
npx wrangler d1 create shining-superstar-catalog
npx wrangler r2 bucket create shining-superstar-assets
```

Copy `wrangler.toml.example` to `wrangler.toml`, put the D1 database ID into it, then:

```bash
npm run db:apply:remote
npm run deploy
```

Cloudflare's current Workers binding model exposes D1 and R2 through `env`, so the Worker needs no R2/D1 API keys in its source code.

## Import metadata

Generate the admin payload:

```bash
python scripts/make_catalog_import.py \
  --theme-data qa/themeData.json \
  --wallpaper-data qa/wallpaperData.json \
  --manifest dev/2.0.0/manifest_hashes \
  --version 1 \
  --out catalog_import.json
```

Then send it to:

`POST /admin/import/metadata`

with header:

`Authorization: Bearer <ADMIN_TOKEN>`

## Import a bundle

`POST /admin/ingest/bundle`

Headers:

- `Authorization: Bearer <ADMIN_TOKEN>`
- `X-Bundle-Key: cards_red_velvet_chill_kill`
- `X-Checksum: <manifest checksum>`

Body: raw bytes of the extensionless encrypted ZIP bundle.

If the bundle was previously registered by the metadata import, its kind/group/theme come from D1 automatically.

## Browser integration

```js
import { ShiningCatalogClient } from './catalog-client.js';

const Catalog = new ShiningCatalogClient('https://catalog.example.com');
await Catalog.init();

img.src = Catalog.card({
  group: 'Red Velvet',
  theme: 'Chill Kill',
  member: 'IRENE',
  grade: 'R'
});
```

You can migrate the current engine feature-by-feature. Keep the current resolver as a fallback until the Cloudflare catalog has imported all assets.

## Important production note

The included synchronous Worker bundle importer is a good starter for small/moderate bundles. If individual bundles become large enough to hit Worker CPU/memory/request limits, keep the exact same D1/R2 runtime architecture but move only the **ingestion job** to a Cloudflare Workflow/Container or CI job. The player-facing catalog does not change.


## Current SHINING SUPERSTAR engine migration

The companion `engine.js` migration supports two runtime modes:

### Cloudflare mode
Set the Worker base URL either in `index.html`:

```html
<meta name="shining-catalog-api" content="https://YOUR-WORKER.workers.dev">
```

or once from the browser console/admin setup:

```js
configureShiningCatalog("https://YOUR-WORKER.workers.dev");
```

The value is stored in `localStorage` under `shining_catalog_api`.

At startup the game does:

1. `GET /api/bootstrap`
2. `GET /api/theme-data`
3. `GET /api/wallpapers`
4. Shows READY.
5. Card/profile/ghost/background images are requested only when rendered through `/a/<catalogVersion>/<logical binding>`.

There is no encrypted ZIP preload in this mode.

### Legacy fallback mode
If no Cloudflare URL is configured, or the Worker is unavailable/has no imported assets, the engine automatically uses the existing `manifest_hashes` + encrypted ZIP bundle flow.

Keep the old bundles available during migration. Once every catalog bundle has been imported and the Worker has been tested, the legacy browser ZIP path can be removed in a later cleanup.

## New Worker metadata endpoint

`GET /api/theme-data` reconstructs the existing `themeData.json` shape directly from D1, including:

- members
- normal themes
- LE themes
- availability type
- in-pool state

This lets the current game use Cloudflare as its metadata source without rewriting all downstream theme logic.

## Logical binding fallback

The asset streamer supports both explicit D1 bindings and legacy internal filenames.

For example:

`card:red_velvet:chill_kill:irene:r:large`

can resolve to any of these imported aliases:

- `c_l_chill_kill_irene_r`
- `c_l_chill_kill_irene`
- `c_l_red_velvet_chill_kill_irene_r`
- `c_l_red_velvet_chill_kill_irene`

This preserves compatibility with existing grade-less card assets.
