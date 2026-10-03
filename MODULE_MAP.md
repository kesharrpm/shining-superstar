# Modular engine map

The 6.2 monolith is preserved under `legacy/` for comparison. Production `index.html` loads these classic scripts in the same source order:

| Order | File | Approximate responsibility |
|---|---|---|
| 1 | `modules/01-catalog-runtime.js` | catalog/bootstrap/asset runtime |
| 2 | `modules/02-core-ui.js` | base UI and shared client behavior |
| 3 | `modules/03-auth-inbox-missions.js` | legacy auth compatibility, inbox, missions |
| 4 | `modules/04-game-systems.js` | major game systems |
| 5 | `modules/05-ui-patches-v2-v3.js` | historical UI patches |
| 6 | `modules/06-ui-patches-v4-v6.js` | later UI patches |
| 7 | `modules/07-foundation-v42-v43.js` | foundation changes |
| 8 | `modules/08-hotfix-v51.js` | 5.1 hotfix layer |
| 9 | `modules/09-presentation-v60.js` | 6.0 presentation layer |
| 10 | `modules/10-identity-v61.js` | 6.1 identity/profile layer |
| 11 | `modules/11-arcade-v62.js` | 6.2 arcade layer |
| 12 | `modules/secure-api.js` | final Auth V3/trusted Worker bridge and protected-operation overrides |

This first split intentionally preserves execution order. The next refactor can convert these historical layers into semantic ES modules one system at a time without doing a risky all-at-once rewrite.
