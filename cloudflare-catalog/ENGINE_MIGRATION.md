# Engine cut-over checklist

1. Deploy the Worker and apply `schema.sql` to D1.
2. Create/bind the R2 bucket.
3. Set `ADMIN_TOKEN` and `BUNDLE_PASSWORD` as Worker secrets.
4. Generate `catalog_import.json` with `scripts/make_catalog_import.py`.
5. POST it to `/admin/import/metadata`.
6. Ingest all registered bundles through `/admin/ingest/bundle`.
7. Confirm `/api/bootstrap` reports a non-zero `assets_count`.
8. Set `shining-catalog-api` in `index.html` or run `configureShiningCatalog(WORKER_URL)`.
9. Reload. The loader should say `CONNECTING TO CATALOG` / `SYNCING CATALOG`, not `DOWNLOADING CATALOG`.
10. Keep legacy bundles online until all screens have been tested.
