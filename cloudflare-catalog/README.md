# SHINING SUPERSTAR Secure Worker (6.3)

This replaces the competing Worker variants with one canonical backend:

- D1 = catalog metadata and logical bindings
- `catalog-assets` GitHub branch = published content-addressed PNGs
- Worker = catalog resolver/cache + authenticated player action API
- Firebase Auth = player identity
- Firestore = player saves, mutated by the Worker with a service account for protected fields

There are **no payment or real-money endpoints** in this Worker. Currency is in-game state only.

## 1. Install / migrate

Copy your existing `cloudflare-catalog/wrangler.toml`, change `main` to `src/index.js`, then add the vars shown in `wrangler.toml.example`.

Run:

```bash
npm install
npx wrangler d1 execute shining-superstar-catalog --remote --file=./schema-secure.sql
```

## 2. Secrets

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

`FIREBASE_SERVICE_ACCOUNT_JSON` must be the complete Firebase/Google service-account JSON. Never put it in HTML, JS, GitHub, or `wrangler.toml`.

## 3. Deploy and test

`SECURE_ECONOMY_REQUIRED` is a rollout/status marker shown by `/health` and `/admin/status`; Firestore rules are what actually enforce trusted writes. Keep it `false` while validating the rollout, then mark it `true` when strict rules are live.

Deploy and test `/health`, `/api/bootstrap`, cards, login, and the admin validator first.

## 4. Import generated asset contracts

The Catalog Studio V5/V6 export includes `ASSET_CONTRACT.json`. After the PNGs have been published and their aliases exist in D1, POST the contract to:

`/admin/import-contract`

with `Authorization: Bearer <ADMIN_TOKEN>`.

This creates the exact logical binding instead of guessing from filenames.

## 5. Player actions

The secure client sends its Firebase ID token to `/api/player/*`. The Worker verifies it against Google's Firebase keys and uses the Firebase service account only inside Cloudflare to update protected save fields.

Protected actions include authentication bootstrap, currencies, deterministic shop/cosmetic purchases, inventory locking/selling, deck changes, coupons with deterministic rewards, eligible mission/Star Pass/event claims, inbox claims that do not generate random rewards, and server-calculated stage rewards/progress. Chance-based card grants/pulls/upgrades are intentionally left in compatibility mode rather than added to the trusted Worker.

## 6. Enforce

After the new client is verified, deploy the included strict Firestore rules. You can then change the rollout/status marker to:

```toml
SECURE_ECONOMY_REQUIRED = "true"
```

The client should no longer be able to directly change protected economy fields.
