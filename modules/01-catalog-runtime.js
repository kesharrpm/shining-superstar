// Firebase Setup
      const firebaseConfig = {
        apiKey: "AIzaSyBYdxaGYh5-ca0aj3UwYfpHghQTPj85ubQ",
        authDomain: "shining-superstar.firebaseapp.com",
        projectId: "shining-superstar",
        storageBucket: "shining-superstar.firebasestorage.app",
        messagingSenderId: "895630016613",
        appId: "1:895630016613:web:72cae0dad5727ae955c68c",
      };
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      const db = firebase.firestore();
      const auth = firebase.auth();

      /* AUTH V2 — Firebase Authentication owns passwords/session tokens. */
      let authUid = null;
      const AUTH_ALIAS_DOMAIN = "auth.shining-superstar.invalid";

      function normalizeHandleKey(value) {
        return String(value || "").normalize("NFKC").trim().toLowerCase();
      }

      async function sha256Hex(value) {
        const bytes = new TextEncoder().encode(String(value));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
      }

      async function authEmailForHandle(handle) {
        const key = normalizeHandleKey(handle);
        if (!key) throw new Error("Username is required.");
        const digest = await sha256Hex(`shining-superstar:${key}`);
        return `u_${digest}@${AUTH_ALIAS_DOMAIN}`;
      }

      function currentUserDocId() {
        return authUid || auth.currentUser?.uid || null;
      }

      function currentUserDocRef() {
        const id = currentUserDocId();
        return id ? db.collection("users").doc(id) : null;
      }

      function publicPlayerName() {
        return String(user?.handle || uid || "GUEST");
      }
/* ============================================================
 * CATALOG ASSET LAYER — extensionless AES ZIP bundles
 * ============================================================ */
const CATALOG_BASE_URLS = [
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/dev/2.0.0/",
  "https://kesharrpm.github.io/shining-superstar/dev/2.0.0/",
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/dev/2.0.0/"
];
const PROJECT_DATA_BASE_URLS = [
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/",
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/",
  "https://kesharrpm.github.io/shining-superstar/"
];

/* ============================================================
 * EDGE CATALOG RUNTIME — Cloudflare D1 + published PNG assets
 * Primary path. The encrypted bundle loader below is retained as
 * an emergency fallback only, so old builds/data still remain usable.
 * ============================================================ */
const CATALOG_WORKER_BASE = "https://shining-superstar.matchuchacho.workers.dev";
const CATALOG_API_TIMEOUT_MS = 12000;
const catalogRuntime = {
  mode: "legacy-bundles",
  apiHealthy: false,
  version: "current",
  bootstrap: null,
  themeData: null,
  wallpapers: null,
  imageFallbacks: new Map()
};

function catalogBindingUrl(bindingKey) {
  const version = String(catalogRuntime.version || "current");
  return `${CATALOG_WORKER_BASE}/a/${encodeURIComponent(version)}/${encodeURIComponent(String(bindingKey || ""))}`;
}

function rememberCatalogImageFallback(primaryUrl, fallbackUrl) {
  const primary = String(primaryUrl || "");
  const fallback = String(fallbackUrl || "");
  if (!primary || !fallback || primary === fallback) return primary;
  catalogRuntime.imageFallbacks.set(primary, fallback);
  return primary;
}

// If one logical asset has not been published yet, fall back per-image instead
// of breaking the whole screen or forcing a 222-bundle startup download.
document.addEventListener("error", (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.catalogFallbackUsed === "1") return;
  const fallback = catalogRuntime.imageFallbacks.get(img.src) || catalogRuntime.imageFallbacks.get(img.getAttribute("src") || "");
  if (!fallback) return;
  img.dataset.catalogFallbackUsed = "1";
  img.src = fallback;
}, true);
const BUNDLE_PASSWORD = "shiningsuperstar_admin0033";
const BOOT_FETCH_TIMEOUT_MS = 20000;
const REQUIRED_JSON_TIMEOUT_MS = 15000;
const OPTIONAL_JSON_TIMEOUT_MS = 6500;
const BUNDLE_FETCH_TIMEOUT_MS = 120000;

let manifestData = Object.create(null);
const manifestKeyIndex = Object.create(null);
const assetCache = Object.create(null);
const assetGlobalIndex = Object.create(null);
const assetGlobalCollisions = Object.create(null);
const bundleLoadPromises = Object.create(null);
const catalogObjectUrls = new Set();
const catalogMissingWarnings = new Set();
let wallpaperDatabase = [];
let lobbyBanners = [];

const bootState = {
  ready: false,
  started: false,
  failed: false,
  phase: "boot",
  error: null,
  catalog: { totalBundles: 0, loadedBundles: 0, failedBundles: 0, assets: 0, verifiedBundles: 0, cacheHits: 0, networkBundles: 0 }
};
window.__SHINING_BOOT__ = bootState;

/* Persistent catalog cache. IndexedDB is used instead of localStorage because
 * encrypted bundles / PNG blobs are binary and can easily exceed localStorage limits.
 * The key includes the manifest checksum, so updated bundles automatically miss cache. */
const CATALOG_CACHE_DB_NAME = "shining-superstar-catalog";
const CATALOG_CACHE_DB_VERSION = 1;
const CATALOG_CACHE_STORE = "bundleAssets";
let catalogCacheDbPromise = null;
let catalogCacheSessionDisabled = false;
const catalogCachePendingWrites = new Set();

function catalogCacheKey(fileInfo) {
  const file = String(fileInfo?.file || "");
  const hash = String(fileInfo?.md5_checksum || fileInfo?.md5 || fileInfo?.hash || fileInfo?.sha256 || "nohash").toLowerCase();
  return `${file}::${hash}`;
}

function openCatalogCacheDb() {
  if (catalogCacheSessionDisabled || !("indexedDB" in window)) return Promise.resolve(null);
  if (catalogCacheDbPromise) return catalogCacheDbPromise;
  catalogCacheDbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(CATALOG_CACHE_DB_NAME, CATALOG_CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CATALOG_CACHE_STORE)) {
          const store = db.createObjectStore(CATALOG_CACHE_STORE, { keyPath: "id" });
          store.createIndex("savedAt", "savedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.info("[Catalog Cache] IndexedDB unavailable; using network cache only.", request.error);
        catalogCacheSessionDisabled = true;
        resolve(null);
      };
      request.onblocked = () => console.info("[Catalog Cache] Database upgrade is blocked by another tab.");
    } catch (error) {
      console.info("[Catalog Cache] Could not open persistent cache.", error);
      catalogCacheSessionDisabled = true;
      resolve(null);
    }
  });
  return catalogCacheDbPromise;
}

async function getCachedBundleRecord(fileInfo) {
  const db = await openCatalogCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CATALOG_CACHE_STORE, "readonly");
      const req = tx.objectStore(CATALOG_CACHE_STORE).get(catalogCacheKey(fileInfo));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}

async function deleteCachedBundleRecord(fileInfo) {
  const db = await openCatalogCacheDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(CATALOG_CACHE_STORE, "readwrite");
      tx.objectStore(CATALOG_CACHE_STORE).delete(catalogCacheKey(fileInfo));
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    } catch (_) { resolve(); }
  });
}

async function writeCachedBundleRecord(manifestKey, fileInfo, entries) {
  const db = await openCatalogCacheDb();
  if (!db || !Array.isArray(entries) || !entries.length) return;
  const size = entries.reduce((sum, item) => sum + (item?.blob?.size || 0), 0);
  const record = {
    id: catalogCacheKey(fileInfo),
    manifestKey,
    file: fileInfo.file,
    hash: String(fileInfo.md5_checksum || fileInfo.md5 || fileInfo.hash || fileInfo.sha256 || ""),
    entries,
    size,
    savedAt: Date.now()
  };
  await new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(CATALOG_CACHE_STORE, "readwrite");
      tx.objectStore(CATALOG_CACHE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Catalog cache write failed"));
    } catch (error) { reject(error); }
  });
}

function queueCachedBundleWrite(manifestKey, fileInfo, entries) {
  if (catalogCacheSessionDisabled) return;
  const task = writeCachedBundleRecord(manifestKey, fileInfo, entries)
    .catch((error) => {
      if (error?.name === "QuotaExceededError") {
        catalogCacheSessionDisabled = true;
        console.info("[Catalog Cache] Browser storage quota reached; continuing without new persistent writes.");
      } else {
        console.info(`[Catalog Cache] Could not persist ${manifestKey}; continuing normally.`, error);
      }
    })
    .finally(() => catalogCachePendingWrites.delete(task));
  catalogCachePendingWrites.add(task);
}

async function pruneCatalogCache() {
  const db = await openCatalogCacheDb();
  if (!db) return;
  const valid = new Set(Object.values(manifestData).map(catalogCacheKey));
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(CATALOG_CACHE_STORE, "readwrite");
      const store = tx.objectStore(CATALOG_CACHE_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (!valid.has(cursor.key)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    } catch (_) { resolve(); }
  });
}

async function clearPersistentCatalogCache() {
  const db = await openCatalogCacheDb();
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(CATALOG_CACHE_STORE, "readwrite");
        tx.objectStore(CATALOG_CACHE_STORE).clear();
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch (_) { resolve(); }
    });
  }
  try { showToast?.("Asset cache cleared. Bundles will download again next launch."); } catch (_) {}
  const status = document.getElementById("catalog-cache-status");
  if (status) status.textContent = "Cache cleared · rebuilds next launch";
}
window.clearPersistentCatalogCache = clearPersistentCatalogCache;

function getStoredNumber(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = BOOT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonSafe(url, { required = false, label = "resource", timeoutMs = BOOT_FETCH_TIMEOUT_MS, quiet = false } = {}) {
  try {
    const response = await fetchWithTimeout(url, { cache: "no-cache" }, timeoutMs);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (!quiet) console.warn(`[Boot] ${label} failed: ${url}`, error);
    if (required) throw new Error(`${label} could not be loaded`, { cause: error });
    return null;
  }
}

async function fetchProjectJson(path, { required = false, label = path, timeoutMs = null } = {}) {
  const errors = [];
  const timeout = timeoutMs ?? (required ? REQUIRED_JSON_TIMEOUT_MS : OPTIONAL_JSON_TIMEOUT_MS);
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const cacheToken = Date.now();
  for (const baseUrl of PROJECT_DATA_BASE_URLS) {
    const url = `${baseUrl}${cleanPath}?v=${cacheToken}`;
    try {
      const response = await fetchWithTimeout(url, { cache: "no-cache" }, timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.info(`[Boot] ${label} loaded from ${new URL(baseUrl).hostname}`);
      return data;
    } catch (error) {
      errors.push(`${new URL(baseUrl).hostname}: ${error?.name === "AbortError" ? "timeout" : error?.message || error}`);
    }
  }
  const summary = errors.join(" | ");
  if (required) throw new Error(`${label} could not be loaded from any source. ${summary}`);
  console.info(`[Boot] Optional ${label} unavailable; continuing without it. ${summary}`);
  return null;
}


async function fetchCatalogApiJson(path, { timeoutMs = CATALOG_API_TIMEOUT_MS } = {}) {
  const clean = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  const joiner = clean.includes("?") ? "&" : "?";
  const response = await fetchWithTimeout(`${CATALOG_WORKER_BASE}${clean}${joiner}v=${Date.now()}`, {
    cache: "no-store",
    headers: { "accept": "application/json" }
  }, timeoutMs);
  if (!response.ok) throw new Error(`${clean}: HTTP ${response.status}`);
  return response.json();
}

function normalizeApiWallpaperRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const legacyUrl = String(row.legacy_url || row.legacyUrl || row.url || "");
    let alias = String(row.source_alias || row.sourceAlias || "");
    if (!alias && legacyUrl) {
      try { alias = assetBasename(new URL(legacyUrl, document.baseURI).pathname); }
      catch (_) { alias = assetBasename(legacyUrl); }
    }
    const hasPublishedAsset = Boolean(row.asset_id || row.assetId || row.catalogAsset);
    const edgeUrl = alias && hasPublishedAsset ? catalogBindingUrl(`wallpaper-alias:${normalizeAssetName(alias)}`) : legacyUrl;
    if (edgeUrl && legacyUrl && edgeUrl !== legacyUrl) rememberCatalogImageFallback(edgeUrl, legacyUrl);
    return {
      ...row,
      group: row.group || row.group_name || "",
      group_name: row.group_name || row.group || "",
      legacyUrl: legacyUrl || null,
      sourceAlias: alias || null,
      url: edgeUrl || legacyUrl,
      catalogAsset: Boolean(edgeUrl && alias)
    };
  });
}

async function loadEdgeCatalog() {
  const [bootstrap, themePayload, wallpaperPayload] = await Promise.all([
    fetchCatalogApiJson("/api/bootstrap"),
    fetchCatalogApiJson("/api/theme-data"),
    fetchCatalogApiJson("/api/wallpapers")
  ]);

  const themeData = themePayload?.themeData && typeof themePayload.themeData === "object"
    ? themePayload.themeData
    : (themePayload && typeof themePayload === "object" ? themePayload : {});
  const wallpaperRows = Array.isArray(wallpaperPayload?.wallpapers)
    ? wallpaperPayload.wallpapers
    : (Array.isArray(wallpaperPayload) ? wallpaperPayload : []);

  if (!Object.keys(themeData).length) throw new Error("Cloudflare theme database is empty");
  if (!wallpaperRows.length) console.info("[Catalog API] Wallpaper database is empty; continuing.");

  catalogRuntime.mode = "edge-api";
  catalogRuntime.apiHealthy = true;
  catalogRuntime.version = String(bootstrap?.version || "current");
  catalogRuntime.bootstrap = bootstrap || {};
  catalogRuntime.themeData = themeData;
  catalogRuntime.wallpapers = wallpaperRows;

  const counts = bootstrap?.counts || {};
  bootState.catalog.totalBundles = Number(counts.bundles_count || 0);
  bootState.catalog.loadedBundles = 0;
  bootState.catalog.failedBundles = 0;
  bootState.catalog.assets = Number(counts.assets_count || 0);
  bootState.catalog.verifiedBundles = 0;
  bootState.catalog.cacheHits = 0;
  bootState.catalog.networkBundles = 0;

  console.info(`[Catalog API] Connected · v${catalogRuntime.version} · ${bootState.catalog.assets} published assets`);
  return { bootstrap, themeData, wallpaperRows };
}

function buildProfilePictureDatabase() {
  profilePicDatabase = [];
  for (const [groupName, groupData] of Object.entries(themeDatabase || {})) {
    if (!Array.isArray(groupData?.members)) continue;
    const themes = [...(groupData.themes || []), ...(groupData.le_themes || [])];
    for (const theme of themes) {
      const rawType = groupData.availability?.[theme]?.type ?? "FREE";
      const classification = String(rawType || "FREE").toUpperCase();
      const profileBundleKey = catalogRuntime.apiHealthy ? null : resolveManifestKey(themeBundleCandidates("profile", groupName, theme));
      for (const memberName of groupData.members) {
        profilePicDatabase.push({
          id: `${pySlug(groupName)}_${pySlug(memberName)}_${pySlug(theme)}`,
          group: String(groupName).toUpperCase(),
          groupName,
          member: memberName,
          theme,
          assetKey: `p_${pySlug(theme)}_${pySlug(memberName)}`,
          bundleKey: profileBundleKey,
          basePath: `c_l_${pySlug(theme)}_${pySlug(memberName)}`,
          type: classification
        });
      }
    }
  }
}

function catalogApiStatusText() {
  if (!catalogRuntime.apiHealthy) return "Encrypted bundle fallback";
  const counts = catalogRuntime.bootstrap?.counts || {};
  return `${Number(counts.assets_count || 0).toLocaleString()} edge assets · ${Number(counts.groups_count || Object.keys(themeDatabase || {}).length).toLocaleString()} groups`;
}

async function loadOptionalGameData() {
  const [p, u, d, n, b] = await Promise.all([
    fetchProjectJson("dev/cardGotcha.json", { label: "Card pool" }),
    fetchProjectJson("qa/cardURLs.json", { label: "Card URL data" }),
    fetchProjectJson("qa/dataURLs.json", { label: "Card metadata" }),
    fetchProjectJson("dev/notices.json", { label: "Notice data" }),
    fetchProjectJson("dev/bannerData.json", { label: "Banner data" })
  ]);
  if (p && typeof p === "object") poolData = p;
  if (Array.isArray(u)) urlData = u;
  if (d && typeof d === "object") cardMap = d;
  if (Array.isArray(n)) noticeDatabase = n;
  if (Array.isArray(b)) {
    lobbyBanners = b;
    try { initLobbyBanner?.(); } catch (_) {}
  }
  window.dispatchEvent(new CustomEvent("shining:optional-data-ready"));
}

function setLoadingState(status, detail = null, percent = null) {
  const statusEl = document.getElementById("loading-status");
  const detailEl = document.getElementById("loading-detail");
  const percentEl = document.getElementById("loading-percent");
  const fillEl = document.getElementById("loading-bar-fill");
  if (statusEl && status) statusEl.textContent = status;
  if (detailEl && detail !== null) detailEl.textContent = detail;
  if (percentEl && Number.isFinite(percent)) {
    percentEl.textContent = String(Math.max(0, Math.min(100, Math.round(percent))));
  }
  if (fillEl && Number.isFinite(percent)) {
    fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function hideInstantWaitScreen() {
  const instant = document.getElementById("instant-wait-screen");
  if (!instant) return;
  instant.style.opacity = "0";
  instant.style.pointerEvents = "none";
  setTimeout(() => instant.remove(), 450);
}

function hideModernLoadingScreen() {
  const modern = document.getElementById("modern-loading-screen");
  if (!modern) return;
  modern.setAttribute("aria-busy", "false");
  modern.classList.add("is-leaving");
  setTimeout(() => modern.classList.add("is-hidden"), 520);
}

function startGameFromLoader() {
  if (!bootState.ready || bootState.failed || bootState.started) return;
  bootState.started = true;
  hideModernLoadingScreen();
  const bgm = document.getElementById("bgm");
  if (bgm && globalBgmVolume > 0) {
    bgm.volume = Math.max(0, Math.min(1, globalBgmVolume));
    bgm.play().catch(() => {});
  }
  document.body?.classList.add("game-started");
  try { spawnLobbySparkles?.(); } catch (_) {}
  window.dispatchEvent(new CustomEvent("shining:started"));
}
window.startGameFromLoader = startGameFromLoader;

function armStartGate() {
  const modern = document.getElementById("modern-loading-screen");
  const prompt = document.getElementById("touch-to-start-text");
  if (prompt) {
    prompt.textContent = "TOUCH TO START";
    prompt.style.display = "block";
    prompt.onclick = (event) => {
      event.stopPropagation();
      startGameFromLoader();
    };
  }
  if (modern) {
    modern.classList.remove("has-error");
    modern.setAttribute("aria-busy", "false");
    modern.onclick = () => startGameFromLoader();
  }
}

function reportBootFailure(message, error = null) {
  bootState.ready = false;
  bootState.failed = true;
  bootState.error = error || new Error(message);
  const modern = document.getElementById("modern-loading-screen");
  const prompt = document.getElementById("touch-to-start-text");
  modern?.classList.add("has-error");
  setLoadingState("STARTUP FAILED", message, null);
  if (prompt) {
    prompt.textContent = "RETRY";
    prompt.style.display = "block";
    prompt.onclick = (event) => {
      event.stopPropagation();
      location.reload();
    };
  }
  if (modern) modern.onclick = () => location.reload();
  console.error("[Boot] Fatal startup failure:", message, error || "");
}

function withLoadingCircle(action, options = {}) {
  const overlay = document.getElementById("global-processing-overlay");
  const reduced = isReduceTrans || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const threshold = reduced ? 0 : Math.max(0, Number(options.delay ?? 140));
  let overlayTimer = null;
  let overlayShown = false;
  try { playClickSound?.(); } catch (_) {}

  const showOverlay = () => {
    if (!overlay || overlayShown) return;
    overlayShown = true;
    overlay.style.display = "flex";
    requestAnimationFrame(() => { overlay.style.opacity = "1"; });
  };
  const hideOverlay = () => {
    if (overlayTimer) clearTimeout(overlayTimer);
    if (!overlay || !overlayShown) return;
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; }, reduced ? 0 : 150);
  };

  const run = async () => {
    try {
      // Run immediately. Only show the spinner if the returned promise is still
      // pending after the threshold; instant modal/navigation actions stay instant.
      const result = action?.();
      if (result && typeof result.then === "function") {
        if (options.force === true) showOverlay();
        else if (threshold > 0) overlayTimer = setTimeout(showOverlay, threshold);
        else showOverlay();
        return await result;
      }
      return result;
    } catch (error) {
      console.error("[UI Action]", error);
      try { showToast?.("Something went wrong. Please try again."); } catch (_) {}
      return undefined;
    } finally {
      hideOverlay();
    }
  };
  return run();
}
window.withLoadingCircle = withLoadingCircle;

let premiumInteractionsReady = false;
function initPremiumInteractions() {
  if (premiumInteractionsReady) return;
  premiumInteractionsReady = true;
  document.body?.classList.add("ui-polished");
  const interactiveSelector = "button, .btn, .hud-nav-btn, .hud-profile-card, .hud-side-btn, .hud-event-banner, .shop-tab";

  document.addEventListener("pointermove", (event) => {
    const target = event.target.closest?.(interactiveSelector);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }, { passive: true });

  document.addEventListener("pointerdown", (event) => {
    if (!visualEffectsEnabled || isReduceTrans) return;
    const target = event.target.closest?.(interactiveSelector);
    if (!target || target.matches("input, select, textarea")) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ui-ripple";
    const size = Math.max(rect.width, rect.height) * 1.35;
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }, { passive: true });
}

function normalizeManifestKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeAssetName(value) {
  let text = String(value ?? "").trim().replace(/\\/g, "/");
  try { text = decodeURIComponent(text); } catch (_) {}
  text = text.split("?")[0].split("#")[0];
  text = text.replace(/^\.\//, "").replace(/^\/+/, "");
  text = text.replace(/^images\//i, "");
  text = text.replace(/\.(png|webp|jpe?g|gif|avif)$/i, "");
  return text.toLowerCase();
}

function assetBasename(value) {
  const normalized = normalizeAssetName(value);
  return normalized.split("/").pop() || normalized;
}

function pySlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rebuildManifestIndex() {
  for (const key of Object.keys(manifestKeyIndex)) delete manifestKeyIndex[key];
  for (const key of Object.keys(manifestData)) manifestKeyIndex[normalizeManifestKey(key)] = key;
}

function resolveManifestKey(...candidateGroups) {
  const candidates = candidateGroups.flat(Infinity).filter(Boolean);
  for (const candidate of candidates) {
    const actual = manifestKeyIndex[normalizeManifestKey(candidate)];
    if (actual) return actual;
  }
  return null;
}

function themeBundleCandidates(kind, group, theme) {
  const base = `${kind}_${pySlug(group)}_${pySlug(theme)}`;
  return [`${base}_le`, base];
}

function isLimitedTheme(group, theme) {
  const groupSlug = pySlug(group);
  const themeSlug = pySlug(theme);
  if (!themeSlug) return false;

  // The manifest is the strongest signal because it reflects the actual bundle layout.
  if (manifestKeyIndex[normalizeManifestKey(`cards_${groupSlug}_${themeSlug}_le`)] ||
      manifestKeyIndex[normalizeManifestKey(`profile_${groupSlug}_${themeSlug}_le`)]) return true;

  // themeData is the semantic signal. EVENT does not automatically mean LE.
  const groupEntry = Object.entries(themeDatabase || {}).find(([name]) => pySlug(name) === groupSlug);
  const data = groupEntry?.[1];
  if (!data) return false;
  if ((data.le_themes || []).some((name) => pySlug(name) === themeSlug)) return true;
  const availabilityKey = Object.keys(data.availability || {}).find((name) => pySlug(name) === themeSlug);
  const availability = availabilityKey ? data.availability[availabilityKey] : null;
  return availability?.in_pool === "le" || /LIMITED|LE/i.test(String(availability?.type || ""));
}
window.isLimitedTheme = isLimitedTheme;

function registerGlobalAsset(alias, url) {
  const key = normalizeAssetName(alias);
  if (!key) return;
  const basename = assetBasename(key);
  for (const candidate of new Set([key, basename])) {
    const existing = assetGlobalIndex[candidate];
    if (!existing) assetGlobalIndex[candidate] = url;
    else if (existing !== url) assetGlobalCollisions[candidate] = true;
  }
}

function lookupGlobalAsset(candidate) {
  const key = normalizeAssetName(candidate);
  if (!key) return null;
  for (const alias of [key, assetBasename(key)]) {
    if (!assetGlobalCollisions[alias] && assetGlobalIndex[alias]) return assetGlobalIndex[alias];
  }
  return null;
}

function resolveCatalogAsset(bundleCandidates, assetCandidates) {
  const names = assetCandidates.flat(Infinity).filter(Boolean).map(normalizeAssetName);
  const bundleKey = resolveManifestKey(bundleCandidates);
  if (bundleKey && assetCache[bundleKey]) {
    const assets = assetCache[bundleKey];
    for (const name of names) {
      if (assets[name]) return assets[name];
      const base = assetBasename(name);
      if (assets[base]) return assets[base];
    }
  }
  for (const name of names) {
    const globalHit = lookupGlobalAsset(name);
    if (globalHit) return globalHit;
  }
  return null;
}

function warnMissingCatalogAsset(kind, detail) {
  const key = `${kind}:${detail}`;
  if (catalogMissingWarnings.has(key)) return;
  catalogMissingWarnings.add(key);
  console.warn(`[Catalog] Missing ${kind}: ${detail}`);
}

function legacyOrBlankAsset(fullUrl, label = "ASSET") {
  const value = String(fullUrl ?? "").trim();
  if (/^(blob:|data:|https?:\/\/)/i.test(value) && value !== "dynamic") return value;
  const safeLabel = encodeURIComponent(String(label).slice(0, 20));
  return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='700'%3E%3Crect width='100%25' height='100%25' fill='%23090910'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%238b93a7' font-family='sans-serif' font-size='26'%3E${safeLabel}%3C/text%3E%3C/svg%3E`;
}

function md5ArrayBuffer(buffer) {
  const input = new Uint8Array(buffer);
  const originalLength = input.length;
  const paddedLength = (((originalLength + 8) >>> 6) + 1) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[originalLength] = 0x80;
  const bitLengthLow = (originalLength << 3) >>> 0;
  const bitLengthHigh = Math.floor(originalLength / 0x20000000) >>> 0;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, bitLengthLow, true);
  view.setUint32(paddedLength - 4, bitLengthHigh, true);

  const shifts = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
  ];
  const constants = new Uint32Array(64);
  for (let i = 0; i < 64; i++) constants[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  const rotateLeft = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(16);
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const sum = (a + f + constants[i] + words[g]) >>> 0;
      const nextD = d;
      d = c;
      c = b;
      b = (b + rotateLeft(sum, shifts[i])) >>> 0;
      a = nextD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const toLittleHex = (value) => [0, 8, 16, 24]
    .map((shift) => ((value >>> shift) & 0xff).toString(16).padStart(2, "0"))
    .join("");
  return toLittleHex(a0) + toLittleHex(b0) + toLittleHex(c0) + toLittleHex(d0);
}

async function fetchManifest() {
  const errors = [];
  for (const baseUrl of CATALOG_BASE_URLS) {
    try {
      setLoadingState("LOADING CATALOG", `Manifest · ${new URL(baseUrl).hostname}`, 2);
      const response = await fetchWithTimeout(`${baseUrl}manifest_hashes?v=${Date.now()}`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      const candidate = raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw.bundles || raw.files || raw)
        : null;
      if (!candidate || typeof candidate !== "object" || !Object.keys(candidate).length) {
        throw new Error("Manifest is empty or unsupported");
      }
      for (const [key, info] of Object.entries(candidate)) {
        if (!info || typeof info !== "object" || !info.file) throw new Error(`Invalid manifest entry: ${key}`);
      }
      manifestData = candidate;
      rebuildManifestIndex();
      bootState.catalog.totalBundles = Object.keys(manifestData).length;
      console.log(`[Catalog] Manifest loaded from ${baseUrl}:`, bootState.catalog.totalBundles, "bundles");
      queueMicrotask(() => pruneCatalogCache().catch(() => {}));
      return true;
    } catch (error) {
      errors.push(`${baseUrl}: ${error.message}`);
      console.warn(`[Catalog] Manifest source failed: ${baseUrl}`, error);
    }
  }
  manifestData = Object.create(null);
  rebuildManifestIndex();
  throw new Error(`Catalog manifest could not be loaded. ${errors.join(" | ")}`);
}

async function downloadBundleBlob(manifestKey, fileInfo, onProgress) {
  const version = encodeURIComponent(fileInfo.md5_checksum || fileInfo.md5 || fileInfo.hash || fileInfo.sha256 || "1");
  const errors = [];
  for (const baseUrl of CATALOG_BASE_URLS) {
    const url = `${baseUrl}${encodeURIComponent(fileInfo.file)}?v=${version}`;
    try {
      onProgress?.({ type: "download-start", key: manifestKey, source: baseUrl });
      const response = await fetchWithTimeout(url, { cache: "force-cache" }, BUNDLE_FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      let blob;
      if (response.body && contentLength > 0) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          onProgress?.({ type: "download-progress", key: manifestKey, loaded: received, total: contentLength, percent: Math.min(1, received / contentLength) });
        }
        blob = new Blob(chunks, { type: "application/zip" });
      } else {
        blob = await response.blob();
        onProgress?.({ type: "download-progress", key: manifestKey, loaded: blob.size, total: blob.size, percent: 1 });
      }
      if (blob.size < 4) throw new Error("Downloaded bundle is empty");
      const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("Downloaded file is not a ZIP container");

      const expectedMd5 = String(fileInfo.md5_checksum || fileInfo.md5 || "").trim().toLowerCase();
      if (/^[a-f0-9]{32}$/.test(expectedMd5)) {
        onProgress?.({ type: "verify-start", key: manifestKey });
        const actualMd5 = md5ArrayBuffer(await blob.arrayBuffer());
        if (actualMd5 !== expectedMd5) throw new Error(`MD5 mismatch (expected ${expectedMd5}, got ${actualMd5})`);
        onProgress?.({ type: "verify-complete", key: manifestKey });
      }
      return blob;
    } catch (error) {
      errors.push(`${new URL(baseUrl).hostname}: ${error.message}`);
      console.warn(`[Catalog] Bundle source failed for ${manifestKey}: ${baseUrl}`, error);
    }
  }
  throw new Error(`All bundle sources failed for ${manifestKey}: ${errors.join(" | ")}`);
}

async function loadBundle(requestedKey, onProgress = null) {
  const manifestKey = resolveManifestKey(requestedKey);
  if (!manifestKey) {
    const error = new Error(`Missing manifest entry: ${requestedKey}`);
    onProgress?.({ type: "error", key: requestedKey, error });
    console.warn("[Catalog]", error.message);
    return null;
  }
  if (assetCache[manifestKey]) return assetCache[manifestKey];
  if (bundleLoadPromises[manifestKey]) return bundleLoadPromises[manifestKey];

  const task = (async () => {
    const fileInfo = manifestData[manifestKey];
    let reader = null;
    try {
      // Persistent cache stores the already-decrypted PNG blobs. On repeat launches
      // we skip BOTH the network download and AES unzip for unchanged bundles.
      const cached = await getCachedBundleRecord(fileInfo);
      if (cached?.entries?.length) {
        try {
          const assets = Object.create(null);
          onProgress?.({ type: "cache-hit", key: manifestKey, total: cached.entries.length });
          for (let i = 0; i < cached.entries.length; i++) {
            const item = cached.entries[i];
            const normalized = normalizeAssetName(item?.name);
            const blob = item?.blob;
            if (!normalized || !(blob instanceof Blob) || blob.size < 1) throw new Error("Cached asset record is invalid");
            const basename = assetBasename(normalized);
            const objectUrl = URL.createObjectURL(blob);
            catalogObjectUrls.add(objectUrl);
            assets[normalized] = objectUrl;
            assets[basename] = objectUrl;
            registerGlobalAsset(normalized, objectUrl);
            bootState.catalog.assets++;
            onProgress?.({ type: "cache-restore-progress", key: manifestKey, current: i + 1, total: cached.entries.length, percent: (i + 1) / cached.entries.length, asset: normalized });
          }
          assetCache[manifestKey] = assets;
          bootState.catalog.loadedBundles++;
          bootState.catalog.cacheHits++;
          if (fileInfo.md5_checksum || fileInfo.md5) bootState.catalog.verifiedBundles++;
          onProgress?.({ type: "complete", key: manifestKey, cached: true });
          return assets;
        } catch (cacheError) {
          console.info(`[Catalog Cache] ${manifestKey} cache entry was unusable; refreshing it.`, cacheError);
          await deleteCachedBundleRecord(fileInfo);
        }
      }

      const blob = await downloadBundleBlob(manifestKey, fileInfo, onProgress);
      bootState.catalog.networkBundles++;
      onProgress?.({ type: "unpack-start", key: manifestKey });
      if (!window.zip?.ZipReader || !window.zip?.BlobReader || !window.zip?.BlobWriter) {
        throw new Error("zip.js did not load");
      }
      reader = new zip.ZipReader(new zip.BlobReader(blob));
      const entries = await reader.getEntries();
      const files = entries.filter((entry) => !entry.directory);
      if (!files.length) throw new Error("ZIP bundle contains no files");
      const assets = Object.create(null);
      const persistentEntries = [];

      for (let i = 0; i < files.length; i++) {
        const entry = files[i];
        const normalized = normalizeAssetName(entry.filename);
        const basename = assetBasename(normalized);
        if (!normalized) continue;
        let assetBlob;
        try {
          assetBlob = await entry.getData(new zip.BlobWriter("image/png"), {
            password: BUNDLE_PASSWORD,
            checkSignature: true
          });
        } catch (error) {
          throw new Error(`Could not decrypt ${entry.filename} in ${manifestKey}: ${error.message}`, { cause: error });
        }
        const objectUrl = URL.createObjectURL(assetBlob);
        catalogObjectUrls.add(objectUrl);
        assets[normalized] = objectUrl;
        assets[basename] = objectUrl;
        persistentEntries.push({ name: normalized, blob: assetBlob });
        registerGlobalAsset(normalized, objectUrl);
        bootState.catalog.assets++;
        onProgress?.({ type: "unpack-progress", key: manifestKey, current: i + 1, total: files.length, percent: (i + 1) / files.length, asset: normalized });
      }

      assetCache[manifestKey] = assets;
      if (fileInfo.md5_checksum || fileInfo.md5) bootState.catalog.verifiedBundles++;
      bootState.catalog.loadedBundles++;
      queueCachedBundleWrite(manifestKey, fileInfo, persistentEntries);
      onProgress?.({ type: "complete", key: manifestKey, cached: false });
      return assets;
    } catch (error) {
      console.error(`[Catalog] Bundle failed: ${manifestKey}`, error);
      onProgress?.({ type: "error", key: manifestKey, error });
      return null;
    } finally {
      if (reader) {
        try { await reader.close(); } catch (_) {}
      }
    }
  })();

  bundleLoadPromises[manifestKey] = task;
  try {
    return await task;
  } finally {
    delete bundleLoadPromises[manifestKey];
  }
}

async function preloadAllBundles() {
  const keys = Object.keys(manifestData);
  if (!keys.length) throw new Error("Manifest contains no bundles");
  bootState.phase = "catalog";
  bootState.catalog.totalBundles = keys.length;
  bootState.catalog.loadedBundles = 0;
  bootState.catalog.failedBundles = 0;
  bootState.catalog.assets = 0;
  bootState.catalog.verifiedBundles = 0;
  bootState.catalog.cacheHits = 0;
  bootState.catalog.networkBundles = 0;

  const progress = new Array(keys.length).fill(0);
  const failed = [];
  const update = (status = "LOADING ASSETS") => {
    const overall = progress.reduce((a, b) => a + b, 0) / keys.length;
    const finished = progress.filter((value) => value >= 1).length;
    const cacheNote = bootState.catalog.cacheHits ? ` · ${bootState.catalog.cacheHits} cached` : "";
    setLoadingState(status, `${finished} / ${keys.length} bundles · ${bootState.catalog.assets} assets${cacheNote}`, Math.min(99, overall * 94 + 3));
  };

  let nextIndex = 0;
  const deviceMemory = Number(navigator.deviceMemory || 4);
  const concurrency = Math.max(2, Math.min(deviceMemory <= 2 ? 2 : 4, keys.length));

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= keys.length) return;
      const key = keys[index];
      const result = await loadBundle(key, (event) => {
        if (event.type === "cache-hit") {
          progress[index] = Math.max(progress[index], 0.76);
          setLoadingState("RESTORING CACHED ASSETS", `${key} · local cache`, null);
        } else if (event.type === "cache-restore-progress") {
          progress[index] = Math.max(progress[index], 0.76 + event.percent * 0.24);
        } else if (event.type === "download-start") {
          setLoadingState("DOWNLOADING CATALOG", `${key} · ${index + 1}/${keys.length}`, null);
        } else if (event.type === "download-progress") {
          progress[index] = Math.max(progress[index], event.percent * 0.68);
        } else if (event.type === "verify-start") {
          progress[index] = Math.max(progress[index], 0.68);
          setLoadingState("VERIFYING CATALOG", `${key} · MD5`, null);
        } else if (event.type === "verify-complete") {
          progress[index] = Math.max(progress[index], 0.74);
        } else if (event.type === "unpack-start") {
          progress[index] = Math.max(progress[index], 0.74);
          setLoadingState("DECRYPTING ASSETS", `${key} · password protected ZIP`, null);
        } else if (event.type === "unpack-progress") {
          progress[index] = Math.max(progress[index], 0.74 + event.percent * 0.26);
        } else if (event.type === "complete") {
          progress[index] = 1;
        }
        update();
      });
      if (!result) {
        failed.push(key);
        progress[index] = Math.min(progress[index], 0.95);
      } else {
        progress[index] = 1;
      }
      update();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  bootState.catalog.failedBundles = failed.length;
  if (failed.length) {
    throw new Error(`${failed.length} catalog bundle${failed.length === 1 ? "" : "s"} failed: ${failed.slice(0, 4).join(", ")}${failed.length > 4 ? "…" : ""}`);
  }
  setLoadingState("CATALOG READY", `${bootState.catalog.cacheHits} cached · ${bootState.catalog.networkBundles} downloaded · ${bootState.catalog.assets} assets`, 97);
  const cacheStatus = document.getElementById("catalog-cache-status");
  if (cacheStatus) {
    cacheStatus.textContent = bootState.catalog.cacheHits
      ? `${bootState.catalog.cacheHits} bundles restored locally this launch`
      : "Persistent cache ready · fills after first launch";
  }
  return { total: keys.length, failed: 0, assets: bootState.catalog.assets };
}

function normalizeFrameGrade(grade) {
  const text = String(grade ?? "C").trim().toUpperCase();
  if (["R", "S", "A", "B", "C"].includes(text)) return text.toLowerCase();
  const numeric = Number(grade);
  if (Number.isFinite(numeric)) {
    if (numeric >= 5) return "r";
    if (numeric === 4) return "s";
    if (numeric === 3) return "a";
    if (numeric === 2) return "b";
  }
  return "c";
}

function getCardCatalogUrl(size, fullUrl, grade, member, theme, group) {
  const gradeSlug = normalizeFrameGrade(grade);
  const groupSlug = pySlug(group);
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);

  if (catalogRuntime.apiHealthy && groupSlug && themeSlug && memberSlug) {
    const workerUrl = catalogBindingUrl(`card:${groupSlug}:${themeSlug}:${memberSlug}:${gradeSlug}:${size === "small" ? "small" : "large"}`);
    const fallback = legacyOrBlankAsset(fullUrl, `${grade || "?"} CARD`);
    return rememberCatalogImageFallback(workerUrl, fallback);
  }

  const bundleCandidates = themeBundleCandidates("cards", group, theme);
  const prefix = size === "small" ? "c_s" : "c_l";
  const candidates = [
    `${prefix}_${themeSlug}_${memberSlug}_${gradeSlug}`,
    `${prefix}_${themeSlug}_${memberSlug}`,
    `${prefix}_${groupSlug}_${themeSlug}_${memberSlug}_${gradeSlug}`
  ];
  const hit = resolveCatalogAsset(bundleCandidates, candidates);
  if (hit) return hit;
  if (!bootState.ready) return legacyOrBlankAsset("", `${grade || "?"} CARD`);
  warnMissingCatalogAsset("card", `${group}/${theme}/${member}/${grade}/${size}`);
  return legacyOrBlankAsset(fullUrl, `${grade || "?"} CARD`);
}

function getLargeCardUrl(fullUrl, grade, member, theme, group) {
  return getCardCatalogUrl("large", fullUrl, grade, member, theme, group);
}

function getSmallCardUrl(fullUrl, grade, member, theme, group) {
  return getCardCatalogUrl("small", fullUrl, grade, member, theme, group);
}

function getProfilePicUrl(baseImgPath) {
  const raw = String(baseImgPath ?? "").split("@@").pop();
  const normalized = normalizeAssetName(raw);
  if (catalogRuntime.apiHealthy && Array.isArray(profilePicDatabase)) {
    const pfp = profilePicDatabase.find((item) => normalizeAssetName(item?.basePath) === normalized);
    if (pfp) return getCatalogProfilePicUrl(pfp.groupName || pfp.group, pfp.member, pfp.theme);
  }
  const filename = assetBasename(raw);
  const stem = filename.replace(/^c_[ls]_/, "");
  const candidates = [`p_${stem}`, `profile_${stem}`, stem];
  const hit = resolveCatalogAsset([], candidates);
  if (hit) return hit;
  warnMissingCatalogAsset("profile", stem || String(baseImgPath));
  return legacyOrBlankAsset("", "PROFILE");
}

function getCatalogAssetForUrl(url, extraCandidates = []) {
  const candidates = [...extraCandidates];
  const text = String(url ?? "");
  if (text) {
    try {
      const parsed = new URL(text, document.baseURI);
      candidates.push(assetBasename(parsed.pathname));
    } catch (_) {
      candidates.push(assetBasename(text));
    }
  }
  return resolveCatalogAsset([], candidates);
}

function remapWallpaperDatabaseToCatalog(items) {
  if (!Array.isArray(items)) return [];
  if (catalogRuntime.apiHealthy) return normalizeApiWallpaperRows(items);
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const candidates = [item.asset, item.file, item.filename, item.id, `mybg_lobby_${pySlug(item.name)}`].filter(Boolean);
    const catalogUrl = getCatalogAssetForUrl(item.url, candidates);
    if (!catalogUrl) return item;
    return { ...item, legacyUrl: item.url || null, url: catalogUrl, catalogAsset: true };
  });
}


function emptyCardBundleCandidates(group, theme) {
  const base = `empty_cards_${pySlug(group)}_${pySlug(theme)}`;
  // Empty/ghost bundles in the current catalog normally do NOT use the _le suffix.
  // Keep _le as a compatibility fallback in case a future catalog does.
  return [base, `${base}_le`];
}

function getGhostCardUrl(group, member, theme, size = "large") {
  const groupSlug = pySlug(group);
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);
  if (catalogRuntime.apiHealthy && groupSlug && themeSlug && memberSlug) {
    const variant = size === "small" ? "small" : "large";
    const workerUrl = catalogBindingUrl(`ghost:${groupSlug}:${themeSlug}:${memberSlug}:${variant}`);
    const source = `c_l_${themeSlug}_${memberSlug}.png`;
    const cloudinaryFallback = variant === "small"
      ? `https://res.cloudinary.com/shining-superstar/image/upload/o_50,e_grayscale,r_10/c_auto,h_130,w_93/${source}`
      : `https://res.cloudinary.com/shining-superstar/image/upload/o_50,e_grayscale,r_10/${source}`;
    return rememberCatalogImageFallback(workerUrl, cloudinaryFallback);
  }
  const candidates = [
    `c_l_${themeSlug}_${memberSlug}_em`,
    `c_s_${themeSlug}_${memberSlug}_em`,
    `c_l_${themeSlug}_${memberSlug}`,
    `c_s_${themeSlug}_${memberSlug}`
  ];
  const hit = resolveCatalogAsset(emptyCardBundleCandidates(group, theme), candidates);
  if (hit) return hit;
  if (!bootState.ready) return legacyOrBlankAsset('', 'EMPTY CARD');
  warnMissingCatalogAsset('ghost card', `${group}/${theme}/${member}`);
  return legacyOrBlankAsset('', 'EMPTY CARD');
}

function getCatalogProfilePicUrl(group, member, theme) {
  const groupSlug = pySlug(group);
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);
  if (catalogRuntime.apiHealthy && groupSlug && themeSlug && memberSlug) {
    const workerUrl = catalogBindingUrl(`profile:${groupSlug}:${themeSlug}:${memberSlug}`);
    const cloudinaryFallback = `https://res.cloudinary.com/shining-superstar/c_thumb,g_face,w_200,h_200,r_max/c_l_${themeSlug}_${memberSlug}.png`;
    return rememberCatalogImageFallback(workerUrl, cloudinaryFallback);
  }
  const candidates = [
    `p_${themeSlug}_${memberSlug}`,
    `profile_${themeSlug}_${memberSlug}`,
    `${themeSlug}_${memberSlug}`
  ];
  const hit = resolveCatalogAsset(themeBundleCandidates('profile', group, theme), candidates);
  if (hit) return hit;
  return resolveCatalogAsset([], candidates) || legacyOrBlankAsset('', 'PROFILE');
}

function hydrateStaticCatalogAssets(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('img[src]').forEach((img) => {
    const current = img.getAttribute('src') || '';
    if (!/^https?:/i.test(current)) return;
    let stem = '';
    try { stem = assetBasename(new URL(current, document.baseURI).pathname); }
    catch (_) { stem = assetBasename(current); }
    if (!stem) return;
    const candidates = [stem];
    if (img.classList.contains('holo-single')) {
      const pfpStem = stem.replace(/^c_[ls]_/, 'p_');
      candidates.unshift(pfpStem);
    }
    const hit = resolveCatalogAsset([], candidates);
    if (hit) {
      img.src = hit;
      img.removeAttribute('onerror');
    }
  });
}
window.hydrateStaticCatalogAssets = hydrateStaticCatalogAssets;
window.getGhostCardUrl = getGhostCardUrl;

window.ShiningCatalog = Object.freeze({
  get mode() { return catalogRuntime.mode; },
  get version() { return catalogRuntime.version; },
  get apiHealthy() { return catalogRuntime.apiHealthy; },
  get manifest() { return manifestData; },
  get stats() { return { ...bootState.catalog }; },
  bindingUrl: catalogBindingUrl,
  card: (group, theme, member, grade = "C", size = "large") => catalogBindingUrl(`card:${pySlug(group)}:${pySlug(theme)}:${pySlug(member)}:${normalizeFrameGrade(grade)}:${size === "small" ? "small" : "large"}`),
  profile: (group, theme, member) => catalogBindingUrl(`profile:${pySlug(group)}:${pySlug(theme)}:${pySlug(member)}`),
  ghost: (group, theme, member, size = "large") => catalogBindingUrl(`ghost:${pySlug(group)}:${pySlug(theme)}:${pySlug(member)}:${size === "small" ? "small" : "large"}`),
  wallpaperAlias: (alias) => catalogBindingUrl(`wallpaper-alias:${normalizeAssetName(alias)}`),
  resolve: (name) => lookupGlobalAsset(name),
  resolveInBundle: (bundle, name) => resolveCatalogAsset([bundle], [name]),
  normalizeAssetName,
  clearPersistentCache: clearPersistentCatalogCache,
  get persistentCacheEnabled() { return !catalogCacheSessionDisabled && "indexedDB" in window; }
});

window.addEventListener("beforeunload", () => {
  for (const url of catalogObjectUrls) {
    try { URL.revokeObjectURL(url); } catch (_) {}
  }
});

