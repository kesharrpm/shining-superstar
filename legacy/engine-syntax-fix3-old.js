// SHINING SUPERSTAR BUILD 2026.08.23-syntax-fix3 — syntax-verified
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
/* ============================================================
 * CATALOG ASSET LAYER — extensionless AES ZIP bundles
 * ============================================================ */
const CATALOG_BASE_URLS = [
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/dev/2.0.0/",
  "https://kesharrpm.github.io/shining-superstar/dev/2.0.0/",
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/dev/2.0.0/"
];
const BUNDLE_PASSWORD = "shiningsuperstar_admin0033";
const BOOT_FETCH_TIMEOUT_MS = 20000;
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
  catalog: { totalBundles: 0, loadedBundles: 0, failedBundles: 0, assets: 0, verifiedBundles: 0 }
};
window.__SHINING_BOOT__ = bootState;

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

async function fetchJsonSafe(url, { required = false, label = "resource" } = {}) {
  try {
    const response = await fetchWithTimeout(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[Boot] ${label} failed: ${url}`, error);
    if (required) throw new Error(`${label} could not be loaded`, { cause: error });
    return null;
  }
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
  const delay = reduced ? 0 : Math.max(0, Number(options.delay ?? 90));
  try { playClickSound?.(); } catch (_) {}
  if (overlay) {
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
  }
  const run = async () => {
    try {
      return await action?.();
    } catch (error) {
      console.error("[UI Action]", error);
      try { showToast?.("Something went wrong. Please try again."); } catch (_) {}
      return undefined;
    } finally {
      if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => { overlay.style.display = "none"; }, reduced ? 0 : 160);
      }
    }
  };
  if (delay) return new Promise((resolve) => setTimeout(() => resolve(run()), delay));
  return run();
}
window.withLoadingCircle = withLoadingCircle;

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
      const blob = await downloadBundleBlob(manifestKey, fileInfo, onProgress);
      onProgress?.({ type: "unpack-start", key: manifestKey });
      if (!window.zip?.ZipReader || !window.zip?.BlobReader || !window.zip?.BlobWriter) {
        throw new Error("zip.js did not load");
      }
      reader = new zip.ZipReader(new zip.BlobReader(blob));
      const entries = await reader.getEntries();
      const files = entries.filter((entry) => !entry.directory);
      if (!files.length) throw new Error("ZIP bundle contains no files");
      const assets = Object.create(null);

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
        registerGlobalAsset(normalized, objectUrl);
        bootState.catalog.assets++;
        onProgress?.({ type: "unpack-progress", key: manifestKey, current: i + 1, total: files.length, percent: (i + 1) / files.length, asset: normalized });
      }

      assetCache[manifestKey] = assets;
      if (fileInfo.md5_checksum || fileInfo.md5) bootState.catalog.verifiedBundles++;
      bootState.catalog.loadedBundles++;
      onProgress?.({ type: "complete", key: manifestKey });
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

  const progress = new Array(keys.length).fill(0);
  const failed = [];
  const update = (status = "LOADING ASSETS") => {
    const overall = progress.reduce((a, b) => a + b, 0) / keys.length;
    const finished = progress.filter((value) => value >= 1).length;
    setLoadingState(status, `${finished} / ${keys.length} bundles · ${bootState.catalog.assets} assets`, Math.min(99, overall * 94 + 3));
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
        if (event.type === "download-start") {
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
  setLoadingState("CATALOG READY", `${keys.length} bundles · ${bootState.catalog.assets} decrypted assets`, 97);
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
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);
  const bundleCandidates = themeBundleCandidates("cards", group, theme);
  const prefix = size === "small" ? "c_s" : "c_l";
  const candidates = [
    `${prefix}_${themeSlug}_${memberSlug}_${gradeSlug}`,
    `${prefix}_${themeSlug}_${memberSlug}`,
    `${prefix}_${pySlug(group)}_${themeSlug}_${memberSlug}_${gradeSlug}`
  ];
  const hit = resolveCatalogAsset(bundleCandidates, candidates);
  if (hit) return hit;

  // UI builders can run during DOMContentLoaded while the catalog is still decrypting.
  // A not-yet-loaded asset is NOT a missing asset, so stay quiet until boot completes.
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
  const filename = assetBasename(String(baseImgPath ?? "").split("@@").pop());
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

function getGhostCardUrl(group, member, theme) {
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);
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
  const themeSlug = pySlug(theme);
  const memberSlug = pySlug(member);
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
  get manifest() { return manifestData; },
  get stats() { return { ...bootState.catalog }; },
  resolve: (name) => lookupGlobalAsset(name),
  resolveInBundle: (bundle, name) => resolveCatalogAsset([bundle], [name]),
  normalizeAssetName
});

window.addEventListener("beforeunload", () => {
  for (const url of catalogObjectUrls) {
    try { URL.revokeObjectURL(url); } catch (_) {}
  }
});

      // NEW: Added diamonds and missions object to the user template
      let user = {
        hp: 50,
        rp: 0,
        exp: 0,
        level: 1,
        mileage: 0,
        diamonds: 500,
        inventory: [],
        deck: {},
        inbox: [],
        isVIP: false,
        joinDate: null,
        missions: { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false },
        profile: { favCardUrl: null, favWallpaper: null },
        claimedCoupons: [],
        eventClaims: { 10: false, 50: false, 100: false },
        cardBookClaims: {}, // ✨ NEW! Tracks which theme rewards you've claimed
      };

// ✨ EVENT POINT SYSTEM ✨
const EVENT_POINT_REWARDS = {
    'PROFILE': 100,
    'A_CARD': 15,
    'R_PACK': 70,
    'PREMIUM_10': 35
};
const EVENT_POINT_GOAL = 250;

      // Simulated Coupon Database (You can link this to a Firebase panel later!)
      const validCoupons = {
        SHININGSTART: { type: "diamonds", amount: 500 },
        FREER: { type: "pack", packType: "all_R", amount: 1 },
        SUPERSTAR2026: { type: "rp", amount: 100000 },
      };
      let uid,
        poolData,
        urlData,
        cardMap,
        particles = [];
      let themeDatabase = {}; // Starts empty, will be filled by GitHub
      const weights = { R: 100, S: 50, A: 25, B: 10, C: 5 };
      const canvas = document.getElementById("particle-canvas");
      const ctx = canvas?.getContext?.("2d") || null;

      /* AUDIO & SETTINGS GLOBALS */
      let globalSfxVolume = getStoredNumber("shining_sfx_vol", 0.6);
      let globalBgmVolume = getStoredNumber("shining_bgm_vol", 0.5);
      let isReduceTrans = localStorage.getItem("shining_reduce_trans") === "true";

      const sfxClick = new Audio("https://superstarcdn.onelocal.host/mixkit-modern-technology-select-3124.wav");
      // Add the audio elements (replace with your preferred URLs)
const sfxRareReveal = new Audio("https://superstarcdn.onelocal.host/mixkit-rare-reveal.wav"); // Use for S grade
const sfxEpicReveal = new Audio("https://superstarcdn.onelocal.host/mixkit-epic-reveal.wav"); // Use for R/LE grade
let previousModalId = null;
async function bootShiningGame() {
  try {
    applySettingsOnLoad();

    // The tiny instant spinner is only a paint shield. Remove it immediately once
    // engine.js is running so the user can see the REAL catalog progress bar.
    hideInstantWaitScreen();
    setLoadingState("LOADING CATALOG", "Preparing manifest…", 2);

    // Catalog is required for this build: fetch the current main manifest and
    // decrypt every bundle before exposing the game UI.
    await fetchManifest();
    await preloadAllBundles();

    setLoadingState("LOADING GAME DATA", "Reading metadata…", 97);
    const cacheBuster = `?v=${Date.now()}`;
    const [p, u, d, w, t, n, b] = await Promise.all([
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/dev/cardGotcha.json" + cacheBuster, { required: true, label: "Card pool" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/qa/cardURLs.json" + cacheBuster, { required: true, label: "Card URL data" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/qa/dataURLs.json" + cacheBuster, { required: true, label: "Card metadata" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/qa/wallpaperData.json" + cacheBuster, { label: "Wallpaper data" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/qa/themeData.json" + cacheBuster, { required: true, label: "Theme data" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/dev/notices.json" + cacheBuster, { label: "Notice data" }),
      fetchJsonSafe("https://kesharrpm.github.io/shining-superstar/dev/bannerData.json" + cacheBuster, { label: "Banner data" })
    ]);

    poolData = p || { main: [{ pool: "CARD_001_C;CARD_002_C" }] };
    urlData = Array.isArray(u) ? u : [];
    cardMap = d && typeof d === "object" ? d : {};
    wallpaperDatabase = remapWallpaperDatabaseToCatalog(Array.isArray(w) ? w : []);
    themeDatabase = t && typeof t === "object" ? t : {};
    noticeDatabase = Array.isArray(n) ? n : [];
    lobbyBanners = Array.isArray(b) ? b : [];

    if (!wallpaperDatabase.length) {
      const fallbackWallpaper = lookupGlobalAsset("mybg_lobby_dirty_work") || lookupGlobalAsset("lobby_mybg_aespa");
      wallpaperDatabase = [{
        id: "bg_basic_01",
        type: "BASIC",
        name: "Aespa Stage",
        url: fallbackWallpaper || legacyOrBlankAsset("", "LOBBY"),
        cost: 0,
        currency: "free"
      }];
    }
    if (!Object.keys(themeDatabase).length) {
      throw new Error("Theme database is empty");
    }

    profilePicDatabase = [];
    for (const [groupName, groupData] of Object.entries(themeDatabase)) {
      if (!Array.isArray(groupData?.members)) continue;
      const themes = [...(groupData.themes || []), ...(groupData.le_themes || [])];
      for (const theme of themes) {
        const rawType = groupData.availability?.[theme]?.type ?? "FREE";
        const classification = String(rawType || "FREE").toUpperCase();
        const profileBundleKey = resolveManifestKey(themeBundleCandidates("profile", groupName, theme));
        for (const memberName of groupData.members) {
          profilePicDatabase.push({
            id: `${pySlug(groupName)}_${pySlug(memberName)}_${pySlug(theme)}`,
            group: String(groupName).toUpperCase(),
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

    // Replace old CDN preview images with already-decrypted catalog blobs wherever possible.
    hydrateStaticCatalogAssets(document);
    setLoadingState("FINALIZING", "Preparing interface…", 99);

    if (canvas && ctx) {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas, { passive: true });
      initParticles();
      animate();
    }

    const savedUid = localStorage.getItem("shining_uid");
    if (savedUid) {
      const idInput = document.getElementById("user-id");
      const passInput = document.getElementById("user-pass");
      if (idInput) idInput.value = savedUid;
      if (passInput) passInput.value = localStorage.getItem("shining_pass") || "";
      try {
        await handleAuth();
      } catch (authError) {
        // A saved login problem should not invalidate a successfully loaded catalog.
        console.warn("[Boot] Auto-login skipped:", authError);
      }
    }

    const card3d = document.getElementById("detail-card-3d");
    const card3dImg = card3d?.querySelector("img");
    if (card3d && card3dImg) {
      card3d.addEventListener("mousemove", (e) => {
        const rect = card3d.getBoundingClientRect();
        const xAxis = (rect.width / 2 - (e.clientX - rect.left)) / 10;
        const yAxis = (rect.height / 2 - (e.clientY - rect.top)) / 10;
        card3dImg.style.transform = `rotateY(${-xAxis}deg) rotateX(${yAxis}deg) scale(1.05)`;
      });
      card3d.addEventListener("mouseleave", () => {
        card3dImg.style.transform = "rotateY(0deg) rotateX(0deg) scale(1)";
      });
    }

    bootState.phase = "ready";
    bootState.ready = true;
    bootState.failed = false;
    setLoadingState("READY", `${bootState.catalog.loadedBundles} bundles · ${bootState.catalog.assets} assets`, 100);
    armStartGate();
  } catch (error) {
    console.error("[Boot] Unhandled startup error", error);
    reportBootFailure(error?.message || "The game could not finish loading.", error);
  }
}

// Start as soon as the DOM exists. Do NOT wait for every remote image/video to fire
// window.load; those optional network assets must never trap the user behind the spinner.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootShiningGame, { once: true });
} else {
  queueMicrotask(bootShiningGame);
}

/* ✨ SUPERSTAR POWER UP SYSTEM ✨ */
let puTargetIndex = null;
let puSelectedMaterials = []; 

const GRADE_VALUES = { 'C': 1, 'B': 2, 'A': 3, 'S': 4, 'R': 5 };
const BASE_COSTS = { 'C': 200, 'B': 400, 'A': 800, 'S': 1600, 'R': 3200 };
const COST_MULTIPLIERS = { 'C': 1, 'B': 1.5, 'A': 2, 'S': 3, 'R': 5 };

/* ✨ SHOP CAROUSEL LOGIC ✨ */
let currentShopSlide = 0;
const totalShopSlides = 3; // Change this if you add or remove slides in HTML
let shopSlideInterval;


/* ==========================================
   🌟 STAR PASS LOGIC 🌟
========================================== */

// Make sure the user has Star Pass data initialized
if (!user.starPass) {
    user.starPass = { level: 1, exp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
}

// Generate 30 Tiers of Rewards
const passRewards = Array.from({ length: 30 }, (_, i) => {
    let lvl = i + 1;
    // Every 5 levels gives better rewards
    let isMilestone = (lvl % 5 === 0);
    
    return {
        level: lvl,
        reqExp: lvl * 100, // Level 1 needs 100, Level 2 needs 200, etc.
        free: { 
            type: isMilestone ? 'Diamonds' : 'RP', 
            amount: isMilestone ? 50 : 5000, 
            icon: isMilestone ? '💎' : '✦' 
        },
        premium: { 
            type: isMilestone ? 'LE_Pack' : 'Diamonds', 
            amount: isMilestone ? 1 : 20, 
            icon: isMilestone ? '📦' : '💎' 
        }
    };
});

    /* ✨ DYNAMIC ROTATING LOBBY BANNER LOGIC ✨ */
let currentLobbyBannerIdx = 0;
let lobbyBannerInterval = null;

function initLobbyBanner() {
    const bannerContainer = document.getElementById("lobby-promo-banner");
    
    // Failsafe: If the JSON is empty or failed to load, hide the banner
    if (!lobbyBanners || lobbyBanners.length === 0) {
        if (bannerContainer) bannerContainer.style.display = "none";
        return;
    }

    // Show the banner
    if (bannerContainer) bannerContainer.style.display = "block";

    // Generate the dots
    const dotsContainer = document.getElementById("lobby-banner-dots");
    if (dotsContainer) {
        dotsContainer.innerHTML = lobbyBanners.map((_, i) => 
            `<div class="banner-dot ${i === 0 ? 'active' : ''}"></div>`
        ).join("");
    }

    // Set the first banner instantly
    updateLobbyBannerUI();
    
    // Start the timer
    clearInterval(lobbyBannerInterval);
    lobbyBannerInterval = setInterval(rotateLobbyBanner, 5000);
}

function rotateLobbyBanner() {
    if (!lobbyBanners || lobbyBanners.length === 0) return;
    currentLobbyBannerIdx = (currentLobbyBannerIdx + 1) % lobbyBanners.length;
    updateLobbyBannerUI();
}
// ✨ HASH ROUTER FOR ISOLATED SCREENS ✨
function handleHashChange() {
    const hash = window.location.hash;
    const eventModal = document.getElementById("isolated-event-modal");

    // 🚨 FIX: Failsafe to prevent crash if the modal doesn't exist in the HTML yet
    if (!eventModal) return;

    if (hash === "#event") {
        eventModal.style.display = "flex";
        const shopModal = document.getElementById("shop-modal");
        if (shopModal) shopModal.style.display = "none";
    } else {
        if (eventModal.style.display === "flex") {
            eventModal.classList.add("anim-fade-out");
            setTimeout(() => {
                eventModal.style.display = "none";
                eventModal.classList.remove("anim-fade-out");
            }, 200);
        }
    }
}

// Listen for the URL changing
window.addEventListener("hashchange", handleHashChange);

// Run it once when the game loads just in case someone shared the link!
window.addEventListener("load", () => {
    setTimeout(handleHashChange, 500); // Slight delay to let your other load scripts finish
});

function updateLobbyBannerUI() {
    if (!lobbyBanners || lobbyBanners.length === 0) return;

    const bannerImg = document.getElementById("lobby-banner-img");
    const bannerContainer = document.getElementById("lobby-promo-banner");
    const dots = document.querySelectorAll("#lobby-promo-banner .banner-dot");

    if (bannerImg && bannerContainer) {
        // Smooth fade out
        bannerImg.style.opacity = "0.3";
        
        setTimeout(() => {
            // Swap image and click action using the JSON data!
            bannerImg.src = lobbyBanners[currentLobbyBannerIdx].img;
            
            // Fade back in
            bannerImg.style.opacity = "1";

            // Update dots
            dots.forEach((d, i) => {
                if (i === currentLobbyBannerIdx) d.classList.add("active");
                else d.classList.remove("active");
            });
        }, 300);
    }
}

// Make sure to call this at the bottom of your window.onload function!
// setTimeout(initLobbyBanner, 1000);
function openStarPass() {
    updatePassUI();
    document.getElementById("star-pass-modal").style.display = "flex";
}

function buyPremiumPass() {
    if (user.starPass.isPremium) return showToast("You already own the Premium Pass!");
    if (user.diamonds < 300) return showToast("Not enough Diamonds!");
    
    user.diamonds -= 300;
    user.starPass.isPremium = true;
    showToast("🌟 PREMIUM PASS UNLOCKED! 🌟");
    updateUI();
    updatePassUI();
}

function updatePassUI() {
    // 1. Update Header Progress
    let currentLvl = user.starPass.level;
    let currentExp = user.starPass.exp;
    let reqExp = currentLvl * 100;
    
    document.getElementById("pass-current-lvl").innerText = currentLvl;
    document.getElementById("pass-exp-text").innerText = `${currentExp} / ${reqExp} EXP`;
    document.getElementById("pass-exp-fill").style.width = `${Math.min((currentExp/reqExp)*100, 100)}%`;
    
    // Hide Premium Button if owned
    const btn = document.getElementById("buy-premium-btn");
    if (user.starPass.isPremium) {
        btn.innerText = "PREMIUM ACTIVE ✓";
        btn.style.filter = "grayscale(1)";
        btn.disabled = true;
    }

    // 2. Render Tiers
    const container = document.getElementById("pass-tiers-container");
    container.innerHTML = passRewards.map(tier => {
        const isUnlocked = currentLvl >= tier.level;
        
        // Free Track Status
        const freeClaimed = user.starPass.claimedFree.includes(tier.level);
        const freeClass = freeClaimed ? "claimed" : (isUnlocked ? "claimable" : "locked");
        const freeClick = (!freeClaimed && isUnlocked) ? `onclick="claimPassReward(${tier.level}, 'free')"` : "";

        // Premium Track Status
        const premClaimed = user.starPass.claimedPremium.includes(tier.level);
        const premClass = premClaimed ? "claimed" : (isUnlocked && user.starPass.isPremium ? "claimable premium" : "locked premium");
        const premClick = (!premClaimed && isUnlocked && user.starPass.isPremium) ? `onclick="claimPassReward(${tier.level}, 'premium')"` : "";

        return `
        <div class="star-pass-track">
            <!-- FREE TRACK -->
            <div class="pass-tier-box ${freeClass}" ${freeClick}>
                <div style="font-size: 24px;">${tier.free.icon}</div>
                <div style="font-weight: 900; color: white;">${tier.free.amount}</div>
                <div style="font-size: 10px; color: gray;">${tier.free.type}</div>
            </div>
            
            <!-- LEVEL INDICATOR -->
            <div style="width: 50px; display: flex; align-items: center; justify-content: center;">
                <div style="background: ${isUnlocked ? 'var(--secondary-glow)' : '#333'}; color: ${isUnlocked ? 'black' : 'white'}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; box-shadow: ${isUnlocked ? '0 0 10px var(--secondary-glow)' : 'none'};">
                    ${tier.level}
                </div>
            </div>

            <!-- PREMIUM TRACK -->
            <div class="pass-tier-box ${premClass}" ${premClick}>
                <div style="font-size: 24px;">${tier.premium.icon}</div>
                <div style="font-weight: 900; color: white;">${tier.premium.amount}</div>
                <div style="font-size: 10px; color: #fee440;">${tier.premium.type}</div>
            </div>
        </div>
        `;
    }).join("");
}

// ✨ GACHA PITY ENGINE ✨
if (!user.pityCount) user.pityCount = 0;
const MAX_PITY = 50;

function addPity(amount) {
    user.pityCount += amount;
    if (user.pityCount > MAX_PITY) user.pityCount = MAX_PITY;
    updatePityUI();
}

function updatePityUI() {
    let fill = document.getElementById("pity-bar-fill");
    let text = document.getElementById("pity-text");
    let btn = document.getElementById("pity-claim-btn");

    if (fill && text) {
        let percentage = (user.pityCount / MAX_PITY) * 100;
        fill.style.width = percentage + "%";
        text.innerText = `${user.pityCount} / ${MAX_PITY}`;
        
        if (user.pityCount >= MAX_PITY) {
            fill.style.background = "linear-gradient(90deg, #00f5d4, #00bbf9)";
            btn.style.display = "block";
        } else {
            fill.style.background = "linear-gradient(90deg, #ff0055, #ffcf54)";
            btn.style.display = "none";
        }
    }
}

function claimPityReward() {
    if (user.pityCount < MAX_PITY) return;
    
    user.pityCount = 0; // Reset pity
    updatePityUI();
    
    // Inject reward into user's inbox (Reuses your existing inbox code format)
    user.inbox.push({ 
        id: Date.now().toString(), 
        title: `Pity System R-Grade Pack`, 
        type: "pack", 
        packType: "guaranteed_R", 
        grade: "R", 
        amount: 1 
    });
    
    showToast("🌟 PITY REACHED! Check your inbox for your Guaranteed R Card!");
    if (typeof updateUI === "function") updateUI();
}

// Call this once on window load
setTimeout(updatePityUI, 1000);
function claimPassReward(level, track) {
    playClickSound();
    const tier = passRewards.find(t => t.level === level);
    const reward = track === 'free' ? tier.free : tier.premium;

    // Grant Reward
    if (reward.type === 'RP') user.rp += reward.amount;
    if (reward.type === 'Diamonds') user.diamonds += reward.amount;
    if (reward.type === 'LE_Pack') {
        // ✨ FIXED: Now pushes "le_guaranteed" and forces an "R" grade!
        user.inbox.push({ 
            id: Date.now().toString(), 
            title: `Star Pass Lv ${level} LE Reward`, 
            type: "pack", 
            packType: "le_guaranteed", 
            grade: "R", 
            amount: 1 
        });
        // NEW: Opens directly on screen
openDynamicPack("le_guaranteed", 1, "R"); // Call your gacha trigger directly
    } else {
        showToast(`✨ Claimed ${reward.amount} ${reward.type}!`);
    }

    // Save state
    if (track === 'free') user.starPass.claimedFree.push(level);
    if (track === 'premium') user.starPass.claimedPremium.push(level);
    
    updateUI();
    updatePassUI();
}

/* ==========================================
   ðŸ† LEADERBOARD LOGIC ðŸ†
========================================== */

function switchEventSubTab(id, btn) {
    // Deactivate all sub-tab buttons
    document.querySelectorAll('#shop-tab-event .bg-sub-tab').forEach(b => b.classList.remove('active'));
    // Hide all event sub-content divs
    document.querySelectorAll('.event-sub-content').forEach(el => el.style.display = 'none');

    // Activate clicked button and show matching content
    btn.classList.add('active');
    const target = document.getElementById('event-sub-' + id);
    if (target) {
        target.style.display = 'block';
        if (typeof updateStepUpVisual === 'function') updateStepUpVisual(id);
        if (typeof injectEventPointBadges === 'function') injectEventPointBadges();
    }
}
// Mock data generator so the leaderboard looks alive
function generateLeaderboardData() {
    // If the user doesn't have a fake total score yet, generate one based on their highest combo
    if (!user.totalWeeklyScore) user.totalWeeklyScore = (user.level * 500000) + Math.floor(Math.random() * 1000000);

    let players = [];
    
    // Generate 15 fake players scoring around the user's score
    for(let i=0; i<15; i++) {
        let variance = (Math.random() - 0.5) * 2000000; // Fluctuate by +/- 1 million
        players.push({
            name: `Player_${Math.floor(Math.random()*9999)}`,
            score: Math.max(0, Math.floor(user.totalWeeklyScore + variance)),
            isMe: false
        });
    }

    // Insert User
    players.push({ name: uid || "GUEST", score: user.totalWeeklyScore, isMe: true });

    // Sort Descending
    players.sort((a, b) => b.score - a.score);
    return players;
}

// ðŸ† CYBER LEAGUE JAVASCRIPT ENGINE ðŸ†
// ðŸ† LIVE MULTIPLAYER CYBER LEAGUE ENGINE (REAL USER PFP GUARANTEE) ðŸ†
async function openLeaderboard() {
    // Hide old modals
    const oldModal = document.getElementById('leaderboard-modal');
    if (oldModal) oldModal.style.display = 'none';

    document.getElementById('cyber-league-modal').style.display = 'flex';
    
    // 🚨 NATIVE CLOUDINARY PFP FETCHER (FOR FALLBACKS & BOTS) 🚨
    const getRandomCloudinaryPFP = () => {
        if (typeof profilePicDatabase !== 'undefined' && profilePicDatabase.length > 0) {
            let randomItem = profilePicDatabase[Math.floor(Math.random() * profilePicDatabase.length)];
            if (randomItem && randomItem.basePath) {
                return getProfilePicUrl(randomItem.basePath);
            }
        }
        return "https://via.placeholder.com/150/000/fff?text=PFP"; 
    };

    let players = [];
    let myScore = (typeof user !== 'undefined' && user.leagueScore) ? user.leagueScore : 0; 

    try {
        // 1. Fetch real players from your Firebase Database
        const snapshot = await db.collection("users").get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = doc.id === uid;
            let pScore = data.leagueScore || 0;
            
            if (isMe) myScore = pScore; 
            
            // 🚨 EXACT PFP EXTRACTION LOGIC 🚨
            let userActualPfp = null;
            
            // First check if they have a proper profile object with a picture
            if (data.profile && data.profile.profilePic && data.profile.profilePic.trim() !== "") {
                userActualPfp = data.profile.profilePic;
            } 
            // Fallback for older accounts that might have saved it directly
            else if (data.profilePic && data.profilePic.trim() !== "") {
                userActualPfp = data.profilePic;
            }

            players.push({
                name: doc.id,
                score: pScore,
                isMe: isMe,
                // Uses their REAL set PFP, or falls back to a random one if it's completely blank
                pfp: userActualPfp || getRandomCloudinaryPFP()
            });
        });
    } catch (error) {
        console.error("Firebase Offline: Could not fetch live leaderboard.", error);
        players.push({ 
            name: (typeof uid !== 'undefined' && uid ? uid : "GUEST"), 
            score: myScore, 
            isMe: true, 
            // Fallback to whatever is currently loaded in your top-left UI
            pfp: document.getElementById("header-profile-pic").src 
        });
    }

    // Update your personal score card
    document.getElementById('arena-my-score').innerText = myScore.toLocaleString();

    // 2. Backfill with Bots
    let botCount = 1;
    while (players.length < 20) {
        players.push({
            name: "RivalBot_" + botCount,
            score: Math.floor(Math.random() * (myScore + 500000)), 
            isMe: false,
            // Bots always pull a random avatar from your actual database
            pfp: getRandomCloudinaryPFP()
        });
        botCount++;
    }

    // 3. Sort the entire server by score descending
    players.sort((a, b) => b.score - a.score);

    const podiumContainer = document.getElementById('arena-podium');
    const listContainer = document.getElementById('arena-list');
    
    podiumContainer.innerHTML = '';
    listContainer.innerHTML = '';

    // 4. Build the Podium (Visual Order: 2nd, 1st, 3rd)
    const podiumOrder = [1, 0, 2]; 
    
    podiumOrder.forEach(idx => {
        const p = players[idx];
        if (!p) return;
        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : 'rank-3';
        const displayRank = idx + 1;
        
        podiumContainer.innerHTML += `
            <div class="podium-slot ${rankClass}">
                <img src="${p.pfp}" class="podium-avatar" onerror="this.src='https://jyp.com/200x200/111/fff?text=BOT'">
                <div class="podium-base">
                    <div style="font-size: 24px; font-weight: 900; color: rgba(0,0,0,0.5); position: absolute; bottom: -5px; z-index: 1;">${displayRank}</div>
                    <div class="podium-name" style="${p.isMe ? 'color: var(--primary-glow);' : ''}">${p.name}</div>
                    <div class="podium-score">${p.score.toLocaleString()}</div>
                </div>
            </div>
        `;
    });

    // 5. Build the rest of the bracket (Ranks 4-20)
    for (let i = 3; i < players.length; i++) {
        const p = players[i];
        
        if (i === 5) {
            listContainer.innerHTML += `<div style="border-top: 2px dashed #00f5d4; margin: 10px 0; text-align: center;"><span style="background: #0a0204; padding: 0 10px; position: relative; top: -8px; font-size: 10px; color: #00f5d4; font-weight: 900; letter-spacing: 2px;">▲ PROMOTION ZONE ▲</span></div>`;
        } else if (i === 15) {
            listContainer.innerHTML += `<div style="border-top: 2px dashed #ff0055; margin: 10px 0; text-align: center;"><span style="background: #0a0204; padding: 0 10px; position: relative; top: -8px; font-size: 10px; color: #ff0055; font-weight: 900; letter-spacing: 2px;">▼ DEMOTION ZONE ▼</span></div>`;
        }

        listContainer.innerHTML += `
            <div class="arena-row ${p.isMe ? 'is-me' : ''}">
                <div class="a-rank">${i + 1}</div>
                <img src="${p.pfp}" class="a-pfp" onerror="this.src='https://jyp.com/200x200/111/fff?text=BOT'">
                <div class="a-info">
                    <div class="a-name">${p.name}</div>
                </div>
                <div class="a-score">${p.score.toLocaleString()}</div>
            </div>
        `;
    }
}
// ==========================================
// ✨ WEIGHTLESS INVENTORY & BULK BUY LOGIC ✨
// ==========================================

// This function calculates how full your inventory is, explicitly IGNORING material cards!
function getUsedInventorySlots() {
    if (!user.inventory) return 0;
    return user.inventory.filter(c => c.type !== 'material').length;
}

// Global config to hold the current item being bought
let bulkConfig = { baseCost: 0, currency: 'rp', maxAllowed: 99, action: null };

function openBulkBuy(itemName, baseCost, currency, actionCallback) {
    playClickSound();
    bulkConfig.baseCost = baseCost;
    bulkConfig.currency = currency;
    bulkConfig.action = actionCallback;
    
    // Auto-calculate the MAX they can afford!
    let currentBalance = currency === 'rp' ? user.rp : (currency === 'diamond' ? user.diamonds : user.hp);
    bulkConfig.maxAllowed = Math.floor(currentBalance / baseCost);
    
    if(bulkConfig.maxAllowed < 1) bulkConfig.maxAllowed = 1; // Let it stay at 1 so they see the "Not Enough Currency" warning
    if(bulkConfig.maxAllowed > 99) bulkConfig.maxAllowed = 99; // Cap at 99 per transaction to prevent lag

    document.getElementById("bulk-item-name").innerText = itemName;
    document.getElementById("bulk-qty-input").value = 1;
    updateBulkDisplay();
    
    document.getElementById("bulk-buy-modal").style.display = "flex";
}

function adjustBulkQty(amount) {
    playClickSound();
    let input = document.getElementById("bulk-qty-input");
    let val = parseInt(input.value) || 1;
    
    if (amount === 'max') val = bulkConfig.maxAllowed;
    else val += amount;
    
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    
    input.value = val;
    updateBulkDisplay();
}

function manualBulkQty() {
    let input = document.getElementById("bulk-qty-input");
    let val = parseInt(input.value) || 1;
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    input.value = val;
    updateBulkDisplay();
}

function updateBulkDisplay() {
    let qty = parseInt(document.getElementById("bulk-qty-input").value) || 1;
    let total = bulkConfig.baseCost * qty;
    
    let icon = bulkConfig.currency === 'rp' ? 'âœ¦' : (bulkConfig.currency === 'diamond' ? 'ðŸ’Ž' : 'â¤');
    let color = bulkConfig.currency === 'rp' ? 'var(--rp-color)' : 'var(--diamond-color)';
    
    document.getElementById("bulk-total-cost").innerHTML = `<span style="color:${color}">${icon} ${total.toLocaleString()}</span>`;
}

function confirmBulkBuy() {
    let qty = parseInt(document.getElementById("bulk-qty-input").value) || 1;
    document.getElementById("bulk-buy-modal").style.display = "none";
    
    // Process the purchase with the smooth loading screen!
    withLoadingCircle(() => {
        if (bulkConfig.action) bulkConfig.action(qty);
    });
}

// 🚨 UPGRADED: Buy Material Cards in Bulk (Weightless!) 🚨
function buyMaterialCard(chancePercentage, baseCost, qty) {
    let totalCost = baseCost * qty;

    if (chancePercentage === 100) {
        if (user.diamonds < totalCost) return showToast("âš ï¸ Not enough Diamonds!");
        user.diamonds -= totalCost;
    } else {
        if (user.rp < totalCost) return showToast("âš ï¸ Not enough RP!");
        user.rp -= totalCost;
    }

    // Instantly inject X amount of material cards! They bypass the inventory limit entirely.
    for(let i = 0; i < qty; i++) {
        user.inventory.push({
            id: `mat_${chancePercentage}_${Date.now()}_${i}`,
            type: 'material',
            chance: chancePercentage / 100,
            grade: 'MAT',
            locked: false,
            level: 1,
            group: "SYSTEM", member: "MATERIAL", theme: "RESOURCE", url: "dynamic"
        });
    }

    showToast(`✨ Successfully bought ${qty}x ${chancePercentage}% Material Cards!`);
    updateUI();
}

function renderStepUpUI(eventId) {
    const desc = document.getElementById(`step-up-desc-${eventId}`);
    const btn = document.getElementById(`step-up-btn-${eventId}`);
    if (!desc || !btn) return;
    
    if (!user.stepUpState) user.stepUpState = {};
    const currentState = user.stepUpState[eventId] || 1;
    
    if (currentState === 1) {
        desc.innerText = "STEP 1: 1 A-Grade Card (FREE!)";
        btn.innerText = "FREE";
    } else if (currentState === 2) {
        desc.innerText = "STEP 2: 1 S-Grade Card (200 💎)";
        btn.innerText = "💎 200";
        btn.className = "btn btn-draw";
        btn.style.borderColor = "var(--diamond-color)";
        btn.style.color = "var(--diamond-color)";
    } else if (currentState === 3) {
        desc.innerText = "STEP 3: 1 R-Grade Card (400 💎)";
        btn.innerText = "💎 400";
        btn.className = "btn btn-live";
    } else {
        desc.innerText = "All Steps Completed!";
        desc.style.color = "gray";
        btn.innerText = "SOLD OUT";
        btn.className = "btn btn-draw";
        btn.style.borderColor = "gray";
        btn.style.color = "gray";
        btn.disabled = true;
    }
}
function startShopCarousel() {
    // Clear any existing interval to prevent speeding up
    clearInterval(shopSlideInterval);
    
    shopSlideInterval = setInterval(() => {
        currentShopSlide = (currentShopSlide + 1) % totalShopSlides;
        updateShopCarousel();
    }, 4000); // Slides every 4 seconds
}

function goToShopSlide(index) {
    playClickSound();
    currentShopSlide = index;
    updateShopCarousel();
    
    // Reset the timer when manually clicked so it doesn't instantly slide away
    clearInterval(shopSlideInterval);
    startShopCarousel();
}

function updateShopCarousel() {
    const track = document.getElementById("shop-carousel-track");
    if (track) {
        track.style.transform = `translateX(-${currentShopSlide * 100}%)`;
    }
    
    const dots = document.querySelectorAll(".shop-dot");
    dots.forEach((dot, index) => {
        if (index === currentShopSlide) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

// Make sure to start the carousel when the shop opens!
// Find your openShopModal() function and add startShopCarousel() to it:
function openShopModal() {
    document.getElementById("shop-modal").style.display = "flex";
    switchShopTab('event'); // Ensure it defaults to event
    startShopCarousel();    // Start the sliding animation
}


function executeStepUp(eventId) {
    if (!user.stepUpState) user.stepUpState = {};
    if (!user.stepUpState[eventId]) user.stepUpState[eventId] = 1;
    const step = user.stepUpState[eventId];

    if (step === 1) {
        // Step 1 is FREE
        generateCards(1, "event_specific", "A", null, null);
        user.stepUpState[eventId] = 2;
    } else if (step === 2) {
        if (user.diamonds < 200) return showToast("⚠️ Not enough Diamonds!");
        user.diamonds -= 200;
        generateCards(1, "event_specific", "S", null, null);
        user.stepUpState[eventId] = 3;
    } else if (step === 3) {
        if (user.diamonds < 400) return showToast("⚠️ Not enough Diamonds!");
        user.diamonds -= 400;
        generateCards(1, "event_specific", "R", null, null);
        user.stepUpState[eventId] = 4;
    } else {
        return showToast("All Steps Completed!");
    }

    updateUI();
    renderStepUpUI(eventId);
}

function getMaxLevel(grade) {
    return grade === 'R' ? 99 : 5;
}

// ✨ 1. THE FIXED TRIGGER (Allows R cards up to Lv 50!)
// ✨ 1. THE FIXED TRIGGER (Allows C/B/A/S cards to enter the menu at Lv 5!)
function triggerUpgrade(index) {
    const card = user.inventory[index];
    
    // Check if locked
    if (card.locked) return showToast("âš ï¸ Card is locked! Unlock it first.");
    
    // 🚨 THE FIX: Only block if it is an 'R' card at Level 50!
    const maxLvl = card.grade === 'R' ? 50 : 5;
    if ((card.level || 1) >= maxLvl && card.grade === 'R') {
        return showToast("🌟 Card is at absolute MAX level!");
    }
    
    document.getElementById("superstar-collection-modal").style.display = "none";
    openUpgradeModal(index);
}

// ✨ 2. THE UI INJECTION (Now shows 'GRADE UP' text!)
function openUpgradeModal(index) {
    puTargetIndex = index;
    puSelectedMaterials = [];
    const card = user.inventory[index];
    
    const modalOverlay = document.getElementById("upgrade-modal");
    let curLvl = card.level || 1;
    let maxLvl = card.grade === 'R' ? 50 : 5;

    // Detect if we are leveling up OR grading up
    let nextLvlText = `Lv ${Math.min(curLvl + 1, maxLvl)}`;
    let nextLvlColor = "var(--hp-color)";
    
    if (curLvl >= maxLvl && card.grade !== 'R') {
        nextLvlText = "â­ GRADE UP";
        nextLvlColor = "var(--tertiary-glow)";
    }
    
    modalOverlay.innerHTML = `
    <div class="pu-modal-inner" style="margin: auto; pointer-events: auto;">
        <button class="close-btn" style="position: absolute; top: 15px; right: 20px; z-index: 10; font-size: 30px;" onclick="withLoadingCircle(() => { closeUpgradeModal() })">&times;</button>
        <h2 style="color: white; letter-spacing: 2px; margin-bottom: 20px; font-size: 18px;">POWER UP</h2>

        <div class="pu-top-section">
            <div class="pu-left-panel">
                <div style="width: 130px; position: relative;">
                    <img id="pu-target-img" src="" style="width: 100%; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.8);">
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <h3 id="pu-target-group" style="color: var(--text-muted); font-size: 10px; margin-bottom: 2px;">GROUP</h3>
                    <h2 id="pu-target-member" style="color: white; font-weight: 900; font-size: 18px; margin-bottom: 5px;">MEMBER</h2>
                    <p id="pu-target-theme" style="color: var(--secondary-glow); font-size: 11px; font-weight: bold; margin-bottom: 15px;">THEME</p>
                    
                    <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="color: gray; font-size: 12px;">Current Level</span>
                            <span id="pu-current-lvl" style="color: white; font-weight: bold;">Lv ${curLvl}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: ${nextLvlColor}; font-size: 12px; font-weight: bold;">Next Level</span>
                            <span id="pu-next-lvl" style="color: ${nextLvlColor}; font-weight: 900; text-shadow: 0 0 10px ${nextLvlColor};">${nextLvlText}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pu-right-panel">
                <h3 style="color: white; font-size: 12px; margin-bottom: 10px;">Material Card (Up to 5)</h3>
                <div class="pu-slots-container" id="pu-slots-container"></div>
                
                <div style="text-align: right; margin-top: 15px;">
                    <span style="color: gray; font-size: 12px;">Level Up Success Chance: </span>
                    <span id="pu-success-text" style="font-weight: 900; color: white;">-</span>
                </div>

                <div style="display: flex; gap: 10px; margin-top: auto;">
                    <button class="btn btn-draw" style="flex: 1; background: white; color: black;" onclick="autoSelectPU()">Recommended</button>
                    <button class="btn btn-live" id="pu-try-btn" style="flex: 1.5; background: #ff0055; color: white; border: none; box-shadow: 0 0 15px rgba(255,0,85,0.4);" onclick="withLoadingCircle(() => { executeUpgrade() })">
                        TRY <span id="pu-cost-text" style="margin-left: 5px;">0 RP</span>
                    </button>
                </div>
            </div>
        </div>

        <h3 style="color: white; font-size: 11px; margin-bottom: 5px;">Select Materials</h3>
        <div class="pu-inventory-section" id="pu-inventory-grid"></div>
    </div>
    `;

    document.getElementById("pu-target-img").src = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;
    document.getElementById("pu-target-group").innerText = card.group;
    document.getElementById("pu-target-member").innerText = card.member;
    document.getElementById("pu-target-theme").innerText = card.theme;
    
    modalOverlay.style.display = "flex";
    updatePUUI();
    renderPUInventory();
}

function updatePUUI() {
    const slotsContainer = document.getElementById("pu-slots-container");
    const targetCard = user.inventory[puTargetIndex];
    let slotsHtml = "";
    let totalCost = 0;
    let lowestChance = null;

    for (let i = 0; i < 5; i++) {
        const matIndex = puSelectedMaterials[i];
        if (matIndex !== undefined) {
            const matCard = user.inventory[matIndex];
            const chanceData = getPUSuccessChance(targetCard.grade, matCard.grade);
            
            if (!lowestChance || chanceData.chance < lowestChance.chance) lowestChance = chanceData;
            totalCost += Math.floor(BASE_COSTS[matCard.grade] * COST_MULTIPLIERS[targetCard.grade]);

            slotsHtml += `
                <div class="pu-slot filled" onclick="togglePUMaterial(${matIndex})">
                    <img src="${typeof getSmallCardUrl === 'function' ? getSmallCardUrl(matCard.url, matCard.grade, matCard.member, matCard.theme, matCard.group) : matCard.url}">
                    <div style="position: absolute; bottom: 0; background: rgba(0,0,0,0.8); width: 100%; font-size: 10px; text-align: center; font-weight: bold; padding: 2px;">${matCard.grade}</div>
                </div>`;
        } else {
            slotsHtml += `<div class="pu-slot">+</div>`;
        }
    }
    slotsContainer.innerHTML = slotsHtml;

    const chanceDisplay = document.getElementById("pu-success-text");
    if (puSelectedMaterials.length === 0) {
        chanceDisplay.innerText = "-";
        chanceDisplay.style.color = "white";
    } else {
        chanceDisplay.innerText = lowestChance.text;
        chanceDisplay.style.color = lowestChance.color;
    }

    const tryBtn = document.getElementById("pu-try-btn");
    document.getElementById("pu-cost-text").innerText = `(${totalCost.toLocaleString()} RP)`;
    tryBtn.disabled = puSelectedMaterials.length === 0;
    tryBtn.style.filter = puSelectedMaterials.length === 0 ? "grayscale(1)" : "none";
}

// ✨ THE MISSING FUNCTION IS HERE ✨
function renderPUInventory() {
    const grid = document.getElementById("pu-inventory-grid");
    
    grid.innerHTML = user.inventory.map((card, index) => {
        const isTarget = index === puTargetIndex;
        if (isTarget) return ''; 

        const isEq = isCardEquipped(card);
        const isLocked = card.locked;
        const isFav = user.favoriteCard && 
                      user.favoriteCard.url === card.url && 
                      user.favoriteCard.grade === card.grade && 
                      user.favoriteCard.member === card.member;

        const isDisabled = isEq || isLocked || isFav; 
        const isSelected = puSelectedMaterials.includes(index);
        
        let indicators = "";
        if (isLocked) indicators += `<div class="status-icon lock" title="Locked">🔒</div>`;
        if (isEq) indicators += `<div class="status-icon eq" title="Equipped">E</div>`;
        if (isFav) indicators += `<div class="status-icon fav" title="Favorited">★</div>`;
        
        let indicatorContainer = indicators ? `<div class="card-status-indicators">${indicators}</div>` : '';

        const clickAction = isDisabled 
            ? `onclick="showToast('Cannot consume Locked, Equipped, or Favorited cards!')"` 
            : `onclick="togglePUMaterial(${index})"`;

        return `
            <div class="pu-inv-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" ${clickAction}>
                <img src="${typeof getSmallCardUrl === 'function' ? getSmallCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url}">
                ${indicatorContainer}
            </div>
        `;
    }).join("");
}

function renderNoticeBoard() {
    const container = document.getElementById("dynamic-notice-container");
    
    if (!noticeDatabase || noticeDatabase.length === 0) {
        container.innerHTML = `<p style="color: gray; text-align: center; margin-top: 20px;">No new notices at this time.</p>`;
        return;
    }

    let finalHtml = ``;

    finalHtml += noticeDatabase.map((notice, noticeIndex) => {
        const clickAction = notice.action ? `onclick="${notice.action}"` : ``;
        let cardsHtml = "";
        let dynamicKeyframes = `<style>`;

        // ✨ RESTORED: The logic that actually builds the floating cards!
        if (notice.cards && notice.cards.length > 0) {
            const N = notice.cards.length;
            const spotlightTime = 2.5; 
            const totalDuration = N * spotlightTime; 

            const cardImages = notice.cards.map((cardUrl, i) => {
                const animName = `premium_wave_n${noticeIndex}_c${i}`;
                const middleIndex = (N - 1) / 2;
                const offset = i - middleIndex;
                const angle = offset * 8; 
                const dropY = Math.abs(offset) * 4; 
                const rightPos = (N - 1 - i) * 25; 
                
                const defaultTransform = `translateY(${dropY}px) rotate(${angle}deg) scale(1)`;
                const activeTransform = `translateY(-30px) rotate(0deg) scale(1.35)`;
                
                const pStart = (i / N) * 100;
                const pMid = ((i + 0.5) / N) * 100;
                const pEnd = ((i + 1) / N) * 100;

                dynamicKeyframes += `
                    @keyframes ${animName} {
                        0%, ${Math.max(0, pStart - 1)}% { 
                            transform: ${defaultTransform}; 
                            z-index: ${i}; 
                            filter: brightness(0.8) drop-shadow(-5px 5px 10px rgba(0,0,0,0.6));
                        }
                        ${pStart}% { z-index: 50; }
                        ${pMid}% { 
                            transform: ${activeTransform}; 
                            z-index: 50; 
                            filter: brightness(1.2) drop-shadow(0 0 20px ${notice.borderColor}); 
                        }
                        ${pEnd}% { z-index: 50; }
                        ${Math.min(100, pEnd + 1)}%, 100% { 
                            transform: ${defaultTransform}; 
                            z-index: ${i}; 
                            filter: brightness(0.8) drop-shadow(-5px 5px 10px rgba(0,0,0,0.6));
                        }
                    }
                `;

                return `
                <div class="premium-card-wrap" style="right: ${rightPos}px;">
                    <img src="${cardUrl}" class="premium-card" style="animation: ${animName} ${totalDuration}s infinite cubic-bezier(0.25, 1, 0.5, 1);">
                </div>`;
            }).join("");

            const stageWidth = ((N - 1) * 25) + 75;
            dynamicKeyframes += `</style>`;
            cardsHtml = `${dynamicKeyframes}<div class="premium-stage" style="width: ${stageWidth}px;">${cardImages}</div>`;
        }

        return `
        <div class="premium-notice" ${clickAction}>
            <!-- The Image Mask Background -->
            <div class="premium-bg" style="border-color: ${notice.borderColor}40;">
                <div class="premium-img" style="background-image: url('${notice.image}');"></div>
            </div>
            
            <!-- The Constrained Text Box -->
            <div class="premium-text-box">
                <div class="premium-badge" style="color: ${notice.borderColor};">${notice.category} • ${notice.date}</div>
                <div class="premium-title">${notice.title}</div>
                <div class="premium-desc">${notice.description}</div>
            </div>
            
            ${notice.action ? `<button class="premium-go">GO ➔</button>` : ''}
            
            <!-- The Uncaged Cards! -->
            ${cardsHtml}
        </div>
        `;
    }).join("");

    container.innerHTML = finalHtml;
}

// ✨ Helper function to easily open any special event div you create
function openEventDiv(divId) {
    // Close the notice board first
    document.getElementById('notice-modal').style.display = 'none';
    
    // Open the specific event modal
    const eventDiv = document.getElementById(divId);
    if (eventDiv) {
        eventDiv.style.display = 'flex';
    } else {
        showToast("Event coming soon!");
    }
}

function togglePUMaterial(index) {
    const pos = puSelectedMaterials.indexOf(index);
    if (pos > -1) {
        puSelectedMaterials.splice(pos, 1);
    } else {
        if (puSelectedMaterials.length >= 5) return showToast("Max 5 materials allowed!");
        puSelectedMaterials.push(index);
    }
    updatePUUI();
    renderPUInventory(); 
}

function autoSelectPU() {
    puSelectedMaterials = [];
    let available = [];
    
    user.inventory.forEach((card, index) => {
        const isFav = user.favoriteCard && user.favoriteCard.url === card.url && user.favoriteCard.grade === card.grade && user.favoriteCard.member === card.member;
        if (index !== puTargetIndex && !card.locked && !isCardEquipped(card) && !isFav) {
            available.push({ index: index, weight: GRADE_VALUES[card.grade] });
        }
    });

    available.sort((a, b) => a.weight - b.weight);

    for (let i = 0; i < Math.min(5, available.length); i++) {
        puSelectedMaterials.push(available[i].index);
    }

    if (puSelectedMaterials.length === 0) showToast("No valid materials available!");
    updatePUUI();
    renderPUInventory();
}

function closeUpgradeModal() {
    document.getElementById("upgrade-modal").style.display = "none";
    puTargetIndex = null;
    puSelectedMaterials = [];
    document.getElementById("superstar-collection-modal").style.display = "flex";
    renderSuperstarUI();
}

// ✨ UPGRADED: Handles Material Cards smoothly!
function getPUSuccessChance(targetGrade, matCard) {
    // If it's a material card, use its exact percentage!
    if (matCard.type === 'material') {
        let color = matCard.chance === 1.0 ? "#00f5d4" : matCard.chance >= 0.5 ? "#fee440" : "#ff0055";
        return { text: `${matCard.chance * 100}% MAT`, color: color, chance: matCard.chance };
    }

    let diff = GRADE_VALUES[matCard.grade] - GRADE_VALUES[targetGrade];
    if (diff >= 0) return { text: "HIGH", color: "#00f5d4", chance: 1.0 }; 
    if (diff === -1) return { text: "NORMAL", color: "#fee440", chance: 0.5 };
    if (diff === -2) return { text: "LOW", color: "#ffaa00", chance: 0.25 };
    if (diff === -3) return { text: "VERY LOW", color: "#ff0055", chance: 0.1 };
    return { text: "MINIMAL", color: "#94a3b8", chance: 0.05 };
}

// ✨ THE BIG ONE: Power Up AND Grade Ascension Engine!
function executeUpgrade() {
    if (puSelectedMaterials.length === 0) return;
    const targetCard = user.inventory[puTargetIndex];
    const maxLvl = getMaxLevel(targetCard.grade);
    
    // 🚨 DETECT GRADE UP STATE 🚨
    const isGradeUp = (targetCard.level >= maxLvl && targetCard.grade !== 'R');

    if (targetCard.level >= maxLvl && targetCard.grade === 'R') {
        return showToast("🌟 Card is at absolute MAX Level!");
    }

    let totalCost = 0;
    puSelectedMaterials.forEach(idx => {
        let mCard = user.inventory[idx];
        // Material cards cost a flat 1000 RP to apply, normal cards scale based on grade.
        if (mCard.type === 'material') totalCost += 1000;
        else totalCost += Math.floor(BASE_COSTS[mCard.grade] * COST_MULTIPLIERS[targetCard.grade]);
    });

    if (user.rp < totalCost) return showToast("Not enough RP!");

    user.rp -= totalCost;
    trackMissionProgress("powerup", 1);
    
    let levelsGained = 0;
    let didGradeUp = false;

    puSelectedMaterials.forEach(idx => {
        const matCard = user.inventory[idx];
        const chance = getPUSuccessChance(targetCard.grade, matCard).chance;
        
        // Roll the dice!
        if (Math.random() <= chance) {
            if (isGradeUp && !didGradeUp) {
                didGradeUp = true; // Prevents multiple grade ups in one click
            } else if (!isGradeUp && (targetCard.level || 1) + levelsGained < maxLvl) {
                levelsGained++;
            }
        }
    });

    // Apply the Results!
    if (didGradeUp) {
        const grades = ['C', 'B', 'A', 'S', 'R'];
        let nextGrade = grades[grades.indexOf(targetCard.grade) + 1];
        targetCard.grade = nextGrade;
        targetCard.level = 1; // Reset to level 1 of the new grade
        
        // Update the card's ID string to match the new grade
        targetCard.id = `${targetCard.group}_${targetCard.member}_${targetCard.theme}_${targetCard.grade}`.replace(/\s+/g, '_').toLowerCase();
        
    } else {
        if (!targetCard.level) targetCard.level = 1;
        targetCard.level += levelsGained;
    }

    // Destroy the consumed materials
    puSelectedMaterials.sort((a, b) => b - a).forEach(idx => {
        user.inventory.splice(idx, 1);
        if (idx < puTargetIndex) puTargetIndex--; 
    });

    puSelectedMaterials = [];
    updateUI();
    
    if (didGradeUp) {
        showToast(`🌟 ASCENSION! Card upgraded to Grade ${targetCard.grade}!`);
    } else if (levelsGained > 0) {
        showToast(`✨ SUCCESS! Card leveled up to Lv ${targetCard.level}!`);
    } else {
        showToast(`âŒ FAILED. The materials were consumed.`);
    }

    openUpgradeModal(puTargetIndex); 
}
      // 1. Ensure the interval variable is declared globally
      let bgRotationInterval = null;
      function buyInventorySlots() {
        if (user.diamonds < 50) return showToast("âš ï¸ Not enough Diamonds!");

        user.diamonds -= 50;
        if (!user.boughtSlots) user.boughtSlots = 0;
        user.boughtSlots += 50;

        showToast("✨ Inventory expanded by +50 slots!");
        updateUI();

        // Force refresh if the collection is currently open
        if (document.getElementById("superstar-collection-modal").style.display !== "none") {
          renderSuperstarUI();
        }
      }

// ✨ SAVES THE CARD AS YOUR ONE AND ONLY FAVORITE ✨
function setFavoriteCard() {
  if (currentlyViewingCardIndex === null || !user.inventory[currentlyViewingCardIndex]) return;
  
  // Save the specific card object to the user's profile
  user.favoriteCard = user.inventory[currentlyViewingCardIndex];
  
  showToast("â­ Card successfully set as your favorite!");
  
  // Close the modal and refresh UI to show it
  document.getElementById('card-detail-modal').style.display = 'none';
  updateUI();
}
      /* ✨ PARTICLE ENGINE ✨ */
      function initParticles() {
        for (let i = 0; i < 50; i++)
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2,
          });
      }
      function animate() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          ctx.fillStyle = "rgba(157, 78, 221, 0.4)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        requestAnimationFrame(animate);
      }
let noticeDatabase = [];
let profilePicDatabase = []; 

let pendingPfpUrl = "";

function simulateProcessing(actionCallback) {
  return withLoadingCircle(actionCallback, { delay: 120 });
}

function confirmProfilePic(url, member) {
    playClickSound();
    pendingPfpUrl = url; // Temporarily hold the url
    document.getElementById('confirm-pfp-img').src = url;
    document.getElementById('confirm-pfp-name').innerText = member;
    document.getElementById('pfp-confirm-modal').style.display = 'flex';
}

function executeSetProfilePic() {
    // Hide the confirmation modal instantly so it doesn't linger under the loader
    document.getElementById('pfp-confirm-modal').style.display = 'none';
    
    // Wrap the rest in the loader!
    simulateProcessing(() => {
        if (!user.profile) user.profile = {};
        user.profile.profilePic = pendingPfpUrl;
        
        // Save to Firebase securely
        if (uid && typeof db !== "undefined") {
            db.collection("users").doc(uid).update({ profile: user.profile });
        }

        showToast("✨ Avatar equipped successfully!");
        updateUI(); 
        renderProfilePics(); 
    });
}

function executeBuyProfilePic() {
    // Hide purchase modal instantly
    document.getElementById('pfp-purchase-modal').style.display = 'none';

    simulateProcessing(() => {
        if (!user.unlockedPFPs) user.unlockedPFPs = [];
        
        if (user.unlockedPFPs.includes(pendingPurchasePfpId)) {
            return showToast("You already own this avatar!");
        }

        if (user.rp < 20000) {
            return showToast("âš ï¸ Not enough RP! You need 20,000 RP.");
        }

        user.rp -= 20000;
        user.unlockedPFPs.push(pendingPurchasePfpId);
        
        if (uid && typeof db !== "undefined") {
            db.collection("users").doc(uid).update({
                rp: user.rp,
                unlockedPFPs: user.unlockedPFPs
            });
        }

        showToast(`✨ Successfully unlocked ${pendingPurchaseMember}'s Avatar!`);
        updateUI(); 
        renderProfilePics(); 
    });
}

// Remove 'currentPfpTab' variable, we don't need it anymore!

function openProfilePicModal() {
    const groups = [...new Set((profilePicDatabase || []).map(p => p.group))].sort();
    
    // We grab your old dropdown container
    const filterContainer = document.getElementById("pfp-group-select"); 

    // ✨ Build the new horizontal circle UI
    let groupFiltersHtml = `<div style="display: flex; gap: 15px; padding: 10px 5px; overflow-x: auto; width: 100%; scrollbar-width: none; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">`;
    
    // Add the "ALL" button (using a shiny star!)
    const allSelected = currentPfpFilterGroup === "ALL";
    groupFiltersHtml += `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; width: 70px; flex-shrink: 0; opacity: ${allSelected ? '1' : '0.5'}; transition: 0.3s;" onclick="filterProfilePics('ALL')">
        <div style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid ${allSelected ? '#ff0055' : 'rgba(255,255,255,0.6)'}; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
            <span style="font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🌟</span>
        </div>
        <span style="color: ${allSelected ? '#ff0055' : 'white'}; font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">ALL</span>
    </div>`;

    // Loop through your groups and add the logo circles!
    groups.forEach(g => {
        const isSelected = currentPfpFilterGroup === g;
        groupFiltersHtml += createGroupCircleBtn(g, isSelected, `filterProfilePics('${g}')`);
    });

    groupFiltersHtml += `</div>`;

    // Overwrite the dropdown with the new UI! 
    // (Note: outerHTML safely changes it from a <select> to a <div> automatically)
    if (filterContainer) {
        filterContainer.outerHTML = `<div id="pfp-group-select">${groupFiltersHtml}</div>`;
    }

    document.getElementById("profile-pic-modal").style.display = "flex";
    renderProfilePics(); // Render everything immediately
}
function renderGachaBatch(batch) {
    const drawGrid = document.getElementById("draw-stage-cards");
    if(!drawGrid) return;
    
    // Clear the stage for the new cards
    drawGrid.innerHTML = ""; 

    batch.forEach((c, i) => {
        let w = document.createElement("div");
        w.className = "card-wrapper";
        w.style.cursor = "pointer";

        // Safely generate the Cloudinary URL
        const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(c.url, c.grade, c.member, c.theme, c.group) : c.url;

        // Detect LE Status for the holographic foil
        const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
        const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
        const isLE = leThemes.includes(formatStr(c.theme));

        w.dataset.isLe = isLE;

        // Build the LE Foil Mask
        const foilOverlayHtml = isLE ? `
            <div class="le-foil-effect" style="
                -webkit-mask-image: url('${rawPhotoUrl}');
                -webkit-mask-size: contain;
                -webkit-mask-position: center;
                mask-image: url('${rawPhotoUrl}');
                mask-size: contain;
                mask-position: center;
            "></div>
        ` : "";

        // Build the Card HTML (Includes the smooth-load skeleton!)
        w.innerHTML = `
          <div class="card-container img-placeholder" style="border-radius: 8px;">
            <div class="card-face card-back"></div>
            <div class="card-face card-front" style="position: relative; border-radius: 8px; background: transparent; border: none;">
              <img class="smooth-load" src="${rawPhotoUrl}" onload="this.classList.add('loaded')" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px; pointer-events: none;">
              ${foilOverlayHtml}
            </div>
          </div>
        `;

        // ✨ The safe click function we added earlier!
        w.onclick = () => inspectGachaCard(c);

        drawGrid.appendChild(w);
    });
}

function renderSuperstarInspector(card) {
    

    // 1. Save the currently viewed card so it glows in the grid
    currentlyViewingCardIndex = card.originalIndex;
    renderSuperstarRight(); // Refresh grid to show glow

    // 2. Generate the beautiful Cloudinary URL
    const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;

    // 3. Detect LE Status for the inspector foil
    const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
    const formatStr = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    const isLE = leThemes.includes(formatStr(card.theme));

    const foilOverlayHtml = isLE ? `
        <div class="le-foil-effect" style="
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;
            -webkit-mask-image: url('${rawPhotoUrl}');
            -webkit-mask-size: contain;
            -webkit-mask-position: center;
            mask-image: url('${rawPhotoUrl}');
            mask-size: contain;
            mask-position: center;
        "></div>
    ` : "";

    const isEq = typeof isCardEquipped === 'function' ? isCardEquipped(card) : false;
    const isLocked = card.locked;
    const cardScore = typeof calculateCardScore === 'function' ? calculateCardScore(card) : "???";

    // 4. Inject the HTML into the side panel
    panel.innerHTML = `
        <div class="ss-inspector-header">
            <h2>CARD INFO</h2>
            <button class="ss-close-btn" onclick="closeInspector()">✕</button>
        </div>
        <div class="ss-inspector-content" style="display: flex; gap: 20px; padding: 20px;">
            
            <div style="flex: 1; max-width: 160px; cursor: pointer; position: relative; border-radius: 10px;" class="img-placeholder" onclick='inspectGachaCard(${JSON.stringify(card).replace(/'/g, "&#39;")})' title="Click for 3D View">
                <img class="smooth-load" src="${rawPhotoUrl}" onload="this.classList.add('loaded')" style="width: 100%; border-radius: 10px; display: block; pointer-events: none;">
                ${foilOverlayHtml}
            </div>

            <div style="flex: 2; display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <h3 style="margin: 0; font-size: 24px; color: white;">${card.member || "Unknown"}</h3>
                    <p style="margin: 5px 0 0 0; color: #aaa; font-size: 14px;">${(card.theme || "No Theme").replace(/_/g, " ")}</p>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #888;">Grade</span>
                    <span style="color: var(--grade-${normalizeFrameGrade(card.grade)}); font-weight: bold; font-size: 18px;">${card.grade || 'C'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Score</span>
                        <span style="color: white; font-weight: bold;">${cardScore}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: auto;">
                    <button onclick="toggleEquipCard(${card.originalIndex})" style="flex: 1; padding: 12px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; background: ${isEq ? '#ff4757' : '#2ed573'}; color: white; transition: 0.2s;">
                        ${isEq ? 'UNEQUIP' : 'EQUIP'}
                    </button>
                    <button onclick="toggleLockCard(${card.originalIndex})" style="padding: 12px 20px; border-radius: 6px; border: none; font-size: 18px; cursor: pointer; background: #333; color: white; transition: 0.2s;">
                        ${isLocked ? '🔓' : '🔒'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // 5. Slide the panel open!
    panel.classList.add("open");
}

function closeInspector() {
    const panel = document.getElementById("ss-inspector-panel");
    if (panel) panel.classList.remove("open");
    currentlyViewingCardIndex = null;
    renderSuperstarRight();
}
// ✨ 1. ADD THE MISSING GLOBAL VARIABLE ✨
let currentPfpFilterGroup = "ALL";

// ✨ 2. ADD THE CLICK HANDLER FOR THE CIRCLES ✨
function filterProfilePics(group) {
    currentPfpFilterGroup = group; // Update the state
    openProfilePicModal();         // Refresh the circles so the new one glows
    renderProfilePics();           // Refresh the avatars below
}

// ✨ 3. THE UPDATED MODAL OPENER ✨
function openProfilePicModal() {
    const groups = [...new Set((profilePicDatabase || []).map(p => p.group))].sort();
    
    // Grab the container
    const filterContainer = document.getElementById("pfp-group-select"); 

    // Build the new horizontal circle UI
    let groupFiltersHtml = `<div style="display: flex; gap: 15px; padding: 10px 5px; overflow-x: auto; width: 100%; scrollbar-width: none; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px;">`;
    
    // Add the "ALL" button
    const allSelected = currentPfpFilterGroup === "ALL";
    groupFiltersHtml += `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; width: 70px; flex-shrink: 0; opacity: ${allSelected ? '1' : '0.5'}; transition: 0.3s;" onclick="filterProfilePics('ALL')">
        <div style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid ${allSelected ? '#ff0055' : 'rgba(255,255,255,0.6)'}; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
            <span style="font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🌟</span>
        </div>
        <span style="color: ${allSelected ? '#ff0055' : 'white'}; font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">ALL</span>
    </div>`;

    // Loop through groups and add the logo circles
    groups.forEach(g => {
        const isSelected = currentPfpFilterGroup === g;
        groupFiltersHtml += createGroupCircleBtn(g, isSelected, `filterProfilePics('${g}')`);
    });

    groupFiltersHtml += `</div>`;

    // Overwrite the old container with the new UI
    if (filterContainer) {
        filterContainer.outerHTML = `<div id="pfp-group-select">${groupFiltersHtml}</div>`;
    }

    document.getElementById("profile-pic-modal").style.display = "flex";
    renderProfilePics();
}

// ✨ 4. THE UPDATED RENDERER (Reads the new variable instead of the old dropdown) ✨
function renderProfilePics() {
    const grid = document.getElementById("pfp-grid");
    
    // 👇 FIXED: Now uses our new variable!
    const groupFilter = currentPfpFilterGroup; 

    if (!profilePicDatabase || profilePicDatabase.length === 0) {
        grid.innerHTML = `<p style="color: gray; font-size: 12px; grid-column: 1/-1; text-align:center;">No profile data available.</p>`;
        return;
    }

    // Filter by Group
    let items = profilePicDatabase;
    if (groupFilter !== "ALL") {
        items = items.filter(p => p.group === groupFilter);
    }

    if (items.length === 0) {
        grid.innerHTML = `<p style="color: gray; font-size: 12px; grid-column: 1/-1; text-align:center;">No profile pictures found.</p>`;
        return;
    }

    if (!user.unlockedPFPs) user.unlockedPFPs = [];

    // Group items PER MEMBER
    const orderedMemberGroups = [];
    items.forEach(p => {
        let existingGroup = orderedMemberGroups.find(g => g.group === p.group && g.member === p.member);
        if (!existingGroup) {
            existingGroup = { group: p.group, member: p.member, avatars: [] };
            orderedMemberGroups.push(existingGroup);
        }
        existingGroup.avatars.push(p);
    });

    let html = "";

    // Render each Member with their own divider
    orderedMemberGroups.forEach(memberData => {
        const dividerText = groupFilter === "ALL" 
            ? `${memberData.group} — ${memberData.member}` 
            : memberData.member;

        html += `
        <div style="grid-column: 1 / -1; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.2); margin: 20px 0 10px 0; padding-bottom: 5px; text-align: left; font-weight: 900; color: white; letter-spacing: 2px; font-size: 14px; text-transform: uppercase;">
            ${dividerText}
        </div>`;

        // Sort avatars
        const typeWeight = { "FREE": 1, "BASIC": 2, "EVENT": 3 };
        memberData.avatars.sort((a, b) => typeWeight[a.type] - typeWeight[b.type]);

        memberData.avatars.forEach(pfp => {
            const pfpUrl = getProfilePicUrl(pfp.basePath); 
            
            if (!user.profile) user.profile = {};
            const isEquipped = user.profile.profilePic === pfpUrl;
            const isOwned = pfp.type === "FREE" || user.unlockedPFPs.includes(pfp.id);

            let actionAttr = "";
            let lockHtml = "";

            if (isOwned) {
                actionAttr = `onclick="confirmProfilePic('${pfpUrl}', '${pfp.member}')"`;
            } else if (pfp.type === "BASIC") {
                actionAttr = `onclick="confirmBuyProfilePic('${pfp.id}', '${pfp.member}', '${pfpUrl}')"`;
                lockHtml = `
                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; flex-direction: column; align-items:center; justify-content:center;">
                    <span style="font-size:18px; margin-bottom: 2px;">🔒</span>
                    <span style="font-size:8px; font-weight: bold; background: var(--primary-glow); color: black; padding: 2px 4px; border-radius: 4px;">20K RP</span>
                </div>`;
            } else {
                actionAttr = `onclick="showToast('🔒 EVENT EXCLUSIVE! Available only in limited packages.')"`;
                lockHtml = `
                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; flex-direction: column; align-items:center; justify-content:center;">
                    <span style="font-size:18px; margin-bottom: 2px;">🔒</span>
                    <span style="font-size:8px; font-weight: bold; background: var(--tertiary-glow); color: black; padding: 2px 4px; border-radius: 4px;">EVENT</span>
                </div>`;
            }
            
            let equipBorder = isEquipped 
                ? `border: 3px solid var(--secondary-glow); box-shadow: 0 0 15px var(--secondary-glow);` 
                : `border: 2px solid white; box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);`;

            // 👇 Added the custom onerror you requested earlier!
            html += `
            <div style="text-align: center; cursor: pointer; position: relative; width: 75px; height: 75px; margin: auto;" ${actionAttr} title="${pfp.member}">
                <img src="${pfpUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; ${equipBorder} transition: 0.2s;" onerror="this.outerHTML = '<div style=\\'font-size:8px; color:red; word-break:break-all; width:100%; height:100%; display:flex; align-items:center; justify-content:center; border:1px solid red; border-radius:10px; background:rgba(0,0,0,0.8); padding:5px;\\'>' + this.src + '</div>'">
                ${lockHtml}
            </div>`;
        });
    });

    grid.innerHTML = html;
}

let pendingPurchasePfpId = "";
let pendingPurchaseMember = "";

function confirmBuyProfilePic(pfpId, member, url) {
    playClickSound();
    pendingPurchasePfpId = pfpId;
    pendingPurchaseMember = member;
    
    // Set the image and text in the modal
    document.getElementById('purchase-pfp-img').src = url;
    document.getElementById('purchase-pfp-name').innerText = member;
    
    // Show the modal
    document.getElementById('pfp-purchase-modal').style.display = 'flex';
}

function executeBuyProfilePic() {
    playClickSound();
    if (!user.unlockedPFPs) user.unlockedPFPs = [];
    
    // Double check they don't already own it
    if (user.unlockedPFPs.includes(pendingPurchasePfpId)) {
        showToast("You already own this avatar!");
        document.getElementById('pfp-purchase-modal').style.display = 'none';
        return;
    }

    // Check RP balance
    if (user.rp < 20000) {
        showToast("âš ï¸ Not enough RP! You need 20,000 RP.");
        return;
    }

    // Process the transaction
    user.rp -= 20000;
    user.unlockedPFPs.push(pendingPurchasePfpId);
    
    // Save to Firebase immediately
    if (uid && typeof db !== "undefined") {
        db.collection("users").doc(uid).update({
            rp: user.rp,
            unlockedPFPs: user.unlockedPFPs
        });
    }

    showToast(`✨ Successfully unlocked ${pendingPurchaseMember}'s Avatar!`);
    
    // Close modal and refresh UI
    document.getElementById('pfp-purchase-modal').style.display = 'none';
    updateUI(); 
    renderProfilePics(); 
}

function setProfilePic(url) {
    if (!user.profile) user.profile = {};
    user.profile.profilePic = url;
    showToast("✨ Profile picture updated!");
    updateUI();
    document.getElementById("profile-pic-modal").style.display = "none";
}

      // 2. PASTE THE MISSING FUNCTION HERE
      function initSmoothModals() {
        document.querySelectorAll(".close-btn").forEach((btn) => {
          btn.removeAttribute("onclick");
          btn.addEventListener("click", function (e) {
            const modalOverlay = this.closest(".custom-modal-overlay") || this.closest(".modal-overlay");
            if (modalOverlay) {
              const modalInner = modalOverlay.querySelector(".custom-modal") || modalOverlay.children[0];
              modalOverlay.classList.add("anim-fade-out");
              if (modalInner) modalInner.classList.add("anim-pop-out");
              setTimeout(() => {
                modalOverlay.style.display = "none";
                modalOverlay.classList.remove("anim-fade-out");
                if (modalInner) modalInner.classList.remove("anim-pop-out");
                if (modalOverlay.id === "song-select-modal") {
                  const audio = document.getElementById("song-preview-audio");
                  if (audio) audio.pause();
                }
                if (modalOverlay.id === "superstar-collection-modal") currentlyViewingCardIndex = null;
              }, 200);
            }
          });
        });
      }
      function applyLobbyBackgrounds() {
  clearInterval(bgRotationInterval);
  
  // Failsafe: If no equipped wallpapers, pick a random free one from the API
  if (!user.equippedWallpapers || user.equippedWallpapers.length === 0) {
    if (typeof wallpaperDatabase !== 'undefined' && wallpaperDatabase.length > 0) {
      // Find all free wallpapers using the same API data as the equip UI
      const freeWallpapers = wallpaperDatabase.filter(bg => bg.currency === "free");
      if (freeWallpapers.length > 0) {
        // Pick a random free wallpaper
        const randomFree = freeWallpapers[Math.floor(Math.random() * freeWallpapers.length)];
        user.equippedWallpapers = [randomFree.id];
      } else {
        user.equippedWallpapers = [wallpaperDatabase[0].id];
      }
    } else {
      // Temporary fallback if the API hasn't loaded yet
      user.equippedWallpapers = ["H2H_01"]; 
    }
  }

  // Helper to grab the URL safely
  const getBgUrl = (id) => {
    if (typeof wallpaperDatabase === 'undefined' || wallpaperDatabase.length === 0) {
      return ""; // Returns empty if DB isn't loaded, preventing broken image links
    }
    const bg = wallpaperDatabase.find((w) => w.id === id);
    return bg ? bg.url : wallpaperDatabase[0].url;
  };

  let currentIndex = 0;
  // Pick a random background to start with from the equipped list
  currentIndex = Math.floor(Math.random() * user.equippedWallpapers.length);
  
  const bgUrl = getBgUrl(user.equippedWallpapers[currentIndex]);
  if (bgUrl) {
    document.body.style.backgroundImage = `url('${bgUrl}')`;
  }

  // If they have more than 1 equipped, rotate them every 15 seconds
  if (user.equippedWallpapers.length > 1) {
    bgRotationInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % user.equippedWallpapers.length;
      const nextBgUrl = getBgUrl(user.equippedWallpapers[currentIndex]);
      if (nextBgUrl) {
         document.body.style.backgroundImage = `url('${nextBgUrl}')`;
      }
    }, 15000);
  }
}
      
      // Helper to extract specific card coordinates from the API
function getCardPosData(member, theme) {
  if (typeof cardMap !== 'undefined' && member && theme) {
    const safeMember = member.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const memberRegex = new RegExp(`(^|[^a-zA-Z])${safeMember}([^a-zA-Z]|$)`, 'i');

    for (let cid in cardMap) {
      let m = cardMap[cid][0];
      if (m && memberRegex.test(m.name) && m.name.toUpperCase().includes(theme.toUpperCase())) {
        if (m.imagePos) {
          return m.imagePos;
        }
      }
    }
  }
  // Default fallback if no coordinates exist for some reason
  return { x: 0, y: 0, scale: 1 };
}

      // --- POPULATE DROPDOWNS ---
      function populateBgGroups() {
        const groups = [...new Set(wallpaperDatabase.map((w) => w.group))].sort();
        const optionsHTML =
          `<option value="ALL">ALL GROUPS</option>` + groups.map((g) => `<option value="${g}">${g}</option>`).join("");

        document.getElementById("shop-bg-group-select").innerHTML = optionsHTML;
        document.getElementById("equip-bg-group-select").innerHTML = optionsHTML;
      }

      // --- SHOP LOGIC ---
      let currentShopBgType = "BASIC";

      function refreshBgShop() {
        // Called when dropdown changes
        const activeBtn = document.querySelector(".bg-sub-tab.active");
        filterBgShop(currentShopBgType, activeBtn);
      }

      function filterBgShop(type, btnElement) {
        currentShopBgType = type;
        document.querySelectorAll(".bg-sub-tab").forEach((b) => b.classList.remove("active"));
        if (btnElement) btnElement.classList.add("active");

        if (!user.wallpapers) user.wallpapers = ["bg_default", "bg_basic_01"];
        if (!user.equippedWallpapers) user.equippedWallpapers = ["bg_basic_01"];

        const grid = document.getElementById("shop-wallpaper-grid");
        const selectedGroup = document.getElementById("shop-bg-group-select").value;

        // Filter by Type AND Group
        let items = wallpaperDatabase.filter((w) => w.type === type);
        if (selectedGroup !== "ALL") {
          items = items.filter((w) => w.group === selectedGroup);
        }

        if (items.length === 0) {
          grid.innerHTML = `<p style="color: gray; font-size: 12px; text-align: center; width: 100%; grid-column: 1 / -1;">No backgrounds found for this group/category.</p>`;
          return;
        }

        grid.innerHTML = items
          .map((bg) => {
            const isOwned = user.wallpapers.includes(bg.id);
            let btnHtml = "";

            if (isOwned) {
              btnHtml = `<button class="btn btn-draw" disabled style="padding: 8px; font-size: 10px; width: 100%; border-color: rgba(255,255,255,0.2); color: gray;">OWNED</button>`;
            } else {
              let costText =
                bg.currency === "free"
                  ? "FREE"
                  : `${bg.currency === "rp" ? "✦" : bg.currency === "diamond" ? "💎" : "🎫"} ${bg.cost.toLocaleString()}`;
              let colorClass = bg.currency === "diamond" ? "btn-live" : "btn-draw";
              btnHtml = `<button class="btn ${colorClass}" onclick="buyWallpaper('${bg.id}', ${bg.cost}, '${bg.currency}')" style="padding: 8px; font-size: 10px; width: 100%;">${costText}</button>`;
            }

            return `
            <div class="bg-item-container">
                <div class="bg-item">
                    <img src="${bg.url}">
                    <div class="bg-label">${bg.name}</div>
                </div>
                ${btnHtml}
            </div>`;
          })
          .join("");
      }

      // --- TOGGLE EQUIP STATUS ---
      function toggleWallpaperEquip(id) {
        // Ensure the array exists
        if (!user.equippedWallpapers) user.equippedWallpapers = [];

        const index = user.equippedWallpapers.indexOf(id);

        if (index > -1) {
          // Trying to unequip
          if (user.equippedWallpapers.length <= 1) {
            return showToast("âš ï¸ You must have at least 1 background equipped!");
          }
          user.equippedWallpapers.splice(index, 1);
        } else {
          // Trying to equip
          if (user.equippedWallpapers.length >= 25) {
            return showToast("âš ï¸ Maximum of 25 backgrounds equipped!");
          }
          user.equippedWallpapers.push(id);
        }

        // Save and refresh the UI instantly
        updateUI();
        renderBgEquipGrid();
        applyLobbyBackgrounds();
      }
      // --- EQUIP LOGIC ---
      function openBgEquipModal() {
        populateBgGroups(); // Load groups when opening modal
        document.getElementById("bg-equip-modal").style.display = "flex";
        renderBgEquipGrid();
      }

      function renderBgEquipGrid() {
        if (!user.equippedWallpapers) user.equippedWallpapers = [];
        document.getElementById("bg-equip-count").innerText = user.equippedWallpapers.length;

        const grid = document.getElementById("inventory-wallpaper-grid");
        const selectedGroup = document.getElementById("equip-bg-group-select").value;

        // Filter owned backgrounds by Group
        let ownedBgs = wallpaperDatabase.filter((w) => user.wallpapers.includes(w.id));
        if (selectedGroup !== "ALL") {
          ownedBgs = ownedBgs.filter((w) => w.group === selectedGroup);
        }

        if (ownedBgs.length === 0) {
          grid.innerHTML = `<p style="color: gray; font-size: 12px; text-align: center; width: 100%; grid-column: 1 / -1;">No owned backgrounds for this group.</p>`;
          return;
        }

        grid.innerHTML = ownedBgs
          .map((bg) => {
            const isEquipped = user.equippedWallpapers.includes(bg.id);
            return `
            <div class="bg-item ${isEquipped ? "equipped" : ""}" onclick="toggleWallpaperEquip('${bg.id}')">
                <img src="${bg.url}" onerror="this.src='https://jyp.com/240x135/111/fff?text=NO+IMAGE'">
                <div class="bg-equip-badge">EQUIPPED</div>
                <div class="bg-label">${bg.name}</div>
            </div>`;
          })
          .join("");
      }
      /* ✨ LOBBY SPARKLE INJECTOR ✨ */
      function spawnLobbySparkles() {
        const container = document.getElementById("lobby-sparkles");
        for (let i = 0; i < 30; i++) {
          let s = document.createElement("div");
          s.className = "css-sparkle";
          s.style.top = Math.random() * 100 + "%";
          s.style.left = Math.random() * 100 + "%";
          s.style.animationDuration = 1 + Math.random() * 3 + "s";
          s.style.animationDelay = Math.random() * 2 + "s";
          container.appendChild(s);
        }
      }

      /* ✨ R-GRADE BURST INJECTOR ✨ */
      function createRGradeBurst(cardWrapper) {
        for (let i = 0; i < 12; i++) {
          let s = document.createElement("div");
          s.className = "burst-sparkle";
          let angle = Math.random() * Math.PI * 2;
          let dist = 80 + Math.random() * 100; // Explode outward
          s.style.setProperty("--tx", Math.cos(angle) * dist + "px");
          s.style.setProperty("--ty", Math.sin(angle) * dist + "px");
          s.style.left = "50%";
          s.style.top = "50%";
          cardWrapper.appendChild(s);
          setTimeout(() => s.remove(), 1000);
        }
      }

      /* ✨ SETTINGS LOGIC ✨ */
      function applySettingsOnLoad() {
        document.getElementById("vol-bgm").value = globalBgmVolume;
        document.getElementById("vol-sfx").value = globalSfxVolume;
        document.getElementById("bgm").volume = globalBgmVolume;
        document.getElementById("song-preview-audio").volume = globalBgmVolume;

        if (isReduceTrans) {
          document.getElementById("toggle-transparency").checked = true;
          document.body.classList.add("reduce-transparency");
        }
      }

      function updateVolume(type, val) {
        if (type === "bgm") {
          globalBgmVolume = val;
          document.getElementById("bgm").volume = val;
          document.getElementById("song-preview-audio").volume = val;
          localStorage.setItem("shining_bgm_vol", val);
        } else if (type === "sfx") {
          globalSfxVolume = val;
          localStorage.setItem("shining_sfx_vol", val);
          playClickSound(); // Demo the sound
        }
      }

      function toggleTransparency(isChecked) {
        isReduceTrans = isChecked;
        localStorage.setItem("shining_reduce_trans", isChecked);
        if (isChecked) document.body.classList.add("reduce-transparency");
        else document.body.classList.remove("reduce-transparency");
      }

      /* ✨ UTILS ✨ */
      function resizeCanvas() {
        if (canvas) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
      }

      function showToast(message) {
        let toast = document.getElementById("toast");
        toast.innerText = message;
        toast.classList.add("show");
        setTimeout(() => {
          toast.classList.remove("show");
        }, 3000);
      }

      function playClickSound() {
        sfxClick.volume = globalSfxVolume;
        sfxClick.currentTime = 0;
        sfxClick.play().catch((e) => e);
      }

      document.addEventListener("click", function (e) {
        if (
          e.target.tagName === "BUTTON" ||
          e.target.classList.contains("glass-pill") ||
          e.target.classList.contains("action-icon-btn") ||
          e.target.classList.contains("nav-arrow") ||
          e.target.closest(".vault-item-img-container")
        ) {
          playClickSound();
        }
      });

      /* ✨ SECURE AUTH & DATA LOGIC ✨ */
function handleAuth() {
  // Pulling the exact value without altering the casing
  const userIdInput = document.getElementById("user-id").value.trim();
  const userPassInput = document.getElementById("user-pass").value.trim();

  if (!userIdInput) {
    showToast("âš ï¸ Please enter a valid UID!");
    return;
  }
  playClickSound();

  // STRICT RULE: If it's a different case, stick to the exact original case.
  // We do not cast this toLowerCase(). 
  uid = userIdInput; 

  db.collection("users")
    .doc(uid)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.passcode && data.passcode !== userPassInput) {
          showToast("âŒ Incorrect Password!");
          return; 
        }
        user = { ...user, ...data };
        completeLogin(userPassInput);
        if (!data.passcode) document.getElementById("setup-password-modal").style.display = "flex";
      } else {
        if (!userPassInput) return showToast("âš ï¸ Please enter a password for your NEW account!");

        user = {
          passcode: userPassInput, 
          rp: 50000, hp: 50, exp: 0, level: 1, mileage: 5, diamonds: 500,
          inventory: [], deck: {}, profile: {}, 
          missions: { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false },
          inbox: [{ id: Date.now().toString(), title: "Welcome to SHINING SUPERSTAR!", type: "pack", packType: "premium", amount: 3 }],
          isVIP: false, joinDate: new Date().toISOString(), lastLogin: new Date().toISOString(),
        };
        // Document ID is saved with exact casing
        db.collection("users").doc(uid).set(user);
        completeLogin(userPassInput);
        showToast("✨ New Account Created! +50,000 RP");
        checkInboxNoti();
      }
    }).catch((error) => {
      console.error("Firebase Error:", error);
      showToast("âš ï¸ Offline Mode: Data will not save.");
      completeLogin(userPassInput);
    });
}

/* ✨ CRASH-PROOF UPDATE UI ✨ */
function updateUI() {
  if (uid) localStorage.setItem("shining_uid", uid);
  if (!user.missions) user.missions = { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false };
  if (!user.profile) user.profile = {}; 

  // --- Profile Picture Update ---
  const defaultPfp = "https://ik.imagekit.io/shiningsuperstar/tr:lo-true:l-image,i-live@@resources@@live@@images@@card@@kep1er@@bubble_gum@@c_l_bubble_gum_dayeon.png,w-200,h-200,fo-face,r-max,lx-44,l-end/live/image.png"; 
  const currentPfp = user.profile.profilePic || defaultPfp;

  const headerPic = document.getElementById("header-profile-pic");
  const modalPic = document.getElementById("profile-modal-pic");
  if (headerPic) headerPic.src = currentPfp;
  if (modalPic) modalPic.src = currentPfp;

  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };

  // ✨ MAIN LOBBY CURRENCY
  setTxt("hp-val", (user.hp || 0).toLocaleString());
  setTxt("rp-val", (user.rp || 0).toLocaleString());
  setTxt("diamond-val", (user.diamonds || 0).toLocaleString());
  setTxt("exp-val", (user.exp || 0).toLocaleString());
  setTxt("mileage-val", (user.mileage || 0).toLocaleString());

  // ✨ FIX: SHOP CURRENCY SYNC ✨
  setTxt("shop-hp-val", (user.hp || 0).toLocaleString());
  setTxt("shop-rp-val", (user.rp || 0).toLocaleString());
  setTxt("shop-diamond-val", (user.diamonds || 0).toLocaleString());

  const expFill = document.getElementById("exp-fill");
  if (expFill) {
      let reqExp = (user.level || 1) * 1000;
      expFill.style.width = `${Math.min(((user.exp || 0) / reqExp) * 100, 100)}%`;
  }

  setTxt("profile-uid", uid || "GUEST");
  setTxt("profile-total-cards", (user.inventory || []).length);
  setTxt("display-uid", uid || "GUEST");

  if (user.favoriteCard) {
    document.getElementById("profile-fav-card").src = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(user.favoriteCard.url, user.favoriteCard.grade, user.favoriteCard.member, user.favoriteCard.theme, user.favoriteCard.group) : user.favoriteCard.url;
  }

  // ✨ THE FIREBASE FIX: Filter out undefined values before updating!
  if (uid && typeof db !== "undefined") {
    // Create a clean copy of the user object
    const cleanUser = JSON.parse(JSON.stringify(user, (key, value) => 
        value === undefined ? null : value
    ));

    db.collection("users")
      .doc(uid)
      .update(cleanUser)
      .catch((e) => console.log("Offline or Sync Error:", e));
  }
}
      function completeLogin(password) {
        if (password) localStorage.setItem("shining_pass", password); // Remember password for refresh

        document.getElementById("display-uid").innerText = uid;
        document.getElementById("auth-screen").style.display = "none";
        document
          .getElementById("bgm")
          .play()
          .catch((e) => console.log("BGM Autoplay blocked"));
trackMissionProgress("login", 1);
        updateUI();
        applyLobbyBackgrounds();
        showToast(`Welcome back, ${uid}!`);
        checkDailyReward(user.lastLogin);
        checkInboxNoti();
        initLobbyBanner(); // ✨ ADDED: Starts the banner rotation after login!
      }
      // Triggers when a Legacy User sets their new password
      function saveLegacyPassword() {
        const newPass = document.getElementById("new-setup-pass").value.trim();
        if (!newPass) return showToast("âš ï¸ Password cannot be empty!");

        user.passcode = newPass;
        localStorage.setItem("shining_pass", newPass); // Remember it for next time
        updateUI(); // Force syncs to Firebase

        document.getElementById("setup-password-modal").style.display = "none";
        showToast("🔒 Account successfully secured!");
      }

      function logout() {
        localStorage.removeItem("shining_uid");
        localStorage.removeItem("shining_pass"); // Clear password on logout
        window.location.reload();
      }

      

      

     // ✨ Drawer Animation Logic
function openMenuModal() {
    const overlay = document.getElementById('menu-drawer-overlay');
    const drawer = document.getElementById('menu-drawer');
    overlay.classList.add('open');
    setTimeout(() => { drawer.classList.add('open'); }, 10);
}

function closeMenuDrawer() {
    const overlay = document.getElementById('menu-drawer-overlay');
    const drawer = document.getElementById('menu-drawer');
    drawer.classList.remove('open');
    setTimeout(() => { overlay.classList.remove('open'); }, 300);
}

function openAttendanceLayout() {
    prepareAttendanceUI();
    document.getElementById('daily-reward-modal').style.display = 'flex';
}

// ✨ Renders the 7-Day Visual Track UI!
function prepareAttendanceUI() {
    const todayDate = new Date();
    const todayIndex = todayDate.getDay(); // 0 is Sunday, 1 is Mon...
    
    // Check if the user already claimed their reward today
    let alreadyClaimed = false;
    if (user.lastLogin) {
        const lastLoginDate = new Date(user.lastLogin);
        if (lastLoginDate.toDateString() === todayDate.toDateString()) {
            alreadyClaimed = true;
        }
    }

    // The weekly pattern exactly as you described!
    const weeklyPattern = [
        { day: "SUN", isWeekend: true,  icon: "💎/📦", reward: "5k RP<br>10 Dias<br>1 Card" }, // 0
        { day: "MON", isWeekend: false, icon: "✦",    reward: "5,000 RP" },                 // 1
        { day: "TUE", isWeekend: false, icon: "💎",    reward: "10 Dias" },                  // 2
        { day: "WED", isWeekend: false, icon: "📦",    reward: "1 Card" },                   // 3
        { day: "THU", isWeekend: false, icon: "✦",    reward: "5,000 RP" },                 // 4
        { day: "FRI", isWeekend: false, icon: "💎",    reward: "10 Dias" },                  // 5
        { day: "SAT", isWeekend: true,  icon: "💎/📦", reward: "5k RP<br>10 Dias<br>1 Card" }  // 6
    ];

    const container = document.getElementById("attendance-track-container");
    let trackHtml = "";

    // Generate the 7 cards
    for (let i = 0; i < 7; i++) {
        const p = weeklyPattern[i];
        
        let cardClass = "att-day-card";
        if (p.isWeekend) cardClass += " weekend";
        
        // Visual Status (Claimed, Today, or Locked)
        if (i < todayIndex || (i === todayIndex && alreadyClaimed)) {
            cardClass += " claimed";
        } else if (i === todayIndex && !alreadyClaimed) {
            cardClass += " today";
        }

        trackHtml += `
            <div class="${cardClass}">
                <div class="att-day-label">${p.day}</div>
                <div class="att-reward-icon">${p.icon}</div>
                <div class="att-reward-amt">${p.reward}</div>
            </div>
        `;
    }
    
    container.innerHTML = trackHtml;

    // Render the button
    const btnContainer = document.getElementById("attendance-btn-container");
    if (alreadyClaimed) {
        btnContainer.innerHTML = `<button class="btn btn-draw" style="width: 100%; padding: 15px; font-size: 16px; filter: grayscale(1); cursor: not-allowed;" disabled>REWARD CLAIMED</button>`;
    } else {
        btnContainer.innerHTML = `<button class="btn btn-live" style="width: 100%; padding: 15px; font-size: 16px;" onclick="withLoadingCircle(() => { claimDailyReward() })">CLAIM TODAY'S REWARD</button>`;
    }
}

// ✨ Update checkDailyReward to use the new UI rendering
function checkDailyReward(lastLoginStr) {
    if (!lastLoginStr) {
        prepareAttendanceUI();
        document.getElementById("daily-reward-modal").style.display = "flex";
        return;
    }
    const lastLogin = new Date(lastLoginStr);
    const today = new Date();
    if (lastLogin.toDateString() !== today.toDateString()) {
        prepareAttendanceUI();
        document.getElementById("daily-reward-modal").style.display = "flex";
        user.missions = { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false };
        updateUI();
    }
}

function claimDailyReward() {
  const today = new Date().getDay();
  const isWeekend = (today === 0 || today === 6);
  
  if (isWeekend) {
      user.rp += 5000;
      user.diamonds += 10;
      // Cards are sent to the inbox so the user gets the satisfying "open" animation
      showToast("🎁 Weekend Reward: 5,000 RP, 10 Dias, 1 Card!");
generateCards(1, "regular");
  } else {
      if (today === 1 || today === 4) { 
          user.rp += 5000;
          showToast("ðŸŽ Daily Reward: +5,000 RP");
      } else if (today === 2 || today === 5) { 
          user.diamonds += 10;
          showToast("ðŸŽ Daily Reward: +10 Diamonds");
      } else if (today === 3) { 
          showToast("🎁 Daily Reward: +1 Card!");
generateCards(1, "regular");
      }
  }

  user.lastLogin = new Date().toISOString();
  document.getElementById("daily-reward-modal").style.display = "none";
  updateUI();
}

      async function exchangeRP() {
        if (!user || user.rp < 1000) return showToast("Need 1000 RP to convert.");
        user.hp += 5;
        user.rp -= 1000;
        showToast("✨ Converted 1000 RP to 5 HP!");
        updateUI();
      }

      /* ✨ INBOX LOGIC ✨ */
      function checkInboxNoti() {
        const noti = document.getElementById("inbox-noti");
        if (user.inbox && user.inbox.length > 0) {
          noti.style.display = "flex";
          noti.innerText = user.inbox.length;
        } else {
          noti.style.display = "none";
        }
      }

      function openInbox() {
        document.getElementById("inbox-modal").style.display = "flex";
        renderInbox();
      }

     function getRewardDisplayStr(mail) {
    // Failsafe: Default to an amount of 1 if the mail is missing it
    let amt = mail.amount || 1;
    
    // Safely format the number only if it is actually a number!
    let formattedAmt = typeof amt === 'number' ? amt.toLocaleString() : amt;

    if (mail.type === "overflow_cards") return `📦 ${formattedAmt} Overflow Cards`;
    if (mail.type === "rp") return `✦ ${formattedAmt} RP`;
    if (mail.type === "hp") return `â¤ ${formattedAmt} HP`;
    if (mail.type === "diamond" || mail.type === "diamonds") return `💎 ${formattedAmt} Diamonds`;
    if (mail.type === "mileage") return `🎫 ${formattedAmt} Ticket`;
    if (mail.type === "vip") return `👑 VIP PASS`;
    if (mail.type === "pack") return `📦 ${mail.packType ? mail.packType.toUpperCase() : "CARD"} PACK x${formattedAmt}`;
    
    return `Gift Package`;
}
      function renderInbox() {
        const content = document.getElementById("inbox-content");
        if (!user.inbox || user.inbox.length === 0) {
          content.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">Inbox is empty.</p>`;
          return;
        }

        let html = "";
        user.inbox.forEach((mail) => {
          html += `
            <div class="inbox-item">
                <div>
                    <p style="font-weight:900; color:#fff; font-size:14px; margin-bottom:5px;">${mail.title}</p>
                    <p style="color:var(--secondary-glow); font-size:12px; font-weight:bold;">${getRewardDisplayStr(mail)}</p>
                </div>
                <button class="btn btn-live" style="flex:0 0 auto; min-width: 80px; font-size:10px; padding: 10px;" onclick="claimDynamicMail('${mail.id}')">CLAIM</button>
            </div>`;
        });
        content.innerHTML = html;
      }

      // 1. Update the claim function to pass the guaranteed grade to the gacha engine
      async function claimDynamicMail(mailId) {
        const mailIndex = user.inbox.findIndex((m) => m.id == mailId);
        if (mailIndex === -1) return;
        const mail = user.inbox[mailIndex];

        // 1. Handle Overflow Cards
        if (mail.type === "overflow_cards") {
          const availableSlots = getMaxInventorySlots() - user.inventory.length;

          if (availableSlots <= 0) {
            return showToast("âš ï¸ Inventory is completely full! Sell cards first.");
          }

          const cardsToClaim = mail.cards.splice(0, availableSlots);
          user.inventory.push(...cardsToClaim);

          if (mail.cards.length === 0) {
            user.inbox.splice(mailIndex, 1);
            showToast(`✨ Claimed ${cardsToClaim.length} overflow cards!`);
          } else {
            mail.amount = mail.cards.length;
            showToast(`✨ Claimed ${cardsToClaim.length} cards. ${mail.cards.length} left in inbox.`);
          }

          updateUI();
          renderInbox();
          return;
        }

       // 2. Handle Packs & Random Cards
        if (mail.type === "pack" || mail.type === "random_card") {
          previousModalId = "inbox-modal";
document.getElementById("inbox-modal").style.display = "none";
          user.inbox.splice(mailIndex, 1);
          updateUI();
          // ✨ FIX: Now we pass the target group and target theme from the mail!
          generateCards(mail.amount || 1, mail.packType || "regular", mail.grade, mail.group, mail.theme);
          return;
        }

        /// 3. Handle Standard Currency
        if (mail.type === "rp") user.rp += mail.amount;
        if (mail.type === "hp") user.hp += mail.amount;
        // 👇 Updated to give you the diamonds!
        if (mail.type === "diamond" || mail.type === "diamonds") user.diamonds += mail.amount;
        if (mail.type === "mileage") user.mileage += mail.amount;
        if (mail.type === "vip") user.isVIP = true;

        user.inbox.splice(mailIndex, 1);
        showToast(`✨ Claimed: ${mail.title}`);
        // FIX: Save inbox to Firebase so claimed items don't reappear on reload
        if (typeof uid !== 'undefined' && typeof db !== 'undefined') {
          db.collection("users").doc(uid).update({ inbox: user.inbox, rp: user.rp, hp: user.hp, diamonds: user.diamonds }).catch(err => console.log("Inbox save err:", err));
        }
        updateUI();
        renderInbox();
      }

      // 🎯 THE MISSION DATABASE 🎯
const missionDB = {
    daily: [
        { id: "d1", action: "login",   target: 1,  title: "Daily Check-In",    desc: "Log in to Shining Superstar.",              reward: { type: "rp",      amt: 5000,  icon: "✦",  color: "var(--rp-color)" } },
        { id: "d2", action: "play",    target: 3,  title: "Stage Rehearsal",   desc: "Clear 3 Live Stages.",                       reward: { type: "diamond", amt: 30,    icon: "💎", color: "var(--diamond-color)" } },
        { id: "d3", action: "powerup", target: 1,  title: "Growing Star",      desc: "Attempt to Power Up a card.",                reward: { type: "rp",      amt: 10000, icon: "✦",  color: "var(--rp-color)" } },
        { id: "d4", action: "pull",    target: 1,  title: "First Pull",        desc: "Open any card pack today.",                  reward: { type: "rp",      amt: 3000,  icon: "✦",  color: "var(--rp-color)" } },
        { id: "d5", action: "play",    target: 1,  title: "Warm-Up",           desc: "Clear 1 Live Stage.",                        reward: { type: "diamond", amt: 10,    icon: "💎", color: "var(--diamond-color)" } }
    ],
    weekly: [
        { id: "w1", action: "play",    target: 20, title: "World Tour",        desc: "Clear 20 Live Stages this week.",            reward: { type: "diamond", amt: 200,   icon: "💎", color: "var(--diamond-color)" } },
        { id: "w2", action: "pull",    target: 10, title: "Scouting Talent",   desc: "Open 10 Card Packs.",                        reward: { type: "pack",    amt: 1,     packType: "premium", icon: "📦", color: "#9d4edd" } },
        { id: "w3", action: "powerup", target: 10, title: "Power Grind",       desc: "Attempt 10 Power Ups.",                      reward: { type: "diamond", amt: 100,   icon: "💎", color: "var(--diamond-color)" } },
        { id: "w4", action: "play",    target: 5,  title: "Encore!",           desc: "Clear 5 stages on HARD difficulty.",         reward: { type: "rp",      amt: 50000, icon: "✦",  color: "var(--rp-color)" } },
        { id: "w5", action: "pull",    target: 30, title: "Talent Scout",      desc: "Open 30 Card Packs total.",                  reward: { type: "diamond", amt: 150,   icon: "💎", color: "var(--diamond-color)" } }
    ],
    monthly: [
        { id: "m1", action: "play",    target: 100, title: "Superstar Status", desc: "Clear 100 Live Stages this month.",          reward: { type: "diamond", amt: 1000,  icon: "💎", color: "var(--diamond-color)" } },
        { id: "m2", action: "powerup", target: 50,  title: "Max Potential",    desc: "Attempt 50 Power Ups.",                      reward: { type: "vip",     amt: 1,     icon: "👑",  color: "var(--tertiary-glow)" } },
        { id: "m3", action: "pull",    target: 100, title: "Whale Mode",       desc: "Open 100 Card Packs this month.",            reward: { type: "pack",    amt: 3,     packType: "premium", icon: "📦", color: "#9d4edd" } },
        { id: "m4", action: "play",    target: 50,  title: "Stage Monster",    desc: "Clear 50 Live Stages on NORMAL or above.",   reward: { type: "diamond", amt: 500,   icon: "💎", color: "var(--diamond-color)" } }
    ],
    event_list: [
        { id: "ev_special",  title: "Special Mission Event",      tag: "Week 1", banner: "https://jyp.com/800x200/117A8B/fff?text=Special+Mission+Event" },
        { id: "ev_starpass", title: "Limited Theme Star Pass",    tag: "HOT",    banner: "https://jyp.com/800x200/333/fff?text=Limited+Theme+Star+Pass", isDirectLink: true, action: "openStarPass" }
    ],
    ev_special: [
        { isHeader: true, title: "Mission 1", desc: "Play stages and clear missions!" },
        { id: "ev_s1", action: "play",    target: 1,  title: "Song Clear",       desc: "Clear any stage 1 time.",                        reward: { type: "pack", packType: "regular", label: "B Card",        amt: 1,  icon: "🃏" } },
        { id: "ev_s2", action: "play",    target: 5,  title: "Stage Pro",        desc: "Clear 5 stages total.",                          reward: { type: "pack", packType: "premium", label: "Premium Pack",   amt: 3,  icon: "📦" } },
        { isHeader: true, title: "Mission 2", desc: "Collect cards!" },
        { id: "ev_s3", action: "pull",    target: 1,  title: "First Obtain",     desc: "Obtain at least 1 card from any pack.",          reward: { type: "pack", packType: "regular", label: "A Card",        amt: 1,  icon: "🃏" } },
        { id: "ev_s4", action: "pull",    target: 10, title: "Card Collector",   desc: "Obtain 10 cards total.",                         reward: { type: "pack", packType: "premium", label: "10 Premium",    amt: 10, icon: "📦" } },
        { isHeader: true, title: "Mission 3", desc: "Power up your cards!" },
        { id: "ev_s5", action: "powerup", target: 3,  title: "Power Session",    desc: "Attempt Power Up 3 times.",                      reward: { type: "pack", packType: "all_R",   label: "R Card",        amt: 1,  icon: "🃏" } }
    ],
    starpass: [
        { id: "sp1", action: "play",    target: 5,  title: "Pass: Live Shows",  desc: "Clear 5 Live Stages.",  reward: { type: "PassEXP", amt: 50, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp2", action: "pull",    target: 5,  title: "Pass: Collector",   desc: "Open 5 Card Packs.",    reward: { type: "PassEXP", amt: 50, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp3", action: "powerup", target: 3,  title: "Pass: Power Up",    desc: "Power Up 3 cards.",     reward: { type: "PassEXP", amt: 30, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp4", action: "login",   target: 7,  title: "Pass: Attendance",  desc: "Log in 7 days.",        reward: { type: "PassEXP", amt: 100,icon: "🌟", color: "var(--tertiary-glow)" } }
    ]
};
let currentMissionTab = "daily";

// Opens the Hub
function openMissionsModal() {
    if (!user.missionProgress) user.missionProgress = {};
    if (!user.missionClaimed) user.missionClaimed = {};
    
    document.getElementById("missions-modal").style.display = "flex";
    switchMissionTab(currentMissionTab);
}

function switchMissionTab(tabId) {
    currentMissionTab = tabId;
    
    document.querySelectorAll(".m-tab").forEach(t => t.classList.remove("active"));
    document.querySelector(`.m-tab[onclick*="'${tabId}'"]`)?.classList.add("active");

    const container = document.getElementById("mission-list-container");

    // ✨ RENDER MULTIPLE EVENT BANNERS ✨
    if (tabId === 'event') {
        const events = missionDB.event_list || [];
        if (events.length === 0) {
            container.innerHTML = `<p style="color: gray; text-align: center; margin-top: 40px;">No events active right now.</p>`;
            return;
        }

        container.innerHTML = events.map(ev => {
            // Some banners (like Star Pass) might just open another modal directly
            let clickAction = ev.isDirectLink ? `withLoadingCircle(() => { ${ev.action}() })` : `openEventDetail('${ev.id}')`;
            
            return `
            <div class="ev-list-banner" style="background-image: url('${ev.banner}');" onclick="${clickAction}">
                <div class="ev-list-tag">${ev.tag}</div>
            </div>
            `;
        }).join("");
        return;
    }

    // ✨ DEFAULT RENDERER FOR DAILY/WEEKLY/MONTHLY ✨
    const missions = missionDB[tabId];
    if (!missions || missions.length === 0) {
        container.innerHTML = `<p style="color: gray; text-align: center; margin-top: 40px;">No missions available right now.</p>`;
        return;
    }

    container.innerHTML = missions.map(m => {
        let progress = user.missionProgress[m.id] || 0;
        if (progress > m.target) progress = m.target;
        
        let isClaimed = user.missionClaimed[m.id];
        let isReady = progress >= m.target;
        
        let btnHtml = "";
        let cardClass = isClaimed ? "claimed" : "";

        if (isClaimed) {
            btnHtml = `<button class="btn m-btn btn-draw" disabled>CLAIMED</button>`;
        } else if (isReady) {
            btnHtml = `<button class="btn m-btn btn-live" onclick="executeClaimMission('${tabId}', '${m.id}')" style="box-shadow: 0 0 15px ${m.reward.color};">CLAIM</button>`;
        } else {
            btnHtml = `<button class="btn m-btn btn-draw" disabled style="opacity: 0.5;">LOCKED</button>`;
        }

        let percent = (progress / m.target) * 100;

        return `
        <div class="m-card ${cardClass}" style="border-left: 4px solid ${m.reward.color};">
            <div class="m-reward-box">
                <div class="m-reward-icon">${m.reward.icon}</div>
                <div class="m-reward-amt" style="color: ${m.reward.color};">${m.reward.type === 'pack' || m.reward.type === 'vip' ? 'x' : '+'}${m.reward.amt}</div>
            </div>
            <div class="m-info">
                <div class="m-title">${m.title}</div>
                <div class="m-desc">${m.desc}</div>
                <div class="m-progress-wrap">
                    <div class="m-progress-bg"><div class="m-progress-fill" style="width: ${percent}%;"></div></div>
                    <div class="m-progress-txt">${progress}/${m.target}</div>
                </div>
            </div>
            ${btnHtml}
        </div>
        `;
    }).join("");
}

// ✨ NEW: Renders the long screenshot layout for a specific event ✨
function openEventDetail(eventId) {
    const container = document.getElementById("mission-list-container");
    const missions = missionDB[eventId];

    if (!missions) return;

    let html = `
    <button class="ev-back-btn" onclick="switchMissionTab('event')">◀ BACK TO EVENTS</button>
    
    <div class="ev-banner">
        <div>
            <div class="ev-banner-title">Various rewards will be provided</div>
            <div class="ev-banner-subtitle">upon completing<br>every mission!</div>
        </div>
        <div class="ev-banner-rewards">
            <img src="https://jyp.com/150x200/111/fff?text=R+CARD">
            <img src="https://jyp.com/150x200/111/fff?text=R+CARD">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4edd; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; margin-left: 5px; cursor: pointer; text-align: center; line-height: 1.2;">See<br>Bg</div>
        </div>
    </div>
    `;

    html += missions.map(m => {
        // Render Section Headers (Mission 1, Mission 2, etc.)
        if (m.isHeader) {
            return `
            <div class="ev-section-title">${m.title}</div>
            <div class="ev-section-desc">${m.desc}</div>
            `;
        }

        // Render Standard Mission Rows
        let progress = user.missionProgress[m.id] || 0;
        if (progress > m.target) progress = m.target;
        
        let percent = (progress / m.target) * 100;
        let isClaimed = user.missionClaimed[m.id];
        let isReady = progress >= m.target;

        let rowClass = isClaimed ? "claimed" : (isReady ? "ready" : "");
        let rowClick = isReady && !isClaimed ? `onclick="executeClaimMission('${eventId}', '${m.id}')"` : `onclick="showToast('Mission in progress!')"`;

        return `
        <div class="ev-row v2 ${rowClass}" ${rowClick}>
            <div class="ev-reward-wrap left">
                <div class="ev-reward-icon" style="background:${m.reward.color || 'rgba(255,255,255,0.08)'};">${m.reward.icon}</div>
                <div class="ev-reward-text"><span>${m.reward.label || m.reward.type}</span><strong>${m.reward.amt}</strong></div>
            </div>
            <div class="ev-info">
                <div class="ev-title">${m.title}</div>
                <div class="ev-desc">${m.desc}</div>
                <div class="ev-progress-bar">
                    <div class="ev-progress-fill" style="width: ${percent}%;"></div>
                    <div class="ev-progress-text">${progress} / ${m.target}</div>
                </div>
            </div>
            <div class="ev-arrow" aria-hidden="true">›</div>
        </div>
        `;
    }).join("");

    container.innerHTML = html;
}
// Claims the Loot
function executeClaimMission(tabId, missionId) {
    const mission = missionDB[tabId].find(m => m.id === missionId);
    if (!mission) return;

    user.missionClaimed[missionId] = true;
    
    const r = mission.reward;

    // Distribute Loot
    if (r.type === "rp") user.rp += r.amt;
    if (r.type === "diamond") user.diamonds += r.amt;
    if (r.type === "mileage") user.mileage += r.amt;
    if (r.type === "vip") user.isVIP = true;
    
    // Star Pass EXP Handling
    if (r.type === "PassEXP") {
        if (!user.starPass) user.starPass = { level: 1, exp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
        user.starPass.exp += r.amt;
        let reqPassExp = user.starPass.level * 100;
        if (user.starPass.exp >= reqPassExp) {
            user.starPass.exp -= reqPassExp;
            user.starPass.level += 1;
            setTimeout(() => showToast(`🌟 STAR PASS LEVEL UP! Now Lv ${user.starPass.level}`), 2500);
        }
    }

    // Send Items to Inbox
    if (r.type === "pack" || r.type === "LE_CARD") {
    generateCards(r.amt || 1, r.packType || "premium", r.grade || null);
}

    showToast(`✨ Mission Complete! Claimed ${r.amt} ${r.type}`);
    updateUI();
    switchMissionTab(tabId); // Refresh the list
}

// 📡 THE INVISIBLE TRACKER 📡
// Call this function anywhere in your code to advance a mission!
function trackMissionProgress(actionType, amount = 1, context = {}) {
    if (!user.missionProgress) user.missionProgress = {};
    if (!user.missionClaimed) user.missionClaimed = {};

    let uiNeedsUpdate = false;

    // Scan the entire database for missions that match the action
    Object.values(missionDB).flat().forEach(m => {
        let isMatch = false;
        
        if (m.action === actionType) {
            // Event Specific logic (e.g., must play Aespa)
            if (m.action === "play_group") {
                if (context.group && context.group.toLowerCase() === m.targetGroup.toLowerCase()) isMatch = true;
            } else {
                isMatch = true; // Normal mission match
            }
        }

        // Advance the progress bar!
        if (isMatch) {
            if (!user.missionProgress[m.id]) user.missionProgress[m.id] = 0;
            if (user.missionProgress[m.id] < m.target) {
                user.missionProgress[m.id] += amount;
                
                // Show a pop-up if they just finished it!
                if (user.missionProgress[m.id] >= m.target && !user.missionClaimed[m.id]) {
                    setTimeout(() => showToast(`✅ Mission Ready to Claim: ${m.title}!`), 1000);
                }
                uiNeedsUpdate = true;
            }
        }
    });

    // Save to Firebase silently
    if (uiNeedsUpdate && uid && typeof db !== "undefined") {
        db.collection("users").doc(uid).update({ missionProgress: user.missionProgress });
    }
}

      /* ✨ GACHA ENGINE ✨ */
      let currentGachaBatchIndex = 0;
      let fullPulledCardList = [];

      function buyPack(type, times, cost, currency, qty = 1) {
    let actualCost = Math.floor(cost * qty * (user.isVIP ? 0.8 : 1.0));
    let totalCardsToGenerate = times * qty;

    if (currency === "rp") {
        if (user.rp < actualCost) return showToast("⚠️ Not enough RP!");
        user.rp -= actualCost;
    } else if (currency === "hp") {
        if (user.hp < actualCost) return showToast("⚠️ Not enough HP!");
        user.hp -= actualCost;
    } else if (currency === "diamond") {
        if (user.diamonds < actualCost) return showToast("⚠️ Not enough Diamonds!");
        user.diamonds -= actualCost;
    }

    if (!user.missions) user.missions = { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false };
    user.missions.pulls += totalCardsToGenerate;

    trackMissionProgress("pull", totalCardsToGenerate);
    updateUI();

    // ✨ Close the shop immediately so the gacha feels instant
    const shopModal = document.getElementById("shop-modal");
    if (shopModal) shopModal.style.display = "none";

    // ✨ Trigger the gacha right away — no delay
    generateCards(totalCardsToGenerate, type);
}

function generateCards(times, packType, guaranteedGrade, targetGroup, targetTheme) {
    // ✨ Show the overlay instantly before anything else
    const overlay = document.getElementById("gacha-fullscreen-overlay");
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("active"), 10);


    fullPulledCardList = [];
    currentGachaBatchIndex = 0;
    // ... rest of your existing generateCards code unchanged
    document.querySelector(".hud-bottom-dock").style.opacity = "0";
    document.querySelector(".hud-bottom-dock").style.pointerEvents = "none";

    const groups = Object.keys(themeDatabase || {});
    
    for (let i = 0; i < times; i++) {
        let grade = "C";

        // ✨ Array Support for mixed packs (like the R + 2 A cards pack)
        if (Array.isArray(guaranteedGrade)) {
            grade = guaranteedGrade[i] || guaranteedGrade[guaranteedGrade.length - 1];
        } else if (guaranteedGrade) {
            grade = guaranteedGrade;
        } else if (packType === "all_R") {
            grade = "R";
        } else {
            let r = Math.random();
            if (packType === "premium" || packType === "event_premium") grade = r > 0.95 ? "R" : r > 0.8 ? "S" : r > 0.5 ? "A" : "B";
            else grade = r > 0.98 ? "R" : r > 0.9 ? "S" : r > 0.75 ? "A" : r > 0.5 ? "B" : "C";
        }

        let group = "UNKNOWN", member = "UNKNOWN", theme = "BASE";
        
        if (packType === "event_specific" && targetGroup && targetTheme) {
            group = targetGroup;
            theme = targetTheme;
            const dbGroup = themeDatabase[group] || themeDatabase[group.toLowerCase()] || themeDatabase[group.toUpperCase()] || { members: ["UNKNOWN"] };
console.log("DEBUG: group =", group);
console.log("DEBUG: themeDatabase[group] =", themeDatabase[group]);
console.log("DEBUG: member will be =", dbGroup.members);
member = dbGroup.members[Math.floor(Math.random() * dbGroup.members.length)];
        } 
        else if (packType === "event_premium" && targetGroup && targetTheme && Math.random() < 0.20) {
            group = targetGroup;
            theme = targetTheme;
            const dbGroup = themeDatabase[group] || themeDatabase[group.toLowerCase()] || themeDatabase[group.toUpperCase()] || { members: ["UNKNOWN"] };
            member = dbGroup.members[Math.floor(Math.random() * dbGroup.members.length)];
        }
        else if (packType === "le_guaranteed") {
            grade = "R"; 
            let leValidGroups = groups.filter(g => themeDatabase[g].le_themes && themeDatabase[g].availability && themeDatabase[g].le_themes.some(t => themeDatabase[g].availability[t] && themeDatabase[g].availability[t].in_pool === "le"));
            if (leValidGroups.length > 0) {
                group = leValidGroups[Math.floor(Math.random() * leValidGroups.length)];
                const dbGroup = themeDatabase[group];
                const activeLEThemes = dbGroup.le_themes.filter(t => dbGroup.availability[t] && dbGroup.availability[t].in_pool === "le");
                theme = activeLEThemes[Math.floor(Math.random() * activeLEThemes.length)];
                member = dbGroup.members[Math.floor(Math.random() * dbGroup.members.length)];
            }
        } 
        else {
            let validGroups = groups.filter(g => themeDatabase[g].availability && Object.values(themeDatabase[g].availability).some(tData => tData.in_pool === true));
            if (validGroups.length > 0) {
                group = validGroups[Math.floor(Math.random() * validGroups.length)];
                const dbGroup = themeDatabase[group];
                let allThemes = (dbGroup.themes || []).concat(dbGroup.le_themes || []);
                let pullableThemes = allThemes.filter(t => dbGroup.availability[t] && dbGroup.availability[t].in_pool === true);
                if (pullableThemes.length > 0) {
                    theme = pullableThemes[Math.floor(Math.random() * pullableThemes.length)];
                    member = dbGroup.members[Math.floor(Math.random() * dbGroup.members.length)];
                }
            }
        }

        if (group === "UNKNOWN" || !theme || !member) { group = "aespa"; theme = "Rich Man"; member = "KARINA"; }
        fullPulledCardList.push({ grade, group, member, theme, url: "dynamic", locked: false, level: 1 });
    } 

    if (!user.inventory) user.inventory = [];
    let overflowCards = [];

    fullPulledCardList.forEach((card) => {
        if (getUsedInventorySlots() < getMaxInventorySlots()) user.inventory.push(card);
        else overflowCards.push(card);
    });

    if (overflowCards.length > 0) {
        user.inbox.push({ id: Date.now().toString() + "_overflow", title: "Overflow Cards", type: "overflow_cards", cards: overflowCards, amount: overflowCards.length });
        if (typeof showToast === 'function') showToast(`⚠️ Inventory Full! ${overflowCards.length} cards sent to Inbox.`);
        if (typeof checkInboxNoti === 'function') checkInboxNoti();
    }

    // ✨ Push newly generated cards immediately to Firebase!
    if (typeof uid !== 'undefined' && typeof db !== 'undefined') {
        db.collection("users").doc(uid).update({ inventory: user.inventory, inbox: user.inbox }).catch(err => console.log(err));
    }

    if (typeof updateUI === 'function') updateUI();
    renderGachaBatch();
}

    

      function nextGachaBatch() {
        currentGachaBatchIndex++;
        renderGachaBatch();
      }

      function closeGachaStage() {
    const overlay = document.getElementById("gacha-fullscreen-overlay");
    overlay.classList.remove("active");

    // Reset overlay styles changed during LE showcase
    overlay.style.background = "";
    overlay.style.transition = "";

    // Reset the grid layout
    const drawGrid = document.getElementById("draw-stage-cards");
    if (drawGrid) {
        drawGrid.style.display = "";
        drawGrid.style.justifyContent = "";
        drawGrid.style.alignItems = "";
        drawGrid.style.gap = "";
        drawGrid.style.flexWrap = "";
    }

    setTimeout(() => {
        overlay.style.display = "none";
        if (drawGrid) drawGrid.innerHTML = "";
        document.querySelector(".hud-bottom-dock").style.opacity = "1";
        document.querySelector(".hud-bottom-dock").style.pointerEvents = "auto";
        document.getElementById("gacha-finish-btn").style.display = "none";
        document.getElementById("gacha-next-btn").style.display = "none";

        // ✨ Re-open wherever the player was
        if (previousModalId) {
            const prevModal = document.getElementById(previousModalId);
            if (prevModal) prevModal.style.display = "flex";
            previousModalId = null;
        }
    }, 500);
}
      


      function switchShopTab(tabName) {
    document.querySelectorAll(".shop-tab").forEach((btn) => btn.classList.remove("active"));
    let activeTabBtn = document.getElementById("tab-btn-" + tabName);
    if (activeTabBtn) activeTabBtn.classList.add("active");

    // Hide all tabs
    const allTabs = ['home', 'event', 'premium', 'wallpaper', 'blackmarket'];
    allTabs.forEach(t => {
        const el = document.getElementById("shop-tab-" + t);
        if (el) el.style.display = "none";
    });

    // Show the selected tab
    const selectedEl = document.getElementById("shop-tab-" + tabName);
    if (selectedEl) selectedEl.style.display = "block";

    if (tabName === "wallpaper") {
      try {
        populateBgGroups();
        let firstSubTab = document.querySelector(".bg-sub-tab");
        filterBgShop("BASIC", firstSubTab);
      } catch (error) {
        console.error("Wallpaper load error:", error);
      }
    }
}

// Make sure it opens to HOME and starts the carousel!
function openShopModal() {
    document.getElementById("shop-modal").style.display = "flex";
    switchShopTab('home');
    startShopCarousel();
    setTimeout(injectEventPointBadges, 100); // ✨ inject point badges after DOM renders
}

// ✨ EVENT POINT BADGE INJECTOR ✨
// Reads data-packtype on any buySpecialEventPack button and stamps a points badge on it
function injectEventPointBadges() {
    const PACK_LABELS = {
        'PROFILE':    { pts: EVENT_POINT_REWARDS['PROFILE'],    label: 'One-time',  color: '#a855f7' },
        'A_CARD':     { pts: EVENT_POINT_REWARDS['A_CARD'],     label: '+15 pts',   color: '#22d3ee' },
        'R_PACK':     { pts: EVENT_POINT_REWARDS['R_PACK'],     label: '+70 pts',   color: '#f97316' },
        'PREMIUM_10': { pts: EVENT_POINT_REWARDS['PREMIUM_10'], label: '+35 pts',   color: '#facc15' },
    };

    // Find every button/element that calls buySpecialEventPack
    document.querySelectorAll('[onclick*="buySpecialEventPack"]').forEach(el => {
        // Don't double-stamp
        if (el.querySelector('.ep-badge')) return;

        // Extract packType from the onclick string e.g. buySpecialEventPack('A_CARD', ...)
        const match = el.getAttribute('onclick').match(/buySpecialEventPack\(['"](\w+)['"]/);
        if (!match) return;
        const packType = match[1];
        const info = PACK_LABELS[packType];
        if (!info) return;

        const badge = document.createElement('div');
        badge.className = 'ep-badge';
        badge.style.cssText = `
            display: inline-block;
            background: ${info.color};
            color: #000;
            font-size: 10px;
            font-weight: 900;
            padding: 2px 7px;
            border-radius: 20px;
            margin-top: 4px;
            letter-spacing: 0.5px;
            white-space: nowrap;
            pointer-events: none;
        `;
        badge.classList.add('ep-badge-v2');
        badge.style.cssText = `
            position: absolute; top: 8px; left: 8px;
            background: ${info.color}; color: #000;
            font-size: 10px; font-weight: 900;
            padding: 3px 9px; border-radius: 999px;
            letter-spacing: 0.5px; white-space: nowrap;
            pointer-events: none; z-index: 5;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;
        badge.innerHTML = packType === 'PROFILE'
            ? '<i class="g g-star"></i> One-time'
            : `+${info.pts} pts`;

        // Append inside the button or after it
        if (el.tagName === 'BUTTON' || el.tagName === 'DIV') {
            el.style.position = 'relative';
            el.appendChild(badge);
        }
    });

    // Also render a progress bar if user already has event points for this context
    document.querySelectorAll('[data-event-group][data-event-theme]').forEach(container => {
        const group = container.dataset.eventGroup;
        const theme = container.dataset.eventTheme;
        const key = group + '_' + theme;
        const rawPts = Number((user.eventPoints && user.eventPoints[key]) || 0);
        const pts = rawPts >= EVENT_POINT_GOAL ? rawPts % EVENT_POINT_GOAL : rawPts;
        const pct = Math.min((pts / EVENT_POINT_GOAL) * 100, 100);

        let bar = container.querySelector('.ep-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'ep-progress-bar';
            bar.style.cssText = `
                margin: 10px 0 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 20px;
                height: 8px;
                overflow: hidden;
                position: relative;
            `;
            bar.innerHTML = `
                <div class="ep-fill" style="
                    height: 100%;
                    border-radius: 20px;
                    background: linear-gradient(90deg, #ff0055, #facc15);
                    transition: width 0.5s ease;
                    width: ${pct}%;
                "></div>
            `;
            const label = document.createElement('div');
            label.className = 'ep-pts-label';
            label.style.cssText = 'font-size:11px; color:#facc15; font-weight:900; margin-bottom:6px; text-align:right;';
            label.innerText = `${pts} / ${EVENT_POINT_GOAL} Event Points to next R reward`;
            container.insertBefore(label, container.firstChild);
            container.insertBefore(bar, container.firstChild);
        } else {
            const fill = bar.querySelector('.ep-fill');
            if (fill) fill.style.width = pct + '%';
            const label = container.querySelector('.ep-pts-label');
            if (label) label.innerText = `${pts} / ${EVENT_POINT_GOAL} Event Points to next R reward`;
        }
    });
}
      
      function buyWallpaper(id, cost, currency) {
        if (currency === "rp" && user.rp < cost) return showToast("âš ï¸ Not enough RP!");
        if (currency === "diamond" && user.diamonds < cost) return showToast("âš ï¸ Not enough Diamonds!");
        if (currency === "mileage" && user.mileage < cost) return showToast("âš ï¸ Not enough Mileage!");

        if (currency === "rp") user.rp -= cost;
        if (currency === "diamond") user.diamonds -= cost;
        if (currency === "mileage") user.mileage -= cost;

        if (!user.wallpapers) user.wallpapers = ["H2H_01"];
        user.wallpapers.push(id);

        showToast("✨ Background Purchased!");
        updateUI();
        const activeSubTab = document.querySelector(".bg-sub-tab.active");
        filterBgShop(currentShopBgType, activeSubTab);
      }

      function buyShopItem(item) {
        if (item === "VIP_PASS") {
          if (user.mileage < 100) return showToast("Not enough Mileage!");
          if (user.isVIP) return showToast("You are already VIP!");
          user.mileage -= 100;
          user.isVIP = true;
          showToast("👑 VIP PASS PURCHASED! Welcome to the Elite Club.");
        } else if (item === "S_TICKET") {
          if (user.rp < 50000) return showToast("Not enough RP!");
          user.rp -= 50000;
          user.inbox.push({
            id: Date.now().toString(),
            title: "Blackmarket S-Ticket Delivery",
            type: "random_card",
            grade: "S",
            amount: 1,
          });
          showToast(`✨ Bought S-Ticket! Check your Inbox.`);
        }
        updateUI();
      }

      /* ✨ OFFICIAL SUPERSTAR UI LOGIC ✨ */
let currentSsGroupIndex = 0;
      let currentlyViewingCardIndex = null;
      let currentlyViewingGhost = null; // ✨ ADD THIS LINE!
      let ssGroupFilterActive = false;
      let ssSelectedMember = null;

      /* ✨ SMART THEME LEVEL CALCULATOR ✨ */
      /* ✨ BULLETPROOF DECK MATH & RENDERING ✨ */
      function getThemeLevelInfo(groupName) {
        const groupKey = Object.keys(user.deck || {}).find(
          (k) => k.toLowerCase() === (groupName || "").toLowerCase().trim(),
        );
        if (!themeDatabase[groupName] || !user.deck || !groupKey) {
          return { level: 0, themeName: "-" };
        }

        const officialMembers = themeDatabase[groupName].members;
        const groupSize = officialMembers.length;
        const deck = user.deck[groupKey];

        const themeCounts = {};
        let dominantTheme = "Mixed Deck";
        let maxCount = 0;

        officialMembers.forEach((m) => {
          const memberKey = Object.keys(deck).find((k) => k.toLowerCase() === (m || "").toLowerCase().trim());
          if (memberKey && deck[memberKey] && deck[memberKey].theme) {
            const themeName = deck[memberKey].theme;
            themeCounts[themeName] = (themeCounts[themeName] || 0) + 1;
            if (themeCounts[themeName] > maxCount) {
              maxCount = themeCounts[themeName];
              dominantTheme = themeName;
            }
          }
        });

        let level = 0;
        if (maxCount === groupSize && groupSize > 0) level = 3;
        else if (maxCount >= 2) {
          if (groupSize <= 4 && maxCount >= 3) level = 2;
          else if (groupSize === 5 && maxCount >= 4) level = 2;
          else if (groupSize >= 6 && groupSize <= 7 && maxCount >= 5) level = 2;
          else if (groupSize >= 8 && maxCount >= 6) level = 2;
          else if (groupSize <= 5 && maxCount >= 2) level = 1;
          else if (groupSize >= 6 && groupSize <= 7 && maxCount >= 3) level = 1;
          else if (groupSize >= 8 && maxCount >= 4) level = 1;
        }

        return { level: level, themeName: level > 0 ? dominantTheme : "Mixed Deck" };
      }

      function renderSuperstarDeck(group) {
    const grid = document.getElementById("ss-deck-grid");
    const officialMembers = themeDatabase[group].members;
    if (!user.deck) user.deck = {};

    const groupKey = Object.keys(user.deck).find((k) => k.toLowerCase() === (group || "").toLowerCase().trim());
    const groupDeck = (groupKey && user.deck[groupKey]) ? user.deck[groupKey] : {};

    const themeInfo = getThemeLevelInfo(group);
    let combinedThemes = [];
    if (themeDatabase[group].themes) combinedThemes = combinedThemes.concat(themeDatabase[group].themes);
    if (themeDatabase[group].le_themes) combinedThemes = combinedThemes.concat(themeDatabase[group].le_themes);
    const selectedTheme = themeInfo.level > 0 ? themeInfo.themeName : combinedThemes[0];
    let equippedCount = 0;
          let deckTotalLevel = 0; // ✨

    // Detect if LE Theme for aspect ratio
    const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
    const formatStr = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    const isLETheme = leThemes.includes(formatStr(selectedTheme));
    const activeRatio = isLETheme ? "270 / 360" : "2.5 / 3.5";

    const memberCount = officialMembers.length;
    let cardWidth = "90px"; 
    let gapSize = "15px";
    let maxGridWidth = "100%"; 

    // ✨ The Cleaned Up Math ✨
    if (memberCount <= 4) {
        cardWidth = "105px"; gapSize = "20px"; 
    } else if (memberCount === 5) {
        cardWidth = "95px"; gapSize = "20px"; maxGridWidth = "400px"; 
    } else if (memberCount === 6) {
        cardWidth = "90px"; gapSize = "18px"; maxGridWidth = "380px"; 
    } else if (memberCount === 7) {
        cardWidth = "85px"; gapSize = "15px"; maxGridWidth = "440px"; 
    } else if (memberCount === 8 || memberCount === 9) {
        cardWidth = "80px"; gapSize = "12px"; maxGridWidth = memberCount === 8 ? "420px" : "500px"; 
    } else if (memberCount >= 10) {
        cardWidth = "75px"; gapSize = "10px";
        if (memberCount === 10) {
            maxGridWidth = "480px"; // 5 top, 5 bottom
        } else if (memberCount === 11 || memberCount === 12) {
            maxGridWidth = "515px"; // ✨ 6 top, 5 bottom (Fixes LOONA!)
        } else if (memberCount >= 13) {
            maxGridWidth = "600px"; // ✨ 7 top, 6 bottom (Fixes SEVENTEEN)
        }
    }

    grid.style.gap = gapSize;
    grid.style.maxWidth = maxGridWidth;
    grid.style.margin = "0 auto"; 

    // Generate the cards (Only doing this ONCE now!)
    grid.innerHTML = officialMembers.map((m, index) => {
        const memberKey = Object.keys(groupDeck).find((k) => k.toLowerCase() === (m || "").toLowerCase().trim());
        const card = memberKey ? groupDeck[memberKey] : null;
        const delay = (index * 0.04).toFixed(2);
        
        const baseStyle = `border-radius: 8px; padding: 4px; width: ${cardWidth}; flex-shrink: 0; cursor: pointer; transition: 0.2s; opacity: 0; animation: ssCardCascade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${delay}s; aspect-ratio: ${activeRatio};`;

        if (card) {
          equippedCount++;
          deckTotalLevel += (card.level || 1); // ✨ NEW: Adds the card's level!
          return `<div style="${baseStyle}" onclick="openSlotInspector('${group}', '${m}')">${createCardHTML(card, true, null)}</div>`;
        
        } else {
          const ghostUrl = getGhostCardUrl(group, m, selectedTheme);
          return `
            <div style="${baseStyle}" onclick="openSlotInspector('${group}', '${m}')">
                <div class="ss-card ghost" style="border: 1px dashed rgba(255,255,255,0.2); background: transparent; aspect-ratio: ${activeRatio} !important;">
                    <img src="${ghostUrl}" style="opacity: 0.8; object-fit: contain;">
                </div>
            </div>`;
        }
    }).join("");

    document.getElementById("ss-deck-count").innerText = `${equippedCount} / ${officialMembers.length}`;

    if (themeInfo.level > 0) {
      document.getElementById("ss-theme-level").innerText = `Lv ${themeInfo.level} THEME`;
      document.getElementById("ss-active-theme").innerText = themeInfo.themeName;
      document.getElementById("ss-active-theme").style.color = "var(--secondary-glow)";
    } else {
      document.getElementById("ss-theme-level").innerText = "NO THEME";
      document.getElementById("ss-active-theme").innerText = "-";
      document.getElementById("ss-active-theme").style.color = "#FFC600";
    }
          
          // ✨ NEW: Injects the total deck level indicator!
    let levelElement = document.getElementById("ss-deck-level-display");
    if (!levelElement) {
        const gradeContainer = document.getElementById("ss-group-grade").parentNode;
        levelElement = document.createElement("div");
        levelElement.id = "ss-deck-level-display";
        levelElement.style.cssText = "color: var(--rp-color); font-size: 11px; font-weight: bold; margin-top: 5px; letter-spacing: 1px;";
        gradeContainer.appendChild(levelElement);
    }
    levelElement.innerText = `DECK LEVEL: ${deckTotalLevel}`;
}
    
    // ✨ 1. THE SECURE SLOT ROUTER
      function openSlotInspector(group, member) {
          if (!user.deck) user.deck = {};
          const groupKey = Object.keys(user.deck).find(k => k.toLowerCase() === group.toLowerCase().trim());
          let equippedCard = null;
          let memberKey = null;

          if (groupKey && user.deck[groupKey]) {
              memberKey = Object.keys(user.deck[groupKey]).find(k => k.toLowerCase() === member.toLowerCase().trim());
              if (memberKey) equippedCard = user.deck[groupKey][memberKey];
          }

          if (equippedCard) {
              // ✨ BUG FIX: Strictly enforces member & group matching so it NEVER opens an unrelated card!
              const invIndex = user.inventory.findIndex(c => 
                  c.url === equippedCard.url && 
                  c.grade === equippedCard.grade && 
                  (c.level || 1) === (equippedCard.level || 1) &&
                  (c.member || "").toLowerCase() === member.toLowerCase()
              );
              
              if (invIndex !== -1) {
                  currentlyViewingCardIndex = invIndex;
                  currentlyViewingGhost = null;
              } else {
                  // Failsafe: If the card was sold but stuck in the deck, clear it and show the ghost!
                  if (groupKey && memberKey) delete user.deck[groupKey][memberKey];
                  currentlyViewingCardIndex = null;
                  currentlyViewingGhost = { group, member };
              }
          } else {
              // No card equipped!
              currentlyViewingCardIndex = null;
              currentlyViewingGhost = { group, member };
          }
          
          // Auto-sync the left panel to the correct group
          const groups = Object.keys(themeDatabase || {}).sort();
          const groupIdx = groups.findIndex(g => g.toLowerCase() === group.toLowerCase());
          if (groupIdx !== -1) currentSsGroupIndex = groupIdx;

          renderSuperstarUI();
      }

      // ✨ 2. THE GHOST INSPECTOR UI
      function renderGhostInspector() {
          const panel = document.getElementById("ss-right-inspector-view");
          panel.className = "anim-slide-left";
          panel.style.display = "flex";
          panel.style.flexDirection = "column";
          panel.style.height = "100%";
          panel.style.padding = "20px";

          const group = currentlyViewingGhost.group;
          const member = currentlyViewingGhost.member;

          const themeInfo = getThemeLevelInfo(group);
          let combinedThemes = [];
          if (themeDatabase[group] && themeDatabase[group].themes) combinedThemes = combinedThemes.concat(themeDatabase[group].themes);
          if (themeDatabase[group] && themeDatabase[group].le_themes) combinedThemes = combinedThemes.concat(themeDatabase[group].le_themes);
          
          const selectedTheme = themeInfo.level > 0 ? themeInfo.themeName : (combinedThemes[0] || "BASE");
          const ghostUrl = getGhostCardUrl(group, member, selectedTheme);

          // Fix aspect ratio for LEs
          const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
          const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
          const isLE = leThemes.includes(formatStr(selectedTheme));
          const activeRatio = isLE ? "270 / 360" : "2.5 / 3.5";

          panel.innerHTML = `
          <div style="width: 100%; display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: auto; height: 40px;">
              <button style="width: 40px !important; height: 40px !important; flex: 0 0 40px; font-size: 20px; border: 1px solid rgba(255,0,85,0.5); color: #ff0055; border-radius: 10px; background: rgba(255,0,85,0.1); cursor: pointer; transition: 0.2s;" onclick="closeCardDetail()" onmouseover="this.style.background='rgba(255,0,85,0.3)'" onmouseout="this.style.background='rgba(255,0,85,0.1)'" title="Close Inspector">✖</button>
          </div>
          <div style="display: flex; gap: 20px; width: 100%; align-items: center; justify-content: center; margin: 30px 0;">
              <div style="flex: 1; max-width: 160px; position: relative;">
                  <div class="ss-card ghost" style="border: 2px dashed rgba(255,255,255,0.2); background: transparent; aspect-ratio: ${activeRatio}; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                      <img src="${ghostUrl}" style="opacity: 0.5; object-fit: contain; width: 100%; height: 100%;">
                  </div>
              </div>
              <div style="flex: 1.2; display: flex; flex-direction: column; gap: 12px;">
                  <div style="background: rgba(10, 5, 20, 0.8); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                      <h2 style="font-weight: 900; font-size: 20px; color: #fff; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px;">${member}</h2>
                      <p style="color: gray; font-size: 11px; margin-bottom: 12px;">NO CARD EQUIPPED</p>
                      <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                          <span style="font-size: 11px; color: white; font-weight: bold; letter-spacing: 1px;">SCORE</span>
                          <span style="font-size: 15px; color: gray; font-weight: 900;">0</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                          <span style="font-size: 11px; color: white; font-weight: bold; letter-spacing: 1px;">HEARTS</span>
                          <span style="font-size: 15px; color: gray; font-weight: 900;">0</span>
                      </div>
                  </div>
              </div>
          </div>
          <div style="display:flex; flex-direction: column; gap: 10px; width: 100%; margin-top: auto;">
              <button class="btn btn-live" style="width: 100%; padding: 15px; font-size: 14px; font-weight: bold;" onclick="findCardsForGhost('${member}')">FIND CARDS TO EQUIP</button>
          </div>
          `;
      }

      // ✨ 3. THE "FIND CARDS" BUTTON ROUTER
      function findCardsForGhost(member) {
          currentlyViewingGhost = null; // Close the inspector
          openMemberInventory(member);  // Swap to the grid, pre-filtered for this idol!
      }
function openMemberInventory(member) {
    ssSelectedMember = member;
    renderSuperstarUI();
}
      function toggleVault() {
        const modal = document.getElementById("superstar-collection-modal");
        if (modal.style.display === "flex") {
          // Smooth Close
          modal.classList.add("anim-fade-out");
          modal.children[0].classList.add("anim-pop-out");
          setTimeout(() => {
            modal.style.display = "none";
            modal.classList.remove("anim-fade-out");
            modal.children[0].classList.remove("anim-pop-out");
          }, 200);
        } else {
          // Smooth Open
          modal.style.display = "flex";
          currentlyViewingCardIndex = null;
          currentlyViewingGhost = null; // ✨ Add this!
          renderSuperstarUI();
        }
      }
function closeCardDetail() {
        const panel = document.getElementById("ss-right-inspector-view"); 
        panel.classList.remove("anim-slide-left");
        panel.classList.add("anim-slide-out");

        setTimeout(() => {
          panel.classList.remove("anim-slide-out");
          currentlyViewingCardIndex = null;
          currentlyViewingGhost = null; // ✨ Clears the ghost!
          renderSuperstarUI();
        }, 200);
      }

      function navSuperstarGroup(dir) {
        const groups = Object.keys(themeDatabase || {}).sort();
        if (groups.length === 0) return;
        currentSsGroupIndex = (currentSsGroupIndex + dir + groups.length) % groups.length;
        currentlyViewingCardIndex = null;
        renderSuperstarUI();
      }

      function toggleGroupFilter() {
        ssGroupFilterActive = !ssGroupFilterActive;
        const btn = document.getElementById("btn-toggle-group-filter");
        if (ssGroupFilterActive) {
          btn.innerText = "FILTER: ALL GROUPS";
          btn.style.background = "var(--secondary-glow)";
          btn.style.color = "#000";
        } else {
          btn.innerText = "FILTER: CURRENT GROUP";
          btn.style.background = "transparent";
          btn.style.color = "var(--secondary-glow)";
        }
        renderSuperstarUI();
      }

      function openCardDetail(index) {
        const card = user.inventory[index];
        // ✨ AUTO-SYNC: When you click a card, force the left panel to jump to that artist!
        if (card && card.group) {
          const groups = Object.keys(themeDatabase || {}).sort();
          const groupIdx = groups.indexOf(card.group);
          if (groupIdx !== -1) currentSsGroupIndex = groupIdx;
        }

        currentlyViewingCardIndex = index;
        renderSuperstarUI();
      }

      function renderSuperstarRight(groupFilter) {
    const grid = document.getElementById("ss-inv-grid");
    const sort = document.getElementById("ss-sort-select")?.value || "gradeDown";
    const filter = document.getElementById("ss-filter-select")?.value || "ALL";

    if (!user || !user.inventory) return;

    let list = user.inventory.map((c, i) => ({ ...c, originalIndex: i }));

    // 1. Focus Overrides
    if (currentlyViewingCardIndex !== null) {
      const viewedCard = user.inventory[currentlyViewingCardIndex];
      list = list.filter((c) => c.group === viewedCard.group && c.member === viewedCard.member);
    } else if (ssSelectedMember) {
      list = list.filter(
        (c) =>
          (c.group || "").toLowerCase() === (groupFilter || "").toLowerCase() && c.member === ssSelectedMember,
      );
      document.getElementById("btn-clear-member").style.display = "block";
    } else {
      document.getElementById("btn-clear-member").style.display = "none";
      if (ssGroupFilterActive && groupFilter) {
        list = list.filter((c) => (c.group || "").toLowerCase() === (groupFilter || "").toLowerCase());
      }
    }

    // 2. Grade Filter
    if (["R", "S", "A", "B", "C"].includes(filter)) {
      list = list.filter((c) => c.grade === filter);
    }

    document.getElementById("ss-inv-count").innerText = `${getUsedInventorySlots()} / ${getMaxInventorySlots()}`;

    // 3. Sorting
    list.sort((a, b) => {
      const aEquipped = isCardEquipped(a);
      const bEquipped = isCardEquipped(b);
      if (aEquipped !== bEquipped) return bEquipped - aEquipped;
      const gradeVals = { R: 5, S: 4, A: 3, B: 2, C: 1 };
      if (sort === "gradeDown") return gradeVals[b.grade] - gradeVals[a.grade];
      if (sort === "gradeUp") return gradeVals[a.grade] - gradeVals[b.grade];
      return b.originalIndex - a.originalIndex;
    });

    // 4. Render (✨ FIXED: Now safely uses openCardDetail! ✨)
    grid.innerHTML = list
      .map((c, index) => {
        const isEq = isCardEquipped(c);
        const isSelected = c.originalIndex === currentlyViewingCardIndex;
        const selectionGlow = isSelected
          ? "box-shadow: 0 0 15px rgba(0, 245, 212, 0.8); transform: translateY(-3px); border-color: var(--secondary-glow);"
          : "";

        return `
        <div class="ss-card img-placeholder ${isEq ? "equipped" : ""}" style="${selectionGlow}" onclick="openCardDetail(${c.originalIndex})">
            <img class="smooth-load" src="${typeof getSmallCardUrl === 'function' ? getSmallCardUrl(c.url, c.grade, c.member, c.theme, c.group) : c.url}" onload="this.classList.add('loaded')" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;">
            ${c.locked ? `<div class="ss-lock">🔒</div>` : ""}
        </div>`;
      })
      .join("");
}
          function getMaxInventorySlots() {
            let base = 300;
            if (user.level >= 30) base = 1000;
            else if (user.level >= 20) base = 700;
            else if (user.level >= 10) base = 450;

            // Add any extra slots the user bought from the shop
            return base + (user.boughtSlots || 0);
          }

          /* ✨ THEME SELECTOR MODAL LOGIC ✨ */
          function openThemeSelectorModal() {
            const groups = Object.keys(themeDatabase || {}).sort();
            const activeGroup = groups.length > 0 ? groups[currentSsGroupIndex] : null;
            if (!activeGroup) return showToast("Select a group first!");

            const container = document.getElementById("theme-rows-container");
            let themes = [];
            if (themeDatabase[activeGroup].themes) themes = themes.concat(themeDatabase[activeGroup].themes);
            if (themeDatabase[activeGroup].le_themes) themes = themes.concat(themeDatabase[activeGroup].le_themes);
            const officialMembers = themeDatabase[activeGroup].members;

            let html = "";
            themes.forEach((theme) => {
              let cardsHtml = "";

              // Get the best card the user owns for each member in this specific theme (Case-insensitive)
              officialMembers.forEach((m) => {
                const ownedCards = user.inventory.filter(
                  (c) =>
                    c && // ✨ CRITICAL FIX: Safely ignores any null/ghost slots in inventory!
                    (c.group || "").toLowerCase().trim() === (activeGroup || "").toLowerCase().trim() &&
                    (c.member || "").toLowerCase().trim() === (m || "").toLowerCase().trim() &&
                    (c.theme || "").toLowerCase().trim() === (theme || "").toLowerCase().trim(),
                );

                if (ownedCards.length > 0) {
                  ownedCards.sort(
                    (a, b) => weights[normalizeFrameGrade(b.grade).toUpperCase()] * 100 + (b.level || 1) - (weights[normalizeFrameGrade(a.grade).toUpperCase()] * 100 + (a.level || 1)),
                  );
                  const bestCard = ownedCards[0];
                  cardsHtml += `<div style="width: 70px; flex-shrink: 0; position: relative;">${createCardHTML(bestCard, false, null)}</div>`;
                } else {
                  // Show Ghost Silhouette if they don't own it
                  const ghostUrl = getGhostCardUrl(activeGroup, m, theme);
                  cardsHtml += `
                <div style="width: 70px; flex-shrink: 0;">
                    <div class="ss-card ghost" style="border: 1px dashed rgba(255,255,255,0.2); background: transparent;">
                        <img src="${ghostUrl}" style="opacity: 0.5;">
                    </div>
                </div>`;
                }
              });

              html += `
        <div style="border: 1px solid rgba(216, 17, 89, 0.5); border-radius: 12px; padding: 15px; background: rgba(216, 17, 89, 0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 900; color: white; font-size: 15px;">${theme}</span>
                <button class="btn btn-draw" style="flex: 0 0 auto; min-width: auto; padding: 6px 15px; font-size: 11px; border-color: #d81159; border-radius: 20px; text-transform: none;" onclick="equipThemeCards('${activeGroup}', '${theme}')">Equip theme</button>
            </div>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none;">
                ${cardsHtml}
            </div>
        </div>`;
            });

            container.innerHTML = html;
            document.getElementById("theme-selector-modal").style.display = "flex";
          }

         /* ✨ THEME SELECTOR MODAL LOGIC ✨ */
          function openThemeSelectorModal() {
            // ✨ THE FIX: The magical formatter that ignores spaces, cases, and underscores!
            const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");

            const groups = Object.keys(themeDatabase || {}).sort();
            const activeGroup = groups.length > 0 ? groups[currentSsGroupIndex] : null;
            if (!activeGroup) return showToast("Select a group first!");

            const container = document.getElementById("theme-rows-container");
            let themes = [];
            if (themeDatabase[activeGroup].themes) themes = themes.concat(themeDatabase[activeGroup].themes);
            if (themeDatabase[activeGroup].le_themes) themes = themes.concat(themeDatabase[activeGroup].le_themes);
            const officialMembers = themeDatabase[activeGroup].members;

            let html = "";
            themes.forEach((theme) => {
              let cardsHtml = "";

              officialMembers.forEach((m) => {
                // ✨ Use the formatter to safely compare the inventory against the database
                const ownedCards = user.inventory.filter(
                  (c) =>
                    c &&
                    formatStr(c.group) === formatStr(activeGroup) &&
                    formatStr(c.member) === formatStr(m) &&
                    formatStr(c.theme) === formatStr(theme)
                );

                if (ownedCards.length > 0) {
                  ownedCards.sort(
                    (a, b) => weights[normalizeFrameGrade(b.grade).toUpperCase()] * 100 + (b.level || 1) - (weights[normalizeFrameGrade(a.grade).toUpperCase()] * 100 + (a.level || 1)),
                  );
                  const bestCard = ownedCards[0];
                  cardsHtml += `<div style="width: 70px; flex-shrink: 0; position: relative;">${createCardHTML(bestCard, false, null)}</div>`;
                } else {
                  // Show Ghost Silhouette if they don't own it
                  const ghostUrl = getGhostCardUrl(activeGroup, m, theme);
                  cardsHtml += `
                <div style="width: 70px; flex-shrink: 0;">
                    <div class="ss-card ghost" style="border: 1px dashed rgba(255,255,255,0.2); background: transparent;">
                        <img src="${ghostUrl}" style="opacity: 0.5;">
                    </div>
                </div>`;
                }
              });

              html += `
        <div style="border: 1px solid rgba(216, 17, 89, 0.5); border-radius: 12px; padding: 15px; background: rgba(216, 17, 89, 0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 900; color: white; font-size: 15px;">${theme}</span>
                <button class="btn btn-draw" style="flex: 0 0 auto; min-width: auto; padding: 6px 15px; font-size: 11px; border-color: #d81159; border-radius: 20px; text-transform: none;" onclick="equipThemeCards('${activeGroup}', '${theme}')">Equip theme</button>
            </div>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none;">
                ${cardsHtml}
            </div>
        </div>`;
            });

            container.innerHTML = html;
            document.getElementById("theme-selector-modal").style.display = "flex";
          }

          function equipThemeCards(group, theme) {
            // ✨ The formatter must be here too so the equip button works!
            const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
            
            const officialMembers = themeDatabase[group].members;
            if (!user.deck) user.deck = {};
            if (!user.deck[group]) user.deck[group] = {};

            let equippedAny = false;

            officialMembers.forEach((m) => {
              // ✨ Formatted comparison ensures LE themes get equipped flawlessly
              const ownedCards = user.inventory.filter(
                (c) =>
                  c && 
                  formatStr(c.group) === formatStr(group) &&
                  formatStr(c.member) === formatStr(m) &&
                  formatStr(c.theme) === formatStr(theme)
              );
              
              if (ownedCards.length > 0) {
                ownedCards.sort(
                  (a, b) => weights[normalizeFrameGrade(b.grade).toUpperCase()] * 100 + (b.level || 1) - (weights[normalizeFrameGrade(a.grade).toUpperCase()] * 100 + (a.level || 1)),
                );
                user.deck[group][m] = ownedCards[0];
                equippedAny = true;
              }
            });

            if (equippedAny) {
              showToast(`✨ Equipped best cards for ${theme} theme!`);
              updateUI();
              renderSuperstarUI();
              document.getElementById("theme-selector-modal").style.display = "none";
            } else {
              showToast(`âš ï¸ You don't own any cards for this theme.`);
            }
          }

          function renderSuperstarUI() {
    const groups = Object.keys(themeDatabase || {}).sort();
    const activeGroup = groups.length > 0 ? groups[currentSsGroupIndex] : null;

    // ✨ 1. INJECT THE CIRCLE MENU SAFELY AT THE VERY TOP ✨
    const deckView = document.getElementById("ss-left-deck-view");
    if (deckView) {
        let circleNav = document.getElementById("ss-circle-nav-container");
        
        // If the container doesn't exist yet, we create it and put it at the very top!
        if (!circleNav) {
            circleNav = document.createElement("div");
            circleNav.id = "ss-circle-nav-container";
            deckView.insertBefore(circleNav, deckView.firstChild);
        }

        // Generate the gorgeous swipeable menu in its own safe row
        circleNav.innerHTML = `
        <div style="padding: 20px 20px 5px 20px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="color: gray; font-size: 10px; font-weight: 900; letter-spacing: 2px; display: block; margin-bottom: 12px; text-align: left;">CHOOSE GROUP</span>
            <div style="display: flex; gap: 15px; overflow-x: auto; scrollbar-width: none; padding-bottom: 15px;">
                ${groups.map((g, index) => {
                    const isSelected = index === currentSsGroupIndex;
                    const clickAction = 'currentSsGroupIndex = ' + index + '; currentlyViewingCardIndex = null; currentlyViewingGhost = null; renderSuperstarUI();';
                    return createGroupCircleBtn(g, isSelected, clickAction);
                }).join("")}
            </div>
        </div>`;
    }

    // Safety checks: Make sure we grab the elements correctly
    const rightGrid = document.getElementById("ss-inv-grid");
    const rightHeader = document.getElementById("ss-right-header-bar");
    const rightInspector = document.getElementById("ss-right-inspector-view");

    // ✨ 2. RENDER THE DECK & RESTORE THE ARROWS ✨
    if (activeGroup) {
        const nameLabel = document.getElementById("ss-current-group-name");
        if (nameLabel) {
            // Put the text back to normal so the ◀ and ▶ arrows sit perfectly beside it!
            nameLabel.innerText = activeGroup;
            nameLabel.style.fontSize = "22px"; // Makes the name a bit bigger and more readable
        }
        renderSuperstarDeck(activeGroup);
    }

    // 3. Switch Right Side between Grid and Inspector
    if (currentlyViewingCardIndex !== null || currentlyViewingGhost !== null) {
        if (rightGrid) rightGrid.style.display = "none";
        if (rightHeader) rightHeader.style.display = "none";
        if (rightInspector) {
            rightInspector.style.display = "flex";
            if (currentlyViewingCardIndex !== null) {
                renderSuperstarInspector();
            } else {
                renderGhostInspector();
            }
        }
    } else {
        if (rightGrid) rightGrid.style.display = "grid";
        if (rightHeader) rightHeader.style.display = "flex";
        if (rightInspector) rightInspector.style.display = "none";
    }

    renderSuperstarRight(activeGroup);
}

    function openProfileModal() {
    document.getElementById("profile-modal").style.display = "flex";
    updateUI();
}
    
    // Function to show the choice pop-up
function openCollectionChoice() {
    document.getElementById('collection-choice-modal').style.display = 'flex';
}

// Function that handles the routing after a choice is made
function selectCollectionOption(choice) {
    // Hide the choice modal immediately
    document.getElementById('collection-choice-modal').style.display = 'none';
    
    if (choice === 'inventory') {
        withLoadingCircle(() => { 
            // NOTE: Ensure this matches the ID of your actual inventory modal
            document.getElementById('superstar-collection-modal').style.display = 'block'; 
            renderSuperstarUI(); 
        });
    } else if (choice === 'cardbook') {
        withLoadingCircle(() => { 
            openCardBook(); 
        });
    }
}
    
 // ✨ GLOBAL CARD RULES ✨
const GRADE_RULES = {
    "R": { min: 2500, max: 5000 },
    "S": { min: 2000, max: 3000 },
    "A": { min: 2000, max: 3000 },
    "B": { min: 1000, max: 1500 },
    "C": { min: 0, max: 500 }
};

// Generates an instant, lightweight card object for your inventory
function generateDynamicCard(group, member, theme, grade) {
    const rules = GRADE_RULES[grade.toUpperCase()];
    
    return {
        id: `${group}_${member}_${theme}_${grade}`.replace(/\s+/g, '_').toLowerCase(),
        group: group,
        member: member.toUpperCase(),
        theme: theme,
        grade: grade.toUpperCase(),
        minScore: rules.min,
        maxScore: rules.max,
        level: 1,
        locked: false,
        url: "dynamic" // Triggers your getLargeCardUrl() Cloudinary constructor
    };
}

// The Engine: Creates a card object on the fly
function generateCard(artist, member, theme, grade) {
    const rules = GRADE_RULES[grade.toUpperCase()];
    
    // Create a strict, clean ID string for the database (e.g., "aespa_karina_rich_man_R")
    const cardId = `${artist}_${member}_${theme}_${grade}`.replace(/\s+/g, '_').toLowerCase();

    return {
        id: cardId,
        artist: artist,
        member: member.toUpperCase(),
        theme: theme,
        grade: grade.toUpperCase(),
        minScore: rules.min,
        maxScore: rules.max,
        // Because your UI handles the glassmorphism frames and text indicators, 
        // you only need a clean URL format to plug into your Cloudinary fetcher
        imageUrl: `c_l_${theme}_${member}`.replace(/\s+/g, '_').toLowerCase() 
    };
}
function renderSuperstarInspector() {
    const panel = document.getElementById("ss-right-inspector-view");
    panel.className = "anim-slide-left";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.height = "100%";
    panel.style.padding = "20px";

    const card = user.inventory[currentlyViewingCardIndex];

    // 1. GET THE URL AND POSITION DATA FIRST
    const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;
    const pos = getCardPosData(card.member, card.theme);

    // 2. CHECK IF IT IS AN LE CARD (BAKED)
// 2. CHECK IF IT IS AN LE CARD (BAKED)
    const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"]; 
    const formatStr = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    
    // ✨ FIXED: Removed the buggy check that was creating the empty dark block!
    const isLE = rawPhotoUrl.includes("limitednewframe") || leThemes.includes(formatStr(card.theme));
    const isBaked = rawPhotoUrl.includes("ced_default") || rawPhotoUrl.includes("Image_CardPack") || isLE;

   const customLeScale = 1.15; 
  const imgTransform = isLE ? `scale(${customLeScale}) translate(-3%, 4%)` : `scale(${pos.scale}) translate(${pos.x}px, ${pos.y}px)`;
    const imgFit = isLE ? "fill" : "cover"; 

    // 4. BUILD THE OVERLAYS (Now that the variables actually exist!)
            const frameOverlayHtml = isBaked ? "" : `<img src="https://ik.imagekit.io/shiningsuperstar/live/resources/live/images/frame/basic/ced_default_${normalizeFrameGrade(card.grade)}_Large.png" style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; border-radius: 10px;">`;
    
   const foilOverlayHtml = isLE ? `
        <div class="le-foil-effect" style="
            -webkit-mask-image: url('${rawPhotoUrl}'); 
            -webkit-mask-size: contain; 
            -webkit-mask-position: center; 
            mask-image: url('${rawPhotoUrl}'); 
            mask-size: contain; 
            mask-position: center; 
        "></div>
    ` : "";

    // 5. CALCULATE STATS
    const gradeBase = { R: 101, S: 82, A: 64, B: 46, C: 28 }[card.grade] || 10;
    const scoreValue = Math.floor(gradeBase + (card.level || 1) * 2.5);
    const hpValue = Math.floor(gradeBase / 2 + (card.level || 1));

    const themeInfo = getThemeLevelInfo(card.group);
    const isPartOfTheme = themeInfo.level > 0 && card.theme === themeInfo.themeName;
    const themeLevelText = isPartOfTheme ? `Lv ${themeInfo.level}` : `Lv 0`;

    const isEquipped = isCardEquipped(card);
    let equipBtnHtml = isEquipped
      ? `<button class="btn btn-draw" style="flex: 1; padding: 12px; font-size: 12px; font-weight: bold; border-color: rgba(255,255,255,0.3);" onclick="unequipSingleCard('${card.group}', '${card.member}')">UNEQUIP</button>`
      : `<button class="btn btn-live" style="flex: 1; padding: 12px; font-size: 12px; font-weight: bold;" onclick="equipSingleCard(${currentlyViewingCardIndex})">EQUIP</button>`;

   // Clean UI: Grade bar is now an external pill badge next to the name
    const gradeColor = card.grade === 'R' ? '#ff0055' : card.grade === 'S' ? '#ffcf54' : '#00bbf9';

    panel.innerHTML = `
    <div style="width: 100%; display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: auto; height: 40px;">
        <button style="width: 40px !important; height: 40px !important; flex: 0 0 40px; font-size: 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; background: rgba(0,0,0,0.6); color: white; cursor: pointer; transition: 0.2s;" onclick="open3DView()" title="Inspect in 3D">ðŸ‘</button>
        <button class="${card.locked ? "locked" : ""}" style="width: 40px !important; height: 40px !important; flex: 0 0 40px; font-size: 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; background: rgba(0,0,0,0.6); color: white; cursor: pointer; transition: 0.2s;" onclick="toggleLockAndRefresh(${currentlyViewingCardIndex})" title="Lock Card">${card.locked ? "🔒" : "🔓"}</button>
        <button style="width: 40px !important; height: 40px !important; flex: 0 0 40px; font-size: 20px; border: 1px solid rgba(255,0,85,0.5); color: #ff0055; border-radius: 10px; background: rgba(255,0,85,0.1); cursor: pointer; transition: 0.2s;" onclick="closeCardDetail()" title="Close Inspector">✖</button>
    </div>
    
    <div style="display: flex; gap: 20px; width: 100%; align-items: center; justify-content: center; margin: 30px 0;">
        <div style="flex: 1; max-width: 160px; cursor: pointer; position: relative;" onclick="open3DView()" title="Click for 3D View">
            <img src="${rawPhotoUrl}" style="width: 100%; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.9); display: block; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s; object-fit: ${imgFit}; transform: ${imgTransform};">
            ${frameOverlayHtml}
            ${foilOverlayHtml}
        </div>
        
        <div style="flex: 1.2; display: flex; flex-direction: column; gap: 12px;">
            <div style="background: rgba(10, 5, 20, 0.8); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span style="background: ${gradeColor}; color: #000; font-weight: 900; font-size: 14px; padding: 2px 10px; border-radius: 12px; box-shadow: 0 0 10px ${gradeColor};">${card.grade}</span>
                    <h2 style="font-weight: 900; font-size: 20px; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 1px;">${card.member}</h2>
                </div>
                
                <p style="color: gray; font-size: 11px; margin-bottom: 12px;">Level ${card.level || 1} ★</p>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <span style="font-size: 11px; color: white; font-weight: bold; letter-spacing: 1px;">SCORE</span>
                    <span style="font-size: 15px; color: var(--secondary-glow); font-weight: 900; text-shadow: 0 0 10px rgba(0,245,212,0.5);">${scoreValue}</span>
                </div>
            </div>
            
            <div style="background: rgba(10, 5, 20, 0.8); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                <div style="font-size: 10px; color: gray; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Theme Info</div>
                <div style="font-size: 15px; color: white; font-weight: 900; margin-top: 4px;">${card.theme}</div>
                <div style="font-size: 12px; color: var(--tertiary-glow); margin-top: 4px; font-weight: bold;">Bonus: ${themeLevelText}</div>
            </div>
        </div>
    </div>
    
    <div style="display:flex; flex-direction: column; gap: 10px; width: 100%; margin-top: auto;">
        ${equipBtnHtml}
        <div style="display:flex; gap: 10px; width: 100%;">
            <button class="btn btn-draw" style="flex: 1; padding: 12px; font-size: 12px; font-weight: bold;" onclick="triggerUpgrade(${currentlyViewingCardIndex})">POWER UP</button>
            <button class="btn btn-danger" style="flex: 1; padding: 12px; font-size: 12px; background: rgba(255,0,85,0.1); border: 1px solid #ff0055; color: #ff0055;" onclick="scrapCardAndClear(${currentlyViewingCardIndex})">SELL</button>
        </div>
    </div>
    `;
}

// ✅ FIXED CODE
function open3DView() {
    if (currentlyViewingCardIndex === null) return;
    const card = user.inventory[currentlyViewingCardIndex];
    
    // Grab pos data
    const pos = getCardPosData(card.member, card.theme);

    // Properly fetch the raw photo URL using your exact card template
    let rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;

    const overlay = document.getElementById("ss-3d-overlay");
    
    // Set the image and apply the API coordinates
    const imgElement = document.getElementById("ss-3d-image");
    imgElement.src = rawPhotoUrl;
    imgElement.style.transform = `scale(${pos.scale}) translate(${pos.x}px, ${pos.y}px)`;

    overlay.style.display = "flex";
}

function handle3DTilt(event) {
    const img = document.getElementById("ss-3d-image");
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const rotateX = ((event.clientY - centerY) / centerY) * -25;
    const rotateY = ((event.clientX - centerX) / centerX) * 25;
    
    img.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.08, 1.08, 1.08)`;
}

// ✨ NEW FUNCTION: Safely opens Gacha cards in 3D without crashing!
function inspectGachaCard(cardObj) {
    const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(cardObj.url, cardObj.grade, cardObj.member, cardObj.theme, cardObj.group) : cardObj.url;
    
    const overlay = document.getElementById("ss-3d-overlay");
    const imgElement = document.getElementById("ss-3d-image");
    
    if (overlay && imgElement) {
        imgElement.src = rawPhotoUrl;
        imgElement.style.transform = "none"; 
        overlay.style.display = "flex";
    }
}
function reset3DTilt() {
    document.getElementById("ss-3d-image").style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
}

          function close3DView() {
            document.getElementById("ss-3d-overlay").style.display = "none";
            reset3DTilt();
          }


          function toggleLockAndRefresh(index) {
            toggleLock(index);
            renderSuperstarUI();
          }
          function scrapCardAndClear(index) {
            scrapCard(index);
            closeCardDetail();
          }

         
          function isCardEquipped(card) {
    if (!user.deck) return false;

    const groupKey = Object.keys(user.deck).find(
      (k) => k.toLowerCase() === (card.group || "").toLowerCase().trim(),
    );
    
    // ADDED SAFETY: Checks if the group deck actually exists and isn't null
    if (!groupKey || !user.deck[groupKey]) return false; 

    const memberKey = Object.keys(user.deck[groupKey]).find(
      (k) => k.toLowerCase() === (card.member || "").toLowerCase().trim(),
    );
    if (!memberKey) return false;

    const eq = user.deck[groupKey][memberKey];
    return eq && eq.url === card.url && eq.level === card.level && eq.grade === card.grade;
}

          function equipSingleCard(invIndex) {
            const card = user.inventory[invIndex];
            if (!user.deck) user.deck = {};

            // Match existing group/member slots regardless of caps, or create new ones
            let groupKey =
              Object.keys(user.deck).find((k) => k.toLowerCase() === (card.group || "").toLowerCase().trim()) ||
              card.group;
            if (!user.deck[groupKey]) user.deck[groupKey] = {};

            let memberKey =
              Object.keys(user.deck[groupKey]).find(
                (k) => k.toLowerCase() === (card.member || "").toLowerCase().trim(),
              ) || card.member;

            user.deck[groupKey][memberKey] = card;
            updateUI();
            renderSuperstarUI();
          }

          function unequipSingleCard(group, member) {
            if (user.deck) {
              const groupKey = Object.keys(user.deck).find(
                (k) => k.toLowerCase() === (group || "").toLowerCase().trim(),
              );
              if (groupKey && user.deck[groupKey]) {
                const memberKey = Object.keys(user.deck[groupKey]).find(
                  (k) => k.toLowerCase() === (member || "").toLowerCase().trim(),
                );
                if (memberKey) {
                  delete user.deck[groupKey][memberKey];
                  updateUI();
                  renderSuperstarUI();
                }
              }
            }
          }

          // ✨ FIXED: Buttons now sync with the Arrows
          function autoEquipSuperstar() {
            const group = getCurrentSSGroup();
            if (!group) return showToast("No group selected!");

            const members = themeDatabase[group].members;
            if (!user.deck) user.deck = {};
            user.deck[group] = {};

            const gradeVals = { R: 5, S: 4, A: 3, B: 2, C: 1 };

            members.forEach((m) => {
              const mCards = user.inventory.filter(
                (c) =>
                  (c.group || "").toLowerCase() === group.toLowerCase() &&
                  (c.member || "").toLowerCase() === m.toLowerCase(),
              );
              mCards.sort(
                (a, b) => gradeVals[b.grade] * 100 + (b.level || 1) - (gradeVals[a.grade] * 100 + (a.level || 1)),
              );
              if (mCards.length > 0) user.deck[group][m] = mCards[0];
            });

            showToast(`✨ Auto-Equipped best cards!`);
            updateUI();
            renderSuperstarUI();
          }

          

     
          /* ✨ CARD HTML GENERATOR ✨ */
         

async function renderGachaBatch() {
  const drawGrid = document.getElementById("draw-stage-cards");
  drawGrid.innerHTML = "";
  const nextBtn = document.getElementById("gacha-next-btn");
  const finishBtn = document.getElementById("gacha-finish-btn");
  nextBtn.style.display = "none";
  finishBtn.style.display = "none";

  const batchSize = 10;
  const startIndex = currentGachaBatchIndex * batchSize;
  const endIndex = Math.min(startIndex + batchSize, fullPulledCardList.length);
  const batch = fullPulledCardList.slice(startIndex, endIndex);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  batch.forEach((c, i) => {
    let w = document.createElement("div");
    w.className = "card-wrapper";
    w.style.cursor = "pointer"; 
    
    const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(c.url, c.grade, c.member, c.theme, c.group) : c.url;
    
    const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
    const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    const isLE = leThemes.includes(formatStr(c.theme));
    
    w.dataset.isLe = isLE;

    const foilOverlayHtml = isLE ? `
        <div class="le-foil-effect" style="
            -webkit-mask-image: url('${rawPhotoUrl}');
            -webkit-mask-size: contain;
            -webkit-mask-position: center;
            mask-image: url('${rawPhotoUrl}');
            mask-size: contain;
            mask-position: center;
        "></div>
    ` : "";

    w.innerHTML = `
      <div class="card-container">
        <div class="card-face card-back"></div>
        <div class="card-face card-front" style="position: relative; border-radius: 8px; background: transparent; border: none;">
          <img src="${rawPhotoUrl}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">
          ${foilOverlayHtml}
        </div>
      </div>
    `;
    
    w.onclick = () => inspectGachaCard(c);
    drawGrid.appendChild(w);
  });

  const wrappers = drawGrid.querySelectorAll('.card-wrapper');
  let hasLE = false;

  for (let i = 0; i < wrappers.length; i++) {
    const w = wrappers[i];
    const c = batch[i];
    const isLE = w.dataset.isLe === 'true';
    const container = w.querySelector(".card-container");

    if (isLE) hasLE = true;

    w.classList.add("show");
    if (isLE) container.classList.add("le-tension");

    await sleep(200); 

    if (isLE) {
      await sleep(500);
      container.classList.remove("le-tension");
      container.classList.add("is-le-grade");

      const overlay = document.getElementById("gacha-fullscreen-overlay");
      overlay.style.animation = "none";
      void overlay.offsetWidth;
      overlay.style.animation = "leScreenFlash 0.8s ease-out forwards";

      createRGradeBurst(w);
      setTimeout(() => createRGradeBurst(w), 100);
      setTimeout(() => createRGradeBurst(w), 250);

      w.classList.add("le-spotlight");
      container.classList.add("reveal");

      await sleep(2000);

      w.classList.remove("le-spotlight");
      await sleep(400); 

    } else {
      container.classList.add("reveal");
      if (c.grade === "R") {
        container.classList.add("is-r-grade");
        createRGradeBurst(w);
      }
      await sleep(150); 
    }
  }

  // ✨ CINEMATIC LE ISOLATION SHOWCASE ✨
if (hasLE) {
    await sleep(600);

    // Step 1: Dim the entire overlay to black for drama
    const overlay = document.getElementById("gacha-fullscreen-overlay");
    overlay.style.transition = "background 0.8s ease";
    overlay.style.background = "rgba(0,0,0,0.97)";

    // Step 2: Fade and collapse non-LE cards smoothly
    wrappers.forEach(w => {
        if (w.dataset.isLe !== 'true') {
            w.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
            w.style.opacity = "0";
            w.style.transform = "scale(0.3) translateY(40px)";
            w.style.filter = "blur(4px)";
            setTimeout(() => { w.style.display = "none"; }, 600);
        }
    });

    await sleep(700);

    // Step 3: Center and spotlight each LE card with a stagger
    const leWrappers = [...wrappers].filter(w => w.dataset.isLe === 'true');
    const leCount = leWrappers.length;

    // Force the grid to center its remaining children
    drawGrid.style.display = "flex";
    drawGrid.style.justifyContent = "center";
    drawGrid.style.alignItems = "center";
    drawGrid.style.gap = "30px";
    drawGrid.style.flexWrap = "wrap";

    leWrappers.forEach((w, i) => {
        setTimeout(() => {
            w.style.transition = "all 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            // Scale based on count so single card is bigger
            const scaleAmt = leCount === 1 ? 1.6 : leCount === 2 ? 1.3 : 1.1;
            w.style.transform = `scale(${scaleAmt})`;
            w.style.zIndex = "50";
            w.style.filter = "drop-shadow(0 0 40px rgba(255, 200, 50, 0.9)) drop-shadow(0 0 80px rgba(255, 100, 0, 0.5))";

            // Scanline shimmer effect on the card
            const front = w.querySelector(".card-front");
            if (front) {
                front.style.animation = "leShimmer 2s ease-in-out infinite";
            }
        }, i * 200);
    });

    // Step 4: Add the LE label that fades in below
    await sleep(400);
    leWrappers.forEach((w, i) => {
        setTimeout(() => {
            const label = document.createElement("div");
            label.style.cssText = `
                position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%);
                background: linear-gradient(90deg, #ff6b00, #ffc800, #ff6b00);
                background-size: 200% auto;
                animation: shimmerText 2s linear infinite;
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                font-size: 11px; font-weight: 900; letter-spacing: 3px;
                white-space: nowrap; opacity: 0; transition: opacity 0.5s ease;
            `;
            label.innerText = "✦ LIMITED EDITION ✦";
            w.style.position = "relative";
            w.appendChild(label);
            setTimeout(() => label.style.opacity = "1", 100);
        }, i * 200);
    });

    await sleep(600);
}

  // ✨ Always show the correct button after all cards (and LE sequence) are done
  const isLastBatch = (currentGachaBatchIndex + 1) * 10 >= fullPulledCardList.length;
  if (isLastBatch) {
    finishBtn.style.display = "block";
  } else {
    nextBtn.style.display = "block";
  }
} // end of renderGachaBatch

function getProfilePicUrl(baseImgPath) {
  const raw = String(baseImgPath ?? "").split("@@").pop();
  const filename = assetBasename(raw);
  const pfpKey = `p_${filename.replace(/^c_[ls]_/, "")}`;

  const globalHit = lookupGlobalAsset(pfpKey) || getCatalogAssetForUrl(raw, [pfpKey]);
  if (globalHit) return globalHit;

  for (const [key, assets] of Object.entries(assetCache)) {
    if (!String(key).startsWith("profile_")) continue;
    const hit = assets?.[normalizeAssetName(pfpKey)] || assets?.[assetBasename(pfpKey)];
    if (hit) return hit;
  }

  warnMissingCatalogAsset("profile", pfpKey);
  return legacyOrBlankAsset("", "PROFILE");
}

    // ✨ LOGO EXTRACTOR ✨
function getGroupEmblemUrl(groupName) {
    if (themeDatabase[groupName]) {
        const groupData = themeDatabase[groupName];
        let testCode = null;
        
        // Grab the first available profile code to look up the card in the database
        if (groupData.profiles) {
            for (let cls in groupData.profiles) {
                if (groupData.profiles[cls] && groupData.profiles[cls].length > 0) {
                    testCode = groupData.profiles[cls][0];
                    break;
                }
            }
        }
        
        if (testCode && typeof urlData !== 'undefined' && typeof cardMap !== 'undefined') {
            let meta = cardMap[testCode] || cardMap[testCode + "_R"] || cardMap[testCode.replace(/_R$/, "")];
            if (meta && meta.length > 0) meta = meta[0];
            
            if (meta) {
                let urlObj = urlData.find(u => u.code === meta.card);
                if (urlObj && urlObj.url) {
                    // ✨ Your exact logic: Pulls 'emblem_girlset' from 'l_emblem_girlset'
                    const match = urlObj.url.match(/l_(emblem_[^/]+)/i);
                    if (match) {
                        return `https://res.cloudinary.com/shining-superstar/${match[1]}.png`;
                    }
                }
            }
        }
    }
    
    // Fallback: If it couldn't find a URL to scan, guess it based on the group name!
    const safeName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `https://res.cloudinary.com/shining-superstar/emblem_${safeName}.png`;
}
    
    // ✨ GROUP CIRCLE UI GENERATOR ✨
function createGroupCircleBtn(groupName, isSelected, onClickAction) {
    const emblemUrl = getGroupEmblemUrl(groupName);
    
    // If selected, it glows with your theme color. If not, it's slightly faded with a white stroke.
    const circleBorder = isSelected ? "border: 2px solid #ff0055; box-shadow: 0 0 15px rgba(255,0,85,0.5);" : "border: 2px solid rgba(255,255,255,0.6);";
    const textColor = isSelected ? "#ff0055" : "white";
    const opacity = isSelected ? "1" : "0.5";
    
    return `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; width: 70px; flex-shrink: 0; opacity: ${opacity}; transition: all 0.3s ease;" onclick="${onClickAction}" onmouseover="this.style.opacity='1'" onmouseout="if(!${isSelected}) this.style.opacity='0.5'">
        <div style="width: 55px; height: 55px; border-radius: 50%; ${circleBorder} background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 10px; backdrop-filter: blur(5px);">
            <img src="${emblemUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" onerror="this.style.display='none'">
        </div>
        <span style="color: ${textColor}; font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${groupName}</span>
    </div>`;
}
function getBaseImgPath(fullUrl, grade, member, theme, group) {
    // If your old database passes an ImageKit URL, strip everything except the filename
    if (fullUrl && fullUrl.includes("@@")) {
        return fullUrl.split("@@").pop().replace(".png", "");
    }

    // Otherwise, generate the clean No-Folder prefix
    const safeFormat = (str) => (str || "")
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, ""); 

    const t = safeFormat(theme);
    const m = safeFormat(member);

    return `c_l_${t}_${m}`;
}

function createCardHTML(card, isEquipped, originalIndex) {
        // ✨ Handle Material Cards distinctly!
    if (card.type === 'material') {
        const clickAction = originalIndex !== null ? `onclick="openCardDetail(${originalIndex})"` : ``;
        const matColor = card.chance === 1.0 ? '#00f5d4' : card.chance >= 0.5 ? '#fee440' : '#ff0055';
        return `
            <div class="ss-card" ${clickAction} style="aspect-ratio: 2.5/3.5 !important; background: linear-gradient(135deg, #111, #222); border: 2px solid ${matColor}; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div style="font-size: 30px;"><i class="g g-gear"></i></div>
                <div style="color: ${matColor}; font-weight: 900; font-size: 16px; text-shadow: 0 0 10px ${matColor};">${card.chance * 100}%</div>
                <div style="color: white; font-size: 10px; font-weight: bold; margin-top: 5px;">MATERIAL</div>
            </div>`;
    }
    const clickAction = originalIndex !== null ? `onclick="openCardDetail(${originalIndex})"` : ``;
    const photoUrl = typeof getSmallCardUrl === "function" ? getSmallCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;

    // Detect if LE to fix aspect ratio
    const leThemes = ["bang_bang", "lips_hips_kiss", "whole_different_animal", "rosy_rollie_ruby"];
    const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    const isLE = leThemes.includes(formatStr(card.theme));
    const activeRatio = isLE ? "270 / 360" : "2.5 / 3.5";

    return `
        <div class="ss-card ${isEquipped ? "equipped" : ""}" ${clickAction} style="aspect-ratio: ${activeRatio} !important; background: transparent;">
            <img src="${photoUrl}" style="object-fit: contain;">
            ${card.locked ? `<div class="ss-lock"><i class="g g-lock"></i></div>` : ""}
        </div>`;
}
          function initializeVaultGroups() {
            const groups = [...new Set((user.inventory || []).map((c) => c.group))].sort();
            vaultGroupIndex = groups.length > 0 ? 0 : -1;
            updateGroupNavVisuals();
          }

          // Call this inside your window.onload = async () => { ... } block!
          // Just add initSmoothModals(); right under spawnLobbySparkles();

          function navigateVaultGroup(direction) {
            const groups = [...new Set((user.inventory || []).map((c) => c.group))].sort();
            if (groups.length === 0) return;
            vaultGroupIndex = (vaultGroupIndex + direction + groups.length) % groups.length;
            updateGroupNavVisuals();
            if (vaultFilterType === "current") renderVault();
          }

          function updateGroupNavVisuals() {
            const groups = [...new Set((user.inventory || []).map((c) => c.group))].sort();
            const groupTitle = document.getElementById("vault-current-group");
            if (groups.length > 0) {
              groupTitle.innerText = groups[vaultGroupIndex];
              groupTitle.style.color = "#fff";
            } else {
              groupTitle.innerText = "NO CARDS YET";
              groupTitle.style.color = "var(--text-muted)";
            }
          }

          function setVaultGroupFilter(type, btn) {
            vaultFilterType = type;
            document.querySelectorAll("#vault-overlay .filter-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            renderVault();
          }

          function setFavCard(index) {
            if (!user.profile) user.profile = { favCardUrl: null, favWallpaper: null };
            user.profile.favCardUrl = user.inventory[index].url;
            showToast("✨ Profile card updated!");
            updateUI();
          }

          /* ✨ VIEW CARD DETAILS LOGIC ✨ */

          function toggleLock(index) {
            user.inventory[index].locked = !user.inventory[index].locked;
            updateUI();
            renderVault();
          }

          function scrapCard(index) {
            if (user.inventory[index].locked) return showToast("Selling disabled for locked cards!");
            if (!confirm("Are you sure you want to sell this card for RP?")) return;
            const rpGain = (weights[user.inventory[index].grade] || 1) * 100;
            user.inventory.splice(index, 1);
            user.rp += rpGain;
            showToast(`Card sold for ${rpGain} RP.`);
            updateUI();
            renderVault();
          }

         
          /* ✨ UPGRADED DECK EQUIP (With Ghost Slots) ✨ */
          let deckGroup = "";

          function toggleDeck() {
            document.getElementById("vault-overlay").style.display = "none";
            const d = document.getElementById("deck-overlay");
            if (d.style.display === "flex") {
              d.style.display = "none";
            } else {
              d.style.display = "flex";
              populateDeckGroups();
            }
          }

          function populateDeckGroups() {
            const select = document.getElementById("deck-group-select");
            const groups = Object.keys(themeDatabase).sort(); // Read from official database

            select.innerHTML = '<option value="">-- SELECT GROUP --</option>';
            groups.forEach((g) => {
              select.innerHTML += `<option value="${g}">${g}</option>`;
            });

            deckGroup = groups[0] || "";
            select.value = deckGroup;
            renderDeck();
          }

          function renderDeck() {
            deckGroup = document.getElementById("deck-group-select").value;
            const grid = document.getElementById("deck-grid");

            if (!deckGroup || !themeDatabase[deckGroup]) {
              grid.innerHTML = "";
              return;
            }

            if (!user.deck) user.deck = {};
            const groupDeck = user.deck[deckGroup] || {};

            // Use OFFICIAL members from database, not just what the user owns
            const officialMembers = themeDatabase[deckGroup].members;

            grid.innerHTML = officialMembers
              .map((m) => {
                const eq = groupDeck[m];
                if (eq) {
                  return `
                <div class="vault-item" style="border-color: var(--secondary-glow);">
                    <div class="vault-item-img-container">
                        <img src="${eq.url}">
                    </div>
                    <div style="font-size: 10px; font-weight: bold; margin-top: 5px; color: var(--secondary-glow);">${eq.theme}</div>
                </div>`;
                } else {
                  // ✨ EMPTY GHOST SLOT ✨
                  return `
                <div class="vault-item" style="opacity:0.4; border-style: dashed;">
                    <div class="vault-item-img-container" style="background: #000; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        <span style="font-size: 24px; color: gray;">?</span>
                        <span style="font-size: 10px; color: gray; margin-top: 5px;">${m}</span>
                    </div>
                </div>`;
                }
              })
              .join("");
          }

          /* ✨ OFFICIAL SUPERSTAR CARD BOOK LOGIC ✨ */
const CB_POINTS = { R: 15, S: 10, A: 7, B: 5, C: 3 };
const CB_WEIGHTS = { R: 5, S: 4, A: 3, B: 2, C: 1 };

let cbCalculatedData = {};

function openCardBook() {
    document.getElementById("cardbook-modal").style.display = "flex";
    calculateCardBookData();
    switchCardBookTab('main');
}

function switchCardBookTab(tabId) {
    const mainView = document.getElementById("cb-view-main");
    const groupsView = document.getElementById("cb-view-groups");
    const specificView = document.getElementById("cb-view-specific");
    // FIX: hide all views, then show the active one with flex:1 so it fills the modal
    [mainView, groupsView, specificView].forEach(v => { if(v) { v.style.display = "none"; v.style.flex = ""; } });
    if (tabId === 'main' && mainView) { mainView.style.display = "grid"; mainView.style.flex = "1"; mainView.style.minHeight = "0"; }
    if (tabId === 'groups' && groupsView) { groupsView.style.display = "grid"; groupsView.style.flex = "1"; groupsView.style.minHeight = "0"; }
    if (tabId === 'specific' && specificView) { specificView.style.display = "flex"; specificView.style.flex = "1"; specificView.style.minHeight = "0"; }

    const nav = document.getElementById("cb-top-nav");
    if (tabId === 'specific') {
        if (nav) nav.style.display = "none";
    } else {
        if (nav) nav.style.display = "flex";
        document.querySelectorAll(".cb-tab").forEach(t => t.classList.remove("active"));
        if (tabId === 'main') document.querySelectorAll(".cb-tab")[0]?.classList.add("active");
        if (tabId === 'groups') document.querySelectorAll(".cb-tab")[1]?.classList.add("active");
    }
    if (tabId === 'main') renderCardBookMain();
    if (tabId === 'groups') renderCardBookGroups();
}

function calculateCardBookData() {
    cbCalculatedData = {
        totalUniqueCards: 0,
        totalThemePoints: 0,
        groupStats: {},
        bestGroup: { name: "NONE", points: 0, maxGrade: "C" },
        groupedInventory: {} // Storing highest grade per member/theme
    };

    // 1. Map Highest Grade Unique Cards
    (user.inventory || []).forEach(c => {
        const g = c.group, t = c.theme, m = c.member;
        if (!cbCalculatedData.groupedInventory[g]) cbCalculatedData.groupedInventory[g] = {};
        if (!cbCalculatedData.groupedInventory[g][t]) cbCalculatedData.groupedInventory[g][t] = {};
        
        const currentGrade = cbCalculatedData.groupedInventory[g][t][m];
        if (!currentGrade || CB_WEIGHTS[c.grade] > CB_WEIGHTS[currentGrade]) {
            cbCalculatedData.groupedInventory[g][t][m] = c.grade;
        }
    });

    // 2. Tally Points & Stats
    for (let g in themeDatabase) {
        cbCalculatedData.groupStats[g] = { points: 0, maxGrade: null };
        const gData = cbCalculatedData.groupedInventory[g] || {};

        let groupMaxWeight = 0;

        for (let t in gData) {
            for (let m in gData[t]) {
                const grade = gData[t][m];
                cbCalculatedData.totalUniqueCards++;
                
                const pts = CB_POINTS[grade] || 0;
                cbCalculatedData.totalThemePoints += pts;
                cbCalculatedData.groupStats[g].points += pts;

                if (CB_WEIGHTS[grade] > groupMaxWeight) {
                    groupMaxWeight = CB_WEIGHTS[grade];
                    cbCalculatedData.groupStats[g].maxGrade = grade;
                }
            }
        }

        // Track the best overall group
        if (cbCalculatedData.groupStats[g].points > cbCalculatedData.bestGroup.points) {
            cbCalculatedData.bestGroup = { 
                name: g, 
                points: cbCalculatedData.groupStats[g].points,
                maxGrade: cbCalculatedData.groupStats[g].maxGrade 
            };
        }
    }
}

function renderCardBookMain() {
    const mainView = document.getElementById("cb-view-main");
    if (!user.cbMilestones) user.cbMilestones = { cardsLevel: 1, themesLevel: 1 };

    const cardsTarget = user.cbMilestones.cardsLevel * 50; 
    const themesTarget = user.cbMilestones.themesLevel * 500; 
    const diamondReward = user.cbMilestones.cardsLevel * 10;
    const rpReward = user.cbMilestones.themesLevel * 5000;

    const bestG = cbCalculatedData.bestGroup;
    const gradeColor = bestG.maxGrade === 'R' ? '#ff0055' : bestG.maxGrade === 'S' ? '#ffcf54' : '#00bbf9';
    
    // Attempt to grab a gorgeous background for their best group!
    const bestBgUrl = getGroupEmblemUrl(bestG.name) || "https://jyp.com/800x400/111/fff?text=COLLECTION";

    mainView.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="cb-best-group" style="background-image: url('${bestBgUrl}'); background-size: cover; background-position: center;">
                <div class="cb-best-content" style="z-index: 5;">
                    ${bestG.maxGrade ? `
                    <div class="cb-best-grade-ring" style="width: 80px; height: 80px; border-color: ${gradeColor}; color: ${gradeColor}; box-shadow: 0 0 30px ${gradeColor}80; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);">
                        <span style="font-size: 36px; font-weight: 900; line-height: 1;">${bestG.maxGrade}</span>
                    </div>` : ''}
                    <div>
                        <div style="font-size: 14px; color: #ff0055; font-weight: 900; letter-spacing: 2px;">TOP COLLECTION</div>
                        <div style="font-size: 36px; font-weight: 900; color: white; text-shadow: 0 2px 10px black;">${bestG.name}</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display: flex; flex-direction: column;">
            <div class="cb-reward-box">
                <div class="cb-reward-header">
                    <div>
                        <div style="font-size: 11px; color: #00f5d4; font-weight: 900; letter-spacing: 1px; margin-bottom: 5px;">CARD COLLECTOR</div>
                        <div style="color: white; font-size: 20px; font-weight: 900;">Unlock ${cardsTarget} Unique Cards</div>
                    </div>
                    <div style="color: #00f5d4; font-weight: 900; font-family: monospace; font-size: 20px;">${cbCalculatedData.totalUniqueCards} / ${cardsTarget}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: var(--diamond-color); font-weight: 900; font-size: 20px;">💎 +${diamondReward}</div>
                    <button class="btn btn-draw" style="border-color: var(--diamond-color); color: var(--diamond-color); padding: 10px 30px;" 
                            ${cbCalculatedData.totalUniqueCards >= cardsTarget ? `onclick="claimCBMilestone('cards', ${diamondReward})"` : 'disabled'}>
                        ${cbCalculatedData.totalUniqueCards >= cardsTarget ? 'CLAIM REWARD' : 'LOCKED'}
                    </button>
                </div>
            </div>

            <div class="cb-reward-box" style="border-color: rgba(255,0,85,0.3);">
                <div class="cb-reward-header">
                    <div>
                        <div style="font-size: 11px; color: #ff0055; font-weight: 900; letter-spacing: 1px; margin-bottom: 5px;">THEME MASTERY</div>
                        <div style="color: white; font-size: 20px; font-weight: 900;">Achieve ${themesTarget.toLocaleString()} Points</div>
                    </div>
                    <div style="color: #ff0055; font-weight: 900; font-family: monospace; font-size: 20px;">${cbCalculatedData.totalThemePoints.toLocaleString()} / ${themesTarget.toLocaleString()}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: var(--rp-color); font-weight: 900; font-size: 20px;">✦ +${rpReward.toLocaleString()}</div>
                    <button class="btn btn-live" style="padding: 10px 30px;" 
                            ${cbCalculatedData.totalThemePoints >= themesTarget ? `onclick="claimCBMilestone('themes', ${rpReward})"` : 'disabled'}>
                        ${cbCalculatedData.totalThemePoints >= themesTarget ? 'CLAIM REWARD' : 'LOCKED'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function claimCBMilestone(type, amount) {
    if (type === 'cards') {
        user.diamonds += amount;
        user.cbMilestones.cardsLevel++;
        showToast(`💎 Claimed ${amount} Diamonds!`);
    } else {
        user.rp += amount;
        user.cbMilestones.themesLevel++;
        showToast(`✦ Claimed ${amount} RP!`);
    }
    updateUI();
    renderCardBookMain();
}

function renderCardBookGroups() {
    const grid = document.getElementById("cb-view-groups");
    const groups = Object.keys(themeDatabase).sort();

    grid.innerHTML = groups.map(g => {
        const stats = cbCalculatedData.groupStats[g] || { points: 0, maxGrade: null };
        const gColor = stats.maxGrade === 'R' ? '#ff0055' : stats.maxGrade === 'S' ? '#ffcf54' : stats.maxGrade === 'A' ? '#00bbf9' : stats.maxGrade === 'B' ? '#a855f7' : 'gray';
        
        return `
        <div class="cb-group-card" onclick="openCardBookSpecific('${g}')">
            <div class="cb-group-logo" style="border-color: ${gColor}; color: ${gColor}; box-shadow: ${stats.maxGrade ? `0 0 10px ${gColor}50` : 'none'};">
                ${stats.maxGrade || 'C'}
            </div>
            <div class="cb-group-name">${g}</div>
        </div>`;
    }).join("");
}

function openCardBookSpecific(group) {
    switchCardBookTab('specific');
    document.getElementById("cb-specific-group-name").innerText = group;
    
    const list = document.getElementById("cb-specific-themes");
    const dbGroup = themeDatabase[group];
    
    let allThemes = [];
    if (dbGroup.themes) allThemes = allThemes.concat(dbGroup.themes);
    if (dbGroup.le_themes) allThemes = allThemes.concat(dbGroup.le_themes);

    // We need the formatter to safely compare your inventory to the database
    const formatStr = (str) => (str || "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");

    list.innerHTML = allThemes.map(theme => {
        const isLE = dbGroup.le_themes && dbGroup.le_themes.includes(theme);
        
        // Build cards using the authentic game renderer
        const cardsHtml = dbGroup.members.map(m => {
            // Find all owned cards for this exact member and theme
            const ownedCards = (user.inventory || []).filter(c => 
                c && 
                formatStr(c.group) === formatStr(group) && 
                formatStr(c.member) === formatStr(m) && 
                formatStr(c.theme) === formatStr(theme)
            );
            
            if (ownedCards.length > 0) {
                // If you own multiple, sort to display the highest grade/level
                ownedCards.sort((a, b) => (CB_WEIGHTS[b.grade] || 0) * 100 + (b.level || 1) - ((CB_WEIGHTS[a.grade] || 0) * 100 + (a.level || 1)));
                const bestCard = ownedCards[0];
                
                // ✨ AUTHENTIC RENDER: Uses your actual getSmallCardUrl frame logic!
                return `
                <div class="cb-card-slot" style="width: 75px; flex-shrink: 0; position: relative;">
                    ${createCardHTML(bestCard, false, null)}
                </div>`;
            } else {
                // ✨ AUTHENTIC GHOST: Uses your grayscale ghost generator with correct aspect ratios!
                const ghostUrl = getGhostCardUrl(group, m, theme);
                const activeRatio = isLE ? "270 / 360" : "2.5 / 3.5";
                
                return `
                <div class="cb-card-slot unowned" style="width: 75px; flex-shrink: 0; position: relative;">
                    <div class="ss-card ghost" style="border: 1px dashed rgba(255,255,255,0.2); background: transparent; aspect-ratio: ${activeRatio} !important;">
                        <img src="${ghostUrl}" style="opacity: 0.5; object-fit: contain;">
                    </div>
                </div>`;
            }
        }).join("");

        return `
        <div class="cb-theme-row">
            <div class="cb-theme-header">
                <span style="color: white; font-weight: 900; font-size: 14px;">${theme}</span>
                <div style="display: flex; gap: 5px;">
                    ${isLE ? `<span class="tag-limited">LIMITED</span>` : ''}
                    <span class="tag-year">2026</span>
                </div>
            </div>
            <div class="cb-theme-cards">
                ${cardsHtml}
            </div>
        </div>`;
    }).join("");
}

// ✨ 3. THE BUNDLE SELECTOR MODAL
function openMilestoneSelector(group, theme, claimKey) {
    // Inject modal if it doesn't exist
    if (!document.getElementById("milestone-selector-modal")) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="milestone-selector-modal" class="custom-modal-overlay" style="z-index: 10050;">
            <div class="custom-modal" style="max-width: 500px; border-color: var(--tertiary-glow);">
                <button class="close-btn" onclick="document.getElementById('milestone-selector-modal').style.display='none'">×</button>
                <h2 style="color: var(--tertiary-glow); letter-spacing: 3px; margin-bottom: 5px;">ðŸ† MAX LEVEL MILESTONE!</h2>
                <p style="color: white; font-size: 12px; margin-bottom: 20px;">You reached the absolute max level for <b id="ms-theme-name" style="color: var(--secondary-glow);">THEME</b>! Choose your grand prize:</p>
                
                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <div style="flex: 1; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 12px; border: 1px solid var(--diamond-color); text-align: center;">
                        <div style="font-size: 40px; margin-bottom: 10px;">💎</div>
                        <div style="font-weight: 900; color: white;">1,000 Diamonds</div>
                        <button class="btn btn-draw" style="width: 100%; margin-top: 10px; border-color: var(--diamond-color);" onclick="confirmMilestone('diamonds')">SELECT</button>
                    </div>
                    <div style="flex: 1; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 12px; border: 1px solid var(--rp-color); text-align: center;">
                        <div style="font-size: 40px; margin-bottom: 10px;">✦</div>
                        <div style="font-weight: 900; color: white;">500,000 RP</div>
                        <button class="btn btn-draw" style="width: 100%; margin-top: 10px; border-color: var(--rp-color);" onclick="confirmMilestone('rp')">SELECT</button>
                    </div>
                    <div style="flex: 1; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 12px; border: 1px solid #ff0055; text-align: center;">
                        <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
                        <div style="font-weight: 900; color: white;">5 Random R Cards</div>
                        <button class="btn btn-draw" style="width: 100%; margin-top: 10px; border-color: #ff0055;" onclick="confirmMilestone('cards')">SELECT</button>
                    </div>
                </div>
            </div>
        </div>`);
    }

    // Set a temporary global variable to hold the claim key
    window.pendingMilestoneClaim = claimKey;
    document.getElementById("ms-theme-name").innerText = theme;
    document.getElementById("milestone-selector-modal").style.display = "flex";
}

function confirmMilestone(choice) {
    if (!window.pendingMilestoneClaim) return;
    
    user.cardBookClaims[window.pendingMilestoneClaim] = true;

    if (choice === 'diamonds') {
        user.diamonds += 1000;
        showToast("💎 1,000 Diamonds Added!");
    } else if (choice === 'rp') {
        user.rp += 500000;
        showToast("✦ 500,000 RP Added!");
    } else if (choice === 'cards') {
    generateCards(5, "all_R");
    showToast("📦 5 Random R Cards incoming!");
}

    window.pendingMilestoneClaim = null;
    document.getElementById("milestone-selector-modal").style.display = "none";
    updateUI();
    renderCardBook();
}
          function claimCardBookReward(group, theme) {
            const claimKey = `${group}_${theme}`;
            if (user.cardBookClaims[claimKey]) return; // Failsafe

            user.cardBookClaims[claimKey] = true;
            user.diamonds += 50; // Standard Superstar theme completion reward

            showToast(`✨ Completed Theme: ${theme}! +50 Diamonds`);
            updateUI();
            renderCardBook(); // Refresh the UI
          }
          function autoEquipDeck() {
            if (!deckGroup) return;
            const members = [
              ...new Set((user.inventory || []).filter((c) => c.group === deckGroup).map((c) => c.member)),
            ];
            if (!user.deck) user.deck = {};
            user.deck[deckGroup] = {};

            members.forEach((m) => {
              const mCards = user.inventory.filter((c) => c.group === deckGroup && c.member === m);
              mCards.sort(
                (a, b) => weights[normalizeFrameGrade(b.grade).toUpperCase()] * 100 + (b.level || 1) - (weights[normalizeFrameGrade(a.grade).toUpperCase()] * 100 + (a.level || 1)),
              );
              if (mCards.length > 0) user.deck[deckGroup][m] = mCards[0];
            });
            showToast(`✨ Auto-Equipped best cards for ${deckGroup}!`);
            updateUI();
            renderDeck();
          }

          function calculateDeckBonus(group) {
            if (!user.deck || !user.deck[group]) return { mult: 1, themes: 0 };
            const d = user.deck[group];
            const themes = Object.values(d).map((c) => c.theme);
            if (themes.length === 0) return { mult: 1, themes: 0 };
            // Count theme occurrences
            const counts = {};
            themes.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
            const maxThemeCount = Math.max(...Object.values(counts));
            // Simple multiplier logic based on matched themes
            const mult = 1 + maxThemeCount * 0.1;
            return { mult, themes: maxThemeCount };
          }

          let arcadeSongs = [
    // ------------------------------------
    // 🌟 REAL K-POP GROUPS 🌟
    // ------------------------------------
    
    // aespa
    { title: "Supernova", artist: "aespa", group: "aespa", bpm: 130, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/05/9a/c0/059ac0c1-6b2d-d55c-cf57-b2e1b12b5e39/Cover.jpg/600x600bb.jpg", youtubeId: "phuiiNCxRMg" },
    { title: "Drama", artist: "aespa", group: "aespa", bpm: 125, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/5a/2a/3b/5a2a3b09-5489-cf2a-f975-f554625b42d1/23UMGIM92182.rgb.jpg/600x600bb.jpg", youtubeId: "D8VEhcPeSlc" },

    // ILLIT
    { title: "Magnetic", artist: "ILLIT", group: "ILLIT", bpm: 115, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2d/1f/99/2d1f997c-6d8b-c312-2156-c2a1ae969c03/888272177749_Cover.jpg/600x600bb.jpg", youtubeId: "Vk5-c_v4gMU" },
    { title: "Cherish (My Love)", artist: "ILLIT", group: "ILLIT", bpm: 118, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d5/9c/e8/d59ce873-61ce-3221-a1e6-b6b55d92df9a/8809985028977.jpg/600x600bb.jpg", youtubeId: "sQ1_b5YJ3aY" },

    // LOONA
    { title: "PTT (Paint The Town)", artist: "LOONA", group: "LOONA", bpm: 125, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/d5/4b/ced54bd0-05e8-b80c-7b0f-8c0840b2fec2/8809755508688.jpg/600x600bb.jpg", youtubeId: "tEePWPE2ro8" },
    { title: "Hi High", artist: "LOONA", group: "LOONA", bpm: 135, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/eb/fa/d7/ebd75677-2e11-e63d-b4ef-5e580e2f5b66/8809605400266.jpg/600x600bb.jpg", youtubeId: "846cjX0ZTrk" },
    { title: "Why Not?", artist: "LOONA", group: "LOONA", bpm: 122, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/4b/22/e1/4b22e118-2e06-9b57-dc26-8802d3f668f4/8809704419511.jpg/600x600bb.jpg", youtubeId: "b6li05zh3Kg" },

    // Stray Kids
    { title: "Maniac", artist: "Stray Kids", group: "Stray Kids", bpm: 140, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0e/b6/b6/0eb6b6f5-3baf-62b8-c905-8617a1275a21/8809519881108.jpg/600x600bb.jpg", youtubeId: "OvioeS1ZZ7o" },
    { title: "Chk Chk Boom", artist: "Stray Kids", group: "Stray Kids", bpm: 105, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f4/15/55/f4155556-9a2c-f698-c178-5775f0a28fde/8809985027581.jpg/600x600bb.jpg", youtubeId: "wHJEgkWjJjU" },

    // LE SSERAFIM
    { title: "CRAZY", artist: "LE SSERAFIM", group: "LE SSERAFIM", bpm: 120, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/28/7f/00/287f005c-dfb7-0b13-9828-56934c9c849e/196922986483_Cover.jpg/600x600bb.jpg", youtubeId: "n6B5gQQi77Q" },
    { title: "EASY", artist: "LE SSERAFIM", group: "LE SSERAFIM", bpm: 110, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/f4/ca/ff/f4caffdb-893f-d31d-b8d4-539c0d6cf509/196922756857_Cover.jpg/600x600bb.jpg", youtubeId: "bNKXxwOQKW8" },

    // IVE
    { title: "HEYA", artist: "IVE", group: "IVE", bpm: 110, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b4/2c/df/b42cdfa8-508b-0a7b-ab64-219d9b62efbe/8809985025983.jpg/600x600bb.jpg", youtubeId: "F0B7HDiY-10" },
    { title: "I AM", artist: "IVE", group: "IVE", bpm: 128, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/d5/43/6c/d543d8e5-3fcd-2b36-a831-295b28a8d116/8809903901924.jpg/600x600bb.jpg", youtubeId: "6ZUIwj3FgCE" },

    // KISS OF LIFE
    { title: "Sticky", artist: "KISS OF LIFE", group: "KISS OF LIFE", bpm: 112, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/6f/9e/316f9e21-0a6f-f283-e18e-64c9ca404bc0/8809985028441.jpg/600x600bb.jpg", youtubeId: "b7XNCLrL4u0" },

    // ITZY
    { title: "UNTOUCHABLE", artist: "ITZY", group: "ITZY", bpm: 105, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/d5/43/d8/d543d8e5-3fcd-2b36-a831-295b28a8d116/8809973500201.jpg/600x600bb.jpg", youtubeId: "pSjmI-tDXXY" },
    { title: "WANNABE", artist: "ITZY", group: "ITZY", bpm: 122, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d2/88/54/d28854ef-5b32-e069-b141-945ec379058b/8809440339593.jpg/600x600bb.jpg", youtubeId: "fE2h3lGlOsk" },

    // (G)I-DLE
    { title: "Super Lady", artist: "(G)I-DLE", group: "i-dle", bpm: 128, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1c/fc/cc/1cfccc7a-42c2-84b2-038c-8f92bd3fbdf1/8809968434771.jpg/600x600bb.jpg", youtubeId: "qwJVjeO2x1A" },

    // EVERGLOW
    { title: "LA DI DA", artist: "EVERGLOW", group: "EVERGLOW", bpm: 135, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/6d/8a/cc/6d8accbb-246e-1d57-3a13-2d25f77dc328/8809633189196.jpg/600x600bb.jpg", youtubeId: "jeI992mvlMU" },

    // UNIS
    { title: "SUPERWOMAN", artist: "UNIS", group: "UNIS", bpm: 118, cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c9/79/cb/c979cbe8-27b0-81eb-c6ca-e33a59d57a2c/8809985023965.jpg/600x600bb.jpg", youtubeId: "41d_wDq8m9E" },

    // ------------------------------------
    // 🌌 YOUR CUSTOM LORE GROUPS 🌌
    // ------------------------------------

    // GIRLSET
    { 
        title: "Little Miss", 
        artist: "GIRLSET", 
        group: "GIRLSET", 
        bpm: 120, 
        cover: "https://jyp.com/500x500/ff0055/fff?text=GIRLSET", 
        youtubeId: "f5_wn8mexmM" // Placeholder: TWICE The Feels 
    },
    { 
        title: "SWEET", 
        artist: "GIRLSET", 
        group: "GIRLSET", 
        bpm: 125, 
        cover: "https://jyp.com/500x500/ff0055/fff?text=SWEET", 
        youtubeId: "mAKsZ26SabQ" // Placeholder: TWICE Talk that Talk
    },

    // Hearts2Hearts
    { 
        title: "RUDE!", 
        artist: "Hearts2Hearts", 
        group: "Hearts2Hearts", 
        bpm: 130, 
        cover: "https://jyp.com/500x500/00f5d4/000?text=H2H", 
        youtubeId: "dpsZ5E3A1yM" // Placeholder: STAYC ASAP
    },
    { 
        title: "The Chase", 
        artist: "Hearts2Hearts", 
        group: "Hearts2Hearts", 
        bpm: 115, 
        cover: "https://jyp.com/500x500/00f5d4/000?text=CHASE", 
        youtubeId: "XkrqA4hT92o" // Placeholder: STAYC RUN2U
    },

    // UNCHILD
    { 
        title: "UNCHILD", 
        artist: "UNCHILD", 
        group: "UNCHILD", 
        bpm: 110, 
        cover: "https://jyp.com/500x500/9d4edd/fff?text=UNCHILD", 
        youtubeId: "Kjb_kEExJc0" // Placeholder: Dreamcatcher BOCA
    }
];

let selectedArcadeSongIndex = 0;
let currentCombo = 0;
let stageScoreBonus = 0;
let stageInterval = null;

// Open the Song Select Screen
function openSongSelect() {
    // Hide the old modal if it accidentally fires
    const oldModal = document.getElementById("song-select-modal");
    if(oldModal) oldModal.style.display = "none";
    
    document.getElementById("arcade-song-select").style.display = "flex";
    renderArcadeTracklist();
    selectArcadeTrack(0);
}

function renderArcadeTracklist() {
    const list = document.getElementById("arcade-tracklist-container");
    list.innerHTML = arcadeSongs.map((song, i) => `
        <div class="arcade-track-item ${i === selectedArcadeSongIndex ? 'active' : ''}" onclick="selectArcadeTrack(${i})">
            <img src="${song.cover}">
            <div>
                <div style="font-weight: 900; color: white; font-size: 16px;">${song.title}</div>
                <div style="color: var(--text-muted); font-size: 11px;">${song.artist}</div>
            </div>
        </div>
    `).join("");
}

function selectArcadeTrack(index) {
    selectedArcadeSongIndex = index;
    const song = arcadeSongs[index];
    
    document.getElementById("arcade-cover").src = song.cover;
    document.getElementById("arcade-title").innerText = song.title;
    document.getElementById("arcade-artist").innerText = song.artist;
    document.getElementById("arcade-bpm-val").innerText = song.bpm;
    document.getElementById("arcade-high-score").innerText = Math.floor(Math.random() * 3000000).toLocaleString();
    
    // Spin the vinyl dynamically
    document.getElementById("vinyl-disc").style.animationDuration = `${(60 / song.bpm) * 4}s`;
    
    // FIX: Show YouTube MV link in the track info area
    let mvLinkEl = document.getElementById("arcade-mv-link");
    if (!mvLinkEl) {
        mvLinkEl = document.createElement("a");
        mvLinkEl.id = "arcade-mv-link";
        mvLinkEl.target = "_blank";
        mvLinkEl.rel = "noopener";
        mvLinkEl.style.cssText = "display:inline-block; margin-top:10px; color:#ff0055; font-size:11px; font-weight:900; letter-spacing:1px; text-decoration:none; border:1px solid #ff0055; padding:5px 12px; border-radius:20px;";
        mvLinkEl.textContent = "▶ WATCH MV";
        const trackInfo = document.querySelector(".arcade-track-info");
        if (trackInfo) trackInfo.appendChild(mvLinkEl);
    }
    if (song.youtubeId) {
        mvLinkEl.href = `https://www.youtube.com/watch?v=${song.youtubeId}`;
        mvLinkEl.style.display = "inline-block";
    } else {
        mvLinkEl.style.display = "none";
    }
    
    renderArcadeTracklist();
}
let currentStreamScore = 0;

function launch3DStage(diff) {
    if (user.hp < 1) return showToast("Not enough HP to stream!");

    user.hp -= 1;
    if (!user.missions) user.missions = { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false };
    user.missions.plays += 1;
    updateUI();

    document.getElementById("arcade-song-select").style.display = "none";
    const song = arcadeSongs[selectedArcadeSongIndex];
    
    // ✨ THE MATH: Calculate Deck Score ✨
    const group = song.group;
    let deckRawScore = 0;
    let deckThemeMultiplier = 1;

    if (user.deck && user.deck[group]) {
        const deck = user.deck[group];
        
        // 1. Calculate Raw Card Scores based on Grade & Level
        Object.values(deck).forEach(card => {
            const gradeBase = { 'R': 101, 'S': 82, 'A': 64, 'B': 46, 'C': 28 }[card.grade] || 10;
            deckRawScore += Math.floor(gradeBase + (card.level || 1) * 2.5);
        });

        // 2. Calculate Theme Bonus
        const themes = Object.values(deck).map(c => c.theme);
        const counts = {};
        themes.forEach(t => counts[t] = (counts[t] || 0) + 1);
        
        if (themes.length > 0) {
            const maxThemeCount = Math.max(...Object.values(counts));
            
            // +10% multiplier for every matching theme card (if they have at least 2)
            if (maxThemeCount >= 2) {
                deckThemeMultiplier = 1 + (maxThemeCount * 0.1); 
            }
        }
    }

    // ✨ Base stream score scales with difficulty (Easy=1, Normal=2, Hard=3)
    const diffMult = diff === "HARD" ? 3 : diff === "NORMAL" ? 2 : 1;
    const baseStreamScore = 10000 * diffMult;
    
    // ✨ Final League Score = (Base + Deck Stats) * Theme Bonus
    currentStreamScore = Math.floor((baseStreamScore + (deckRawScore * 500 * diffMult)) * deckThemeMultiplier);
    
    // ✨ DYNAMIC YOUTUBE UI INJECTION ✨
    const stage = document.getElementById("live-3d-stage");
    
    // We overwrite the inner HTML to remove the 3D highway and drop in the player
    stage.innerHTML = `
        <div style="width: 100%; max-width: 800px; padding: 20px; text-align: center; margin: auto;">
            <h2 style="color: white; letter-spacing: 2px; text-shadow: 0 0 10px #ff0055; margin-bottom: 5px;">STREAMING: ${song.title.toUpperCase()}</h2>
            <p style="color: var(--tertiary-glow); font-weight: bold; margin-bottom: 20px;">
                Deck Power: ${deckRawScore} | Theme Bonus: +${Math.round((deckThemeMultiplier - 1) * 100)}%
            </p>
            
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 2px solid var(--primary-glow); box-shadow: 0 0 30px rgba(255,0,85,0.4);">
                ${song.youtubeId ? `<iframe id="youtube-player" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                    src="https://www.youtube.com/embed/${song.youtubeId}?autoplay=1&rel=0"
                    frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
                : `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#555;gap:10px;"><span style="font-size:40px;">🎵</span><span style="font-size:13px;font-weight:900;letter-spacing:2px;">STREAMING ${song.title.toUpperCase()}</span></div>`}
            </div>
            
            <button class="btn btn-live" style="margin-top: 30px; padding: 15px 40px; font-size: 16px;" onclick="finishStream('${diff}')">FINISH & COLLECT REWARDS</button>
        </div>
    `;
    
    stage.style.display = "flex";
}
function finishStream(diff) {
    // Kill the YouTube player so the audio stops
    const stage = document.getElementById("live-3d-stage");
    stage.style.display = "none";
    stage.innerHTML = ""; 
    
    const diffMult = diff === "HARD" ? 3 : diff === "NORMAL" ? 2 : 1;
    showStreamResults(diffMult, arcadeSongs[selectedArcadeSongIndex], currentStreamScore);
}

function showStreamResults(multiplier, songData, finalScore) {
    // Generate fake rhythm stats just so the UI still looks cool
    const sp = Math.floor(finalScore * 0.0001); 
    const p = Math.floor(sp * 0.5);
    const g = Math.floor(p * 0.2);
    const m = 0;

    document.getElementById("stat-sp").innerText = sp;
    document.getElementById("stat-p").innerText = p;
    document.getElementById("stat-g").innerText = g;
    document.getElementById("stat-m").innerText = m;
    
    // Inject the real calculated deck score!
    document.getElementById("result-total-score").innerText = finalScore.toLocaleString();
    
    const earnedRP = Math.floor((finalScore / 2000) * multiplier);
    const earnedEXP = Math.floor(50 * multiplier);
    
    document.getElementById("result-rp").innerText = earnedRP;
    document.getElementById("result-exp").innerText = earnedEXP;
    document.getElementById("result-theme-bonus").innerText = "APPLIED"; 

    // Advance Missions
    trackMissionProgress("play", 1);
    if (songData && songData.group) { trackMissionProgress("play_group", 1, { group: songData.group }); }
    
    // Add to Firebase League Score
    if (typeof user !== 'undefined') {
        user.rp = (user.rp || 0) + earnedRP;
        user.exp = (user.exp || 0) + earnedEXP;
        user.leagueScore = (user.leagueScore || 0) + finalScore; 
        
        document.getElementById("rp-val").innerText = user.rp.toLocaleString();
        
        if (typeof db !== 'undefined' && typeof uid !== 'undefined') {
            db.collection("users").doc(uid).update({
                rp: user.rp,
                exp: user.exp,
                leagueScore: user.leagueScore
            }).catch(err => console.log("Offline mode: Score not saved to cloud.", err));
        }
    }

    document.getElementById("stage-result-modal").style.display = "flex";
}

// Ensure the Continue button can close it
function closeStageResult() {
    document.getElementById("stage-result-modal").style.display = "none";
    
    // Optionally trigger a UI refresh to update the EXP bar
    if (typeof updateUI === 'function') updateUI();
}
// Simulates hitting a note in the 3D highway
function hit3DNote() {
    const comboText = document.getElementById("live-combo-counter");
    const scoreText = document.getElementById("live-score-val");
    
    // Randomly flash one of the 4 lanes to simulate a hit
    const randomLane = Math.floor(Math.random() * 4) + 1;
    const laneEl = document.getElementById(`lane-${randomLane}`);
    laneEl.classList.add("flash");
    setTimeout(() => laneEl.classList.remove("flash"), 100);

    // Bouncing Combo Text
    currentCombo++;
    stageScoreBonus += (10 * currentCombo); 
    
    comboText.innerText = currentCombo;
    comboText.style.transform = "scale(1.4)";
    setTimeout(() => comboText.style.transform = "scale(1)", 50);
    
    // Update live score
    let currentScore = parseInt(scoreText.innerText) || 0;
    scoreText.innerText = String(currentScore + 350 + stageScoreBonus).padStart(7, '0');
    
    // Camera shake effect on the highway for impact
    const highway = document.querySelector(".highway-perspective");
    highway.style.transform = `rotateX(65deg) translateY(-100px) translateX(${Math.random() > 0.5 ? '2px' : '-2px'})`;
    setTimeout(() => highway.style.transform = "rotateX(65deg) translateY(-100px) translateX(0)", 50);
}

          


       
        function openSettings() {
          document.getElementById("settings-modal").style.display = "flex";
        }

        /* ✨ COUPON SYSTEM ✨ */
        /* ✨ LIVE FIREBASE MULTI-COUPON SYSTEM ✨ */
        async function claimCoupon() {
          const codeInput = document.getElementById("coupon-input");
          const code = codeInput.value.trim().toUpperCase();

          if (!user.claimedCoupons) user.claimedCoupons = [];

          if (code === "") return showToast("âš ï¸ Please enter a code.");
          if (user.claimedCoupons.includes(code)) return showToast("âš ï¸ Coupon already claimed!");

          showToast("Verifying code...");

          try {
            const couponDoc = await db.collection("coupons").doc(code).get();

            if (!couponDoc.exists) {
              return showToast("âš ï¸ Invalid or expired coupon code.");
            }

            const data = couponDoc.data();
            let rewardsToProcess = [];

            // Check if it's the NEW multi-reward format or the OLD single-reward format
            if (data.rewards && Array.isArray(data.rewards)) {
              rewardsToProcess = data.rewards; // New format
            } else {
              rewardsToProcess = [data]; // Fallback for your older codes
            }

            // Unpack every reward and send it as a separate mail item!
            rewardsToProcess.forEach((reward, index) => {
              user.inbox.push({
                id: Date.now().toString() + "_" + index, // Ensures unique ID for each mail
                title: `Coupon: ${code} [${index + 1}/${rewardsToProcess.length}]`,
                type: reward.type,
                packType: reward.packType || null,
                amount: reward.amount,
                grade: reward.grade || null,
              });
            });

            // Mark as claimed and clean up UI
            user.claimedCoupons.push(code);
            codeInput.value = "";
            document.getElementById("coupon-modal").style.display = "none";

            showToast(`✨ Coupon accepted! ${rewardsToProcess.length} item(s) sent to inbox.`);
            updateUI(); // Refreshes the red notification dot on the inbox
          } catch (error) {
            console.error("Firebase Coupon Error:", error);
            showToast("âš ï¸ Could not connect to the server.");
          }
        }

        /* ✨ EVENT MILESTONES ✨ */
        const milestones = [
          { count: 10, reward: "50 Diamonds", type: "diamonds", amount: 50 },
          { count: 50, reward: "1 Premium Pack", type: "pack", packType: "premium", amount: 1 },
          { count: 100, reward: "1 Random R Card", type: "pack", packType: "all_R", amount: 1 },
        ];

        function openEventModal() {
          if (!user.eventClaims) user.eventClaims = { 10: false, 50: false, 100: false };
          const totalCards = (user.inventory || []).length;
          document.getElementById("event-card-count").innerText = totalCards;

          const container = document.getElementById("event-milestones-container");
          container.innerHTML = milestones
            .map((m) => {
              const isClaimed = user.eventClaims[m.count];
              const isReady = totalCards >= m.count;
              let btnHtml = "";

              if (isClaimed) {
                btnHtml = `<button class="btn btn-draw" disabled style="padding: 8px; font-size: 10px; width: 100px; color: gray;">CLAIMED</button>`;
              } else if (isReady) {
                btnHtml = `<button class="btn btn-live" onclick="claimEventReward(${m.count})" style="padding: 8px; font-size: 10px; width: 100px;">CLAIM</button>`;
              } else {
                btnHtml = `<button class="btn btn-draw" disabled style="padding: 8px; font-size: 10px; width: 100px; opacity: 0.5;">${totalCards}/${m.count}</button>`;
              }

              return `
            <div class="mission-item" style="border-color: ${isReady && !isClaimed ? "var(--tertiary-glow)" : "var(--glass-border)"};">
                <div class="mission-info">
                    <h4 style="color: ${isReady && !isClaimed ? "var(--tertiary-glow)" : "white"};">Collect ${m.count} Cards</h4>
                    <p>Reward: <span style="color: white; font-weight: bold;">${m.reward}</span></p>
                </div>
                ${btnHtml}
            </div>`;
            })
            .join("");

          document.getElementById("event-modal").style.display = "flex";
        }

        function claimEventReward(count) {
          const milestone = milestones.find((m) => m.count === count);
          if (!milestone) return;

          user.eventClaims[count] = true;


       if (milestone.type === "pack") {
    generateCards(milestone.amount, milestone.packType || "premium");
} else {
    if (milestone.type === "diamonds") user.diamonds += milestone.amount;
    if (milestone.type === "rp") user.rp += milestone.amount;
}
showToast(`✨ Event Goal Reached!`);
        updateUI();
        openEventModal(); // Refresh modal
      }
function buySpecialEventPack(packType, group, theme, poolName, cost) {
    let needsSave = false; 

    if (packType === 'PROFILE') {
    // ✨ ONE-TIME PURCHASE CHECK
    if (!user.purchaseLimits) user.purchaseLimits = {};
    const profileKey = `profile_${group}_${theme}`;
    if (user.purchaseLimits[profileKey]) return showToast("⚠️ Already purchased this Profile Package!");
    
    if (user.diamonds < 800) return showToast("⚠️ Not enough Diamonds!");
    user.purchaseLimits[profileKey] = true;
    // ... rest of PROFILE code unchanged

} else if (packType === 'A_CARD') {
    // ✨ 3x PURCHASE LIMIT
    if (!user.purchaseLimits) user.purchaseLimits = {};
    const aCardKey = `acard_${group}_${theme}`;
    if (!user.purchaseLimits[aCardKey]) user.purchaseLimits[aCardKey] = 0;
    if (user.purchaseLimits[aCardKey] >= 3) return showToast("⚠️ Purchase limit reached! (3/3)");
    
    if (user.diamonds < 150) return showToast("⚠️ Not enough Diamonds!");
    user.diamonds -= 150;
    user.purchaseLimits[aCardKey]++;
    previousModalId = "shop-modal";
    document.getElementById("shop-modal").style.display = "none";
    generateCards(1, "event_specific", "A", group, theme);
    
    } else if (packType === 'PREMIUM_10') {
    if (user.diamonds < 200) return showToast("⚠️ Not enough Diamonds!");
    user.diamonds -= 200;
    previousModalId = "shop-modal"; // ✨ remember where we are
    document.getElementById("shop-modal").style.display = "none";
    generateCards(10, "event_premium", null, group, theme);
        
} else if (packType === 'R_PACK') {
    if (user.diamonds < 500) return showToast("⚠️ Not enough Diamonds!");
    user.diamonds -= 500;
    previousModalId = "shop-modal"; // FIX: redirect back to event shop after gacha
    document.getElementById("shop-modal").style.display = "none";
    generateCards(3, "event_specific", ["R", "A", "A"], group, theme);

} else if (packType === 'CUSTOM') {
    let numericCost = parseInt(cost) || 0;
    if (user.diamonds < numericCost) return showToast("⚠️ Not enough Diamonds!");
    user.diamonds -= numericCost;
    previousModalId = "shop-modal"; // FIX: redirect back to event shop after gacha
    document.getElementById("shop-modal").style.display = "none";
    generateCards(1, poolName, null, group, theme);
}
    
    // Save Profile/Currency data immediately
    if (needsSave && typeof uid !== 'undefined' && typeof db !== 'undefined') {
        user.unlockedPFPs = user.unlockedPFPs ? user.unlockedPFPs.filter(p => p != null) : [];
        db.collection("users").doc(uid).update({
            diamonds: user.diamonds,
            unlockedPFPs: user.unlockedPFPs
        }).catch((err) => console.error("Firebase Save Error:", err));
    }
// Award event points with rollover toward repeat rewards.
if (!user.eventPoints) user.eventPoints = {};
const eventKey = group + "_" + theme;
let currentEventPoints = Number(user.eventPoints[eventKey] || 0);
if (user.eventPoints[eventKey + "_goalClaimed"] && currentEventPoints >= EVENT_POINT_GOAL) {
    currentEventPoints = currentEventPoints % EVENT_POINT_GOAL;
    delete user.eventPoints[eventKey + "_goalClaimed"];
}

const pts = EVENT_POINT_REWARDS[packType] || 0;
if (pts > 0 && packType !== 'PROFILE') {
    const totalPoints = currentEventPoints + pts;
    const rewardCount = Math.floor(totalPoints / EVENT_POINT_GOAL);
    user.eventPoints[eventKey] = totalPoints % EVENT_POINT_GOAL;
    delete user.eventPoints[eventKey + "_goalClaimed"];

    showToast(`+${pts} Event Points! (${user.eventPoints[eventKey]}/${EVENT_POINT_GOAL} to next reward)`);

    if (rewardCount > 0) {
        setTimeout(() => {
            showToast(`${rewardCount} Point Reward${rewardCount > 1 ? "s" : ""} earned. R card incoming.`);
            if (typeof playRewardBurstSound === "function") playRewardBurstSound();
            if (typeof launchUiBurst === "function") launchUiBurst();
            for (let i = 0; i < rewardCount; i++) {
                setTimeout(() => generateCards(1, "event_specific", "R", group, theme), 800 + (i * 400));
            }
        }, 900);
    }
}
    if (typeof updateUI === 'function') updateUI();
    if (typeof injectEventPointBadges === 'function') setTimeout(injectEventPointBadges, 50); 
    if (typeof renderProfilePics === 'function') renderProfilePics(); 
}

// ✨ EVOLUTION LAB ENGINE ✨
let fusionSlots = [null, null, null];

function openEvolutionLab() {
    fusionSlots = [null, null, null];
    updateFusionUI();
    document.getElementById('evolution-lab-modal').style.display = 'flex';
}

function buyStepUp(eventId, group, theme) {
    if (!user.stepUpState) user.stepUpState = {};
    if (!user.stepUpState[eventId]) user.stepUpState[eventId] = 1;
    const step = user.stepUpState[eventId];

    if (step === 1) {
        // FREE — no cost
        previousModalId = "shop-modal"; // FIX: return to shop after gacha
        document.getElementById("shop-modal").style.display = "none";
        generateCards(1, "event_specific", "A", group, theme);
        user.stepUpState[eventId] = 2;

    } else if (step === 2) {
        if (user.diamonds < 200) return showToast("⚠️ Not enough Diamonds!");
        user.diamonds -= 200;
        previousModalId = "shop-modal"; // FIX: return to shop after gacha
        document.getElementById("shop-modal").style.display = "none";
        generateCards(1, "event_specific", "S", group, theme);
        user.stepUpState[eventId] = 3;

    } else if (step === 3) {
        if (user.diamonds < 400) return showToast("⚠️ Not enough Diamonds!");
        user.diamonds -= 400;
        previousModalId = "shop-modal"; // FIX: return to shop after gacha
        document.getElementById("shop-modal").style.display = "none";
        generateCards(1, "event_specific", "R", group, theme);
        user.stepUpState[eventId] = 4;

    } else {
        return showToast("✅ All Steps Completed!");
    }

    updateUI();
    renderStepUpUI(eventId);
}
function updateFusionUI() {
    for (let i = 0; i < 3; i++) {
        let slot = document.getElementById(`fuse-slot-${i+1}`);
        if (fusionSlots[i]) {
            // Re-uses your existing card URL logic!
            let imgUrl = typeof getSmallCardUrl === 'function' ? getSmallCardUrl(fusionSlots[i].url, fusionSlots[i].grade, fusionSlots[i].member, fusionSlots[i].theme, fusionSlots[i].group) : fusionSlots[i].url;
            slot.innerHTML = `<img src="${imgUrl}" style="border-radius: 8px;">`;
            slot.style.borderStyle = "solid";
            slot.style.borderColor = "#a855f7";
        } else {
            slot.innerHTML = "+";
            slot.style.borderStyle = "dashed";
            slot.style.borderColor = "rgba(255,255,255,0.3)";
        }
    }
}

// In a real app you'd open a picker, for now it auto-fills 3 random C/B/A cards for testing
function selectFuseCard(slotIndex) {
    let availableCards = user.inventory.filter(c => c.grade !== 'R' && c.grade !== 'LE' && !fusionSlots.includes(c));
    if (availableCards.length === 0) return showToast("No eligible cards to fuse!");
    
    // Check if the previous slots have a grade we need to match
    let requiredGrade = fusionSlots.find(c => c !== null)?.grade;
    if (requiredGrade) {
        availableCards = availableCards.filter(c => c.grade === requiredGrade);
        if (availableCards.length === 0) return showToast(`You need another ${requiredGrade} card!`);
    }

    fusionSlots[slotIndex - 1] = availableCards[0];
    updateFusionUI();
}

function executeFusion() {
    if (fusionSlots.includes(null)) return showToast("âš ï¸ Fill all 3 slots to fuse!");
    if (user.rp < 10000) return showToast("âš ï¸ Not enough RP! (Need 10,000)");

    let baseGrade = fusionSlots[0].grade;
    let nextGrade = baseGrade === 'C' ? 'B' : baseGrade === 'B' ? 'A' : baseGrade === 'A' ? 'S' : 'R';

    // Deduct RP and Remove cards from inventory
    user.rp -= 10000;
    fusionSlots.forEach(card => {
        let index = user.inventory.indexOf(card);
        if(index > -1) user.inventory.splice(index, 1);
    });

    // Award new card
    showToast(`🧬 FUSION SUCCESS! You forged an ${nextGrade} Card!`);
    
    // Add logic here to generate a random card of `nextGrade` into user.inventory
    fusionSlots = [null, null, null];
    updateFusionUI();
    if (typeof updateUI === "function") updateUI();
}
function showGracefulBundlePopup(themeName) {
    if (document.getElementById('graceful-bundle-modal')) {
        document.getElementById('graceful-bundle-modal').remove();
    }

    let modal = document.createElement("div");
    modal.id = "graceful-bundle-modal";
    modal.innerHTML = `
        <div style="background: rgba(0,0,0,0.85); position: fixed; top:0; left:0; width:100%; height:100%; z-index:99999; display:flex; justify-content:center; align-items:center; flex-direction:column; animation: fadeIn 0.3s;">
            <div style="background: linear-gradient(145deg, #1a1a1a, #2d2d2d); border: 2px solid #d4af37; border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 10px 40px rgba(212, 175, 55, 0.3); max-width: 450px; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <h2 style="color: #d4af37; margin-top: 0; font-family: sans-serif; letter-spacing: 2px;">ðŸŽ BUNDLE CLAIMED!</h2>
                <p style="color: white; margin-bottom: 30px;">You opened the <b style="color:#d4af37;">${themeName}</b>!</p>
                
                <div style="display:flex; justify-content:space-around; margin-bottom: 30px; gap: 15px;">
                    <div style="text-align:center; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; width: 30%;">
                        <div style="font-size: 35px; margin-bottom:10px;">💎</div>
                        <div style="color:white; font-weight:bold; font-size: 14px;">300 Dia</div>
                    </div>
                    <div style="text-align:center; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; width: 30%;">
                        <div style="font-size: 35px; margin-bottom:10px;">👤</div>
                        <div style="color:white; font-weight:bold; font-size: 14px;">Profile Set</div>
                    </div>
                </div>
                
                <p style="color: #aaa; font-size: 12px; margin-bottom: 20px;">*The Profile Set and Diamonds have been instantly added to your account!*</p>
                <button onclick="document.getElementById('graceful-bundle-modal').remove()" style="background: #d4af37; color: black; border: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 25px; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(212,175,55,0.4);">Awesome!</button>
            </div>
        </div>
        
    `;
    document.body.appendChild(modal);
}

// ✨ DYNAMIC CARD LIGHTING TRACKER ✨
// This calculates exactly where the cursor is hovering over any card
document.addEventListener("mousemove", (e) => {
    const interactiveCards = document.querySelectorAll(".ss-card, .premium-card, .upg-card-wrapper");
    
    interactiveCards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Sends the exact coordinates to the CSS file!
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
    });
});

/* ============================================================
 * INVENTORY GRID — CONSTANT MOUNT, FILTER-BY-CLASS  (v2 patch)
 * Avoids re-rendering thousands of <img> nodes on every group
 * switch. The DOM is built once per inventory mutation; filters
 * just toggle .hide on the existing cards.
 * ============================================================ */
(function () {
  let _lastInvSig = "";
  const origRender = typeof renderSuperstarRight === "function" ? renderSuperstarRight : null;
  if (!origRender) return;

  function buildOnce() {
    const grid = document.getElementById("ss-inv-grid");
    if (!grid || !user || !user.inventory) return;
    const sort = document.getElementById("ss-sort-select")?.value || "gradeDown";
    const gradeVals = { R: 5, S: 4, A: 3, B: 2, C: 1 };

    let list = user.inventory.map((c, i) => ({ ...c, originalIndex: i }));
    list.sort((a, b) => {
      const ae = typeof isCardEquipped === "function" ? isCardEquipped(a) : 0;
      const be = typeof isCardEquipped === "function" ? isCardEquipped(b) : 0;
      if (ae !== be) return be - ae;
      if (sort === "gradeUp") return gradeVals[a.grade] - gradeVals[b.grade];
      if (sort === "gradeDown") return gradeVals[b.grade] - gradeVals[a.grade];
      return b.originalIndex - a.originalIndex;
    });

    grid.innerHTML = list.map((c) => {
      const isEq = typeof isCardEquipped === "function" && isCardEquipped(c);
      const src = typeof getSmallCardUrl === "function"
        ? getSmallCardUrl(c.url, c.grade, c.member, c.theme, c.group)
        : c.url;
      const grp = (c.group || "").toLowerCase();
      const mem = (c.member || "").toLowerCase();
      return `<div class="ss-card img-placeholder ${isEq ? "equipped" : ""}"
        data-idx="${c.originalIndex}"
        data-grade="${c.grade}"
        data-group="${grp}"
        data-member="${mem}"
        onclick="openCardDetail(${c.originalIndex})">
          <img class="smooth-load" src="${src}" loading="lazy"
               onload="this.classList.add('loaded')"
               style="width:100%;height:100%;object-fit:contain;pointer-events:none;">
          ${c.locked ? '<div class="ss-lock"><i class="g g-lock"></i></div>' : ""}
        </div>`;
    }).join("");
  }

  function applyFilters(groupFilter) {
    const grid = document.getElementById("ss-inv-grid");
    if (!grid) return;
    const filter = document.getElementById("ss-filter-select")?.value || "ALL";
    const focusIdx = (typeof currentlyViewingCardIndex !== "undefined") ? currentlyViewingCardIndex : null;
    const focusCard = focusIdx !== null ? user.inventory[focusIdx] : null;
    const memberFocus = (typeof ssSelectedMember !== "undefined") ? ssSelectedMember : null;

    let shown = 0;
    grid.querySelectorAll(".ss-card").forEach((el) => {
      let show = true;
      const g = el.dataset.group, m = el.dataset.member, gr = el.dataset.grade;
      if (focusCard) {
        show = g === (focusCard.group || "").toLowerCase() && m === (focusCard.member || "").toLowerCase();
      } else if (memberFocus) {
        show = g === (groupFilter || "").toLowerCase() && m === memberFocus.toLowerCase();
      } else if (typeof ssGroupFilterActive !== "undefined" && ssGroupFilterActive && groupFilter) {
        show = g === groupFilter.toLowerCase();
      }
      if (show && ["R","S","A","B","C"].includes(filter) && gr !== filter) show = false;

      el.classList.toggle("hide", !show);
      el.classList.toggle("focused", focusIdx !== null && +el.dataset.idx === focusIdx);
      if (show) shown++;
    });

    const cntEl = document.getElementById("ss-inv-count");
    if (cntEl && typeof getUsedInventorySlots === "function" && typeof getMaxInventorySlots === "function") {
      cntEl.innerText = `${getUsedInventorySlots()} / ${getMaxInventorySlots()}`;
    }
    const clearBtn = document.getElementById("btn-clear-member");
    if (clearBtn) clearBtn.style.display = memberFocus ? "block" : "none";
  }

  window.renderSuperstarRight = function (groupFilter) {
    if (!user || !user.inventory) return;
    const sig = user.inventory.length + "|" + (document.getElementById("ss-sort-select")?.value || "");
    if (sig !== _lastInvSig) {
      buildOnce();
      _lastInvSig = sig;
    }
    applyFilters(groupFilter);
  };
})();


/* Runtime text repair for old mojibake emoji fragments in legacy renderers. */
(function () {
  const cp1252 = new Map([
    [0x20AC,0x80],[0x201A,0x82],[0x0192,0x83],[0x201E,0x84],[0x2026,0x85],[0x2020,0x86],
    [0x2021,0x87],[0x02C6,0x88],[0x2030,0x89],[0x0160,0x8A],[0x2039,0x8B],[0x0152,0x8C],
    [0x017D,0x8E],[0x2018,0x91],[0x2019,0x92],[0x201C,0x93],[0x201D,0x94],[0x2022,0x95],
    [0x2013,0x96],[0x2014,0x97],[0x02DC,0x98],[0x2122,0x99],[0x0161,0x9A],[0x203A,0x9B],
    [0x0153,0x9C],[0x017E,0x9E],[0x0178,0x9F]
  ]);

  function byteForChar(ch) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) return cp;
    return cp1252.get(cp) ?? null;
  }

  function decodeRun(run) {
    const bytes = [];
    for (const ch of run) {
      const b = byteForChar(ch);
      if (b === null) return run;
      bytes.push(b);
    }
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      return decoded;
    } catch {
      return run;
    }
  }

  window.repairMojibakeText = function (value) {
    return String(value ?? "")
      .replace(/âš ï¸/g, "Warning:")
      .replace(/[^\x00-\x7F]+/g, decodeRun);
  };

  const originalToast = typeof showToast === "function" ? showToast : null;
  if (originalToast) {
    window.showToast = showToast = function (message) {
      return originalToast(repairMojibakeText(message));
    };
  }

  function repairNodeText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (/[ðâÃï]/.test(node.nodeValue)) {
        node.nodeValue = repairMojibakeText(node.nodeValue);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    repairNodeText(document.body);
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && /[ðâÃï]/.test(node.nodeValue)) {
            node.nodeValue = repairMojibakeText(node.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            repairNodeText(node);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();

/* ============================================================
 * CARD DETAIL — small crown favourite button (v2 patch)
 * Injects a 28px crown toggle into the right-side info panel
 * each time the detail re-renders.
 * ============================================================ */
(function () {
  function injectCrown() {
    const panel = document.querySelector("#card-detail-modal .custom-modal");
    if (!panel) return;
    if (panel.querySelector(".fav-crown-btn")) return;
    const idx = (typeof currentlyViewingCardIndex !== "undefined") ? currentlyViewingCardIndex : null;
    if (idx === null || !user?.inventory?.[idx]) return;
    const card = user.inventory[idx];
    const fav = user.favoriteCard;
    const isFav = fav && fav.url === card.url && fav.grade === card.grade && fav.member === card.member;

    const btn = document.createElement("button");
    btn.className = "fav-crown-btn" + (isFav ? " on" : "");
    btn.title = isFav ? "Favourite card" : "Set as favourite";
    btn.innerHTML = '<i class="g g-crown"></i>';
    btn.onclick = (e) => {
      e.stopPropagation();
      if (typeof setFavoriteCard === "function") setFavoriteCard();
      else { user.favoriteCard = card; if (typeof updateUI === "function") updateUI(); }
    };
    panel.appendChild(btn);
  }
  const mo = new MutationObserver(injectCrown);
  document.addEventListener("DOMContentLoaded", () => {
    const m = document.getElementById("card-detail-modal");
    if (m) mo.observe(m, { childList: true, subtree: true, attributes: true });
  });
})();

/* ============================================================
 * LUCKY DRAW — creative reveal (v2 patch)
 * Overrides flipMinigameCard with a richer 3-stage reveal.
 * ============================================================ */
(function () {
  const REWARDS = [
    { type: "RP",       amount: 5000, glyph: "g-rp",      label: "RP",       color: "#ff5577" },
    { type: "Diamonds", amount: 50,   glyph: "g-diamond", label: "Diamonds", color: "#00f5d4" },
    { type: "HP",       amount: 15,   glyph: "g-hp",      label: "HP",       color: "#facc15" },
  ];

  window.openMinigame = function () {
    document.getElementById("minigame-modal").style.display = "flex";
    const result = document.getElementById("mg-result-text");
    if (result) { result.style.display = "none"; result.innerHTML = ""; }
    document.querySelectorAll("#mg-grid .lucky-card").forEach((c) => {
      c.className = "mg-card lucky-card";
      c.innerHTML = '<span class="lucky-card-back">?</span>';
    });
  };

  window.flipMinigameCard = function (element, index) {
    if (window.minigamePlayedToday) return showToast("You already played today!");
    window.minigamePlayedToday = true;
    if (typeof playClickSound === "function") playClickSound();

    const shuffled = [...REWARDS].sort(() => Math.random() - 0.5);
    const won = shuffled[0];

    const cards = [...document.querySelectorAll("#mg-grid .lucky-card")];
    cards.forEach((c) => c.classList.add("locked"));

    element.classList.add("flipping", "winner");
    element.style.setProperty("--prize-color", won.color);
    setTimeout(() => {
      element.innerHTML = `
        <div class="lucky-card-face">
          <i class="g ${won.glyph}"></i>
          <strong>${won.amount.toLocaleString()}</strong>
          <span>${won.label}</span>
        </div>`;
    }, 250);

    if (won.type === "RP") user.rp += won.amount;
    if (won.type === "Diamonds") user.diamonds += won.amount;
    if (won.type === "HP") user.hp += won.amount;

    const result = document.getElementById("mg-result-text");
    if (result) {
      result.innerHTML = `<span class="lucky-won">You won</span> <strong style="color:${won.color}">${won.amount.toLocaleString()} ${won.label}</strong>`;
      result.style.display = "block";
    }
    if (typeof updateUI === "function") updateUI();

    setTimeout(() => {
      cards.forEach((c, i) => {
        if (c === element) return;
        const r = shuffled[i] || shuffled[0];
        c.classList.add("revealed-miss");
        c.innerHTML = `<div class="lucky-card-face muted"><i class="g ${r.glyph}"></i><span>${r.label}</span></div>`;
      });
    }, 900);
  };
})();

/* ============================================================
 * STEP UP UI — richer card markup (v2 patch)
 * ============================================================ */
(function () {
  const STEPS = [
    { label: "STEP 1", line: "1 A-Grade Card", cost: "FREE",         btnCls: "stepup-btn event-buy-btn free"    },
    { label: "STEP 2", line: "1 S-Grade Card", cost: "200 Diamonds", btnCls: "stepup-btn event-buy-btn diamond" },
    { label: "STEP 3", line: "1 R-Grade Card", cost: "400 Diamonds", btnCls: "stepup-btn event-buy-btn rare"    },
  ];
  window.renderStepUpUI = function (eventId) {
    const desc = document.getElementById(`step-up-desc-${eventId}`);
    const btn  = document.getElementById(`step-up-btn-${eventId}`);
    if (!desc || !btn) return;
    if (!user.stepUpState) user.stepUpState = {};
    const state = user.stepUpState[eventId] || 1;
    const card  = desc.closest(".stepup-card") || desc.parentElement;
    if (card) {
      card.classList.add("stepup-card");
      card.dataset.stepupState = state;
    }
    if (state > 3) {
      desc.innerHTML = '<span class="stepup-done">All steps completed</span>';
      btn.innerText = "SOLD OUT";
      btn.disabled = true;
      btn.className = "stepup-btn event-buy-btn done";
      return;
    }
    const s = STEPS[state - 1];
    desc.innerHTML = `
      <div class="stepup-progress">
        ${STEPS.map((_, i) => `<span class="${i < state - 1 ? "done" : i === state - 1 ? "active" : ""}"></span>`).join("")}
      </div>
      <div class="stepup-label">${s.label}</div>
      <div class="stepup-line">${s.line}</div>`;
    btn.disabled = false;
    btn.className = s.btnCls;
    btn.innerHTML = s.cost === "FREE"
      ? 'CLAIM FREE'
      : `<i class="g g-diamond"></i> ${s.cost.replace(" Diamonds","")}`;
  };
})();

/* ============================================================
 * GLYPH SYSTEM (v2 patch)
 * Replaces broken/mojibake emojis with pure-CSS icons.
 * Use <i class="g g-NAME"></i> anywhere.
 * ============================================================ */

/* ============================================================
 * v3 UI/UX PATCH - event rewards, lucky draw, inventory, crown
 * ============================================================ */
(function () {
  const REWARD_COLORS = {
    rp: "var(--rp-color)",
    diamond: "var(--diamond-color)",
    diamonds: "var(--diamond-color)",
    hp: "var(--hp-color)",
    pack: "#9d4edd",
    vip: "var(--tertiary-glow)",
    PassEXP: "var(--tertiary-glow)"
  };

  const REWARD_GLYPHS = {
    rp: "g-rp",
    diamond: "g-diamond",
    diamonds: "g-diamond",
    hp: "g-hp",
    pack: "g-pack",
    vip: "g-crown",
    PassEXP: "g-star",
    card: "g-card"
  };

  function rewardColor(reward) {
    return reward?.color || REWARD_COLORS[reward?.type] || "#facc15";
  }

  function rewardGlyph(reward) {
    if (reward?.packType) return reward.packType === "regular" || reward.label?.includes("Card") ? "g-card" : "g-pack";
    return REWARD_GLYPHS[reward?.type] || "g-star";
  }

  function rewardName(reward) {
    if (!reward) return "Reward";
    if (reward.label) return reward.label;
    if (reward.type === "diamond") return "Diamonds";
    if (reward.type === "rp") return "RP";
    if (reward.type === "PassEXP") return "Pass EXP";
    return String(reward.type || "Reward");
  }

  function rewardAmount(reward) {
    if (!reward) return "";
    const prefix = reward.type === "pack" || reward.type === "vip" ? "x" : "+";
    return `${prefix}${Number(reward.amt || 0).toLocaleString()}`;
  }

  function rewardIconHTML(reward) {
    const color = rewardColor(reward);
    return `<i class="g ${rewardGlyph(reward)}" style="color:${color}; --reward-color:${color};"></i>`;
  }

  const baseSwitchMissionTab = typeof switchMissionTab === "function" ? switchMissionTab : null;
  window.switchMissionTab = switchMissionTab = function (tabId) {
    currentMissionTab = tabId;

    document.querySelectorAll(".m-tab").forEach((t) => t.classList.remove("active"));
    document.querySelector(`.m-tab[onclick*="'${tabId}'"]`)?.classList.add("active");

    const container = document.getElementById("mission-list-container");
    if (!container || !missionDB) return baseSwitchMissionTab ? baseSwitchMissionTab(tabId) : undefined;

    if (tabId === "event") {
      const events = missionDB.event_list || [];
      container.innerHTML = events.length
        ? events.map((ev) => {
            const clickAction = ev.isDirectLink ? `withLoadingCircle(() => { ${ev.action}() })` : `openEventDetail('${ev.id}')`;
            return `
              <div class="ev-list-banner" style="background-image: url('${ev.banner}');" onclick="${clickAction}">
                <div class="ev-list-tag">${ev.tag}</div>
              </div>`;
          }).join("")
        : `<p style="color: gray; text-align: center; margin-top: 40px;">No events active right now.</p>`;
      return;
    }

    const missions = missionDB[tabId];
    if (!missions || missions.length === 0) {
      container.innerHTML = `<p style="color: gray; text-align: center; margin-top: 40px;">No missions available right now.</p>`;
      return;
    }

    container.innerHTML = missions.map((m) => {
      let progress = user.missionProgress?.[m.id] || 0;
      if (progress > m.target) progress = m.target;

      const isClaimed = user.missionClaimed?.[m.id];
      const isReady = progress >= m.target;
      const color = rewardColor(m.reward);
      const percent = (progress / m.target) * 100;
      const btnHtml = isClaimed
        ? `<button class="btn m-btn btn-draw" disabled>CLAIMED</button>`
        : isReady
          ? `<button class="btn m-btn btn-live" onclick="executeClaimMission('${tabId}', '${m.id}')" style="box-shadow: 0 0 15px ${color};">CLAIM</button>`
          : `<button class="btn m-btn btn-draw" disabled style="opacity: 0.5;">LOCKED</button>`;

      return `
        <div class="m-card ${isClaimed ? "claimed" : ""}" style="border-left: 4px solid ${color};">
          <div class="m-reward-box">
            <div class="m-reward-icon">${rewardIconHTML(m.reward)}</div>
            <div class="m-reward-amt" style="color: ${color};">${rewardAmount(m.reward)}</div>
          </div>
          <div class="m-info">
            <div class="m-title">${m.title}</div>
            <div class="m-desc">${m.desc}</div>
            <div class="m-progress-wrap">
              <div class="m-progress-bg"><div class="m-progress-fill" style="width: ${percent}%;"></div></div>
              <div class="m-progress-txt">${progress}/${m.target}</div>
            </div>
          </div>
          ${btnHtml}
        </div>`;
    }).join("");
  };

  window.openEventDetail = openEventDetail = function (eventId) {
    const container = document.getElementById("mission-list-container");
    const missions = missionDB[eventId];
    if (!container || !missions) return;

    let html = `
      <button class="ev-back-btn" onclick="switchMissionTab('event')">BACK TO EVENTS</button>
      <div class="ev-banner">
        <div>
          <div class="ev-banner-title">Event mission rewards</div>
          <div class="ev-banner-subtitle">Rewards stay on the left. Progress stays readable.</div>
        </div>
        <div class="ev-banner-rewards">
          <div class="ev-reward-icon" style="--reward-color:#ff0055;color:#ff0055;">${rewardIconHTML({ type: "card", color: "#ff0055" })}</div>
          <div class="ev-reward-icon" style="--reward-color:#9d4edd;color:#9d4edd;">${rewardIconHTML({ type: "pack", color: "#9d4edd" })}</div>
          <div class="ev-reward-icon" style="--reward-color:#00f5d4;color:#00f5d4;">${rewardIconHTML({ type: "diamond", color: "#00f5d4" })}</div>
        </div>
      </div>`;

    html += missions.map((m) => {
      if (m.isHeader) {
        return `<div class="ev-section-title">${m.title}</div><div class="ev-section-desc">${m.desc}</div>`;
      }

      let progress = user.missionProgress?.[m.id] || 0;
      if (progress > m.target) progress = m.target;

      const percent = (progress / m.target) * 100;
      const isClaimed = user.missionClaimed?.[m.id];
      const isReady = progress >= m.target;
      const rowClass = isClaimed ? "claimed" : isReady ? "ready" : "";
      const rowClick = isReady && !isClaimed
        ? `onclick="executeClaimMission('${eventId}', '${m.id}')"`
        : `onclick="showToast('Mission in progress!')"`;
      const color = rewardColor(m.reward);

      return `
        <div class="ev-row v2 ${rowClass}" ${rowClick}>
          <div class="ev-reward-wrap left">
            <div class="ev-reward-icon" style="--reward-color:${color}; color:${color};">${rewardIconHTML(m.reward)}</div>
            <div class="ev-reward-text"><span>${rewardName(m.reward)}</span><strong>${rewardAmount(m.reward)}</strong></div>
          </div>
          <div class="ev-info">
            <div class="ev-title">${m.title}</div>
            <div class="ev-desc">${m.desc}</div>
            <div class="ev-progress-bar">
              <div class="ev-progress-fill" style="width: ${percent}%;"></div>
              <div class="ev-progress-text">${progress} / ${m.target}</div>
            </div>
          </div>
          <div class="ev-arrow" aria-hidden="true">›</div>
        </div>`;
    }).join("");

    container.innerHTML = html;
  };
})();

(function () {
  const DRAW_REWARDS = [
    { type: "RP", amount: 5000, glyph: "g-rp", label: "RP", color: "#ff5577" },
    { type: "Diamonds", amount: 50, glyph: "g-diamond", label: "Diamonds", color: "#00f5d4" },
    { type: "HP", amount: 15, glyph: "g-hp", label: "HP", color: "#facc15" }
  ];

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function applyLuckyReward(reward) {
    if (reward.type === "RP") user.rp += reward.amount;
    if (reward.type === "Diamonds") user.diamonds += reward.amount;
    if (reward.type === "HP") user.hp += reward.amount;
  }

  function luckyFace(reward, muted) {
    return `
      <div class="lucky-card-face ${muted ? "muted" : ""}">
        <i class="g ${reward.glyph}" style="color:${reward.color}; --prize-color:${reward.color};"></i>
        ${muted ? "" : `<strong>${reward.amount.toLocaleString()}</strong>`}
        <span>${reward.label}</span>
      </div>`;
  }

  window.openMinigame = openMinigame = function () {
    document.getElementById("minigame-modal").style.display = "flex";
    const result = document.getElementById("mg-result-text");
    if (result) {
      result.style.display = "none";
      result.innerHTML = "";
    }
    document.querySelectorAll("#mg-grid .lucky-card, #mg-grid .mg-card").forEach((card) => {
      card.className = "mg-card lucky-card";
      card.style.removeProperty("--prize-color");
      card.innerHTML = '<span class="lucky-card-back"><i class="g g-star"></i></span>';
    });
  };

  window.flipMinigameCard = flipMinigameCard = function (element, index) {
    if (window.minigamePlayedToday) return showToast("You already played today.");
    window.minigamePlayedToday = true;
    if (typeof playClickSound === "function") playClickSound();

    const deck = shuffle(DRAW_REWARDS);
    const won = deck[index] || deck[0];
    const cards = [...document.querySelectorAll("#mg-grid .lucky-card, #mg-grid .mg-card")];

    cards.forEach((card) => card.classList.add("locked"));
    element.classList.add("flipping", "winner");
    element.style.setProperty("--prize-color", won.color);

    setTimeout(() => {
      element.innerHTML = luckyFace(won, false);
      applyLuckyReward(won);
      if (typeof updateUI === "function") updateUI();

      const result = document.getElementById("mg-result-text");
      if (result) {
        result.innerHTML = `<span class="lucky-won">Lucky draw reward</span><strong style="color:${won.color}">${won.amount.toLocaleString()} ${won.label}</strong>`;
        result.style.display = "block";
      }
    }, 260);

    setTimeout(() => {
      cards.forEach((card, i) => {
        if (card === element) return;
        const reward = deck[i] || deck.find((r) => r !== won) || won;
        card.classList.add("revealed-miss");
        card.innerHTML = luckyFace(reward, true);
      });
    }, 900);
  };
})();

(function () {
  let lastInventorySignature = "";

  function sameCard(a, b) {
    return !!a && !!b &&
      a.url === b.url &&
      a.grade === b.grade &&
      a.member === b.member &&
      a.theme === b.theme &&
      a.group === b.group;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function signatureForInventory() {
    const sort = document.getElementById("ss-sort-select")?.value || "gradeDown";
    const deckSig = JSON.stringify(user?.deck || {});
    const invSig = (user?.inventory || []).map((card, index) => [
      index,
      card?.id || card?.url || "",
      card?.grade || "",
      card?.level || 1,
      card?.locked ? 1 : 0,
      card?.member || "",
      card?.theme || "",
      card?.group || ""
    ].join("^")).join("|");
    return `${sort}::${deckSig}::${invSig}`;
  }

  function buildInventoryGrid() {
    const grid = document.getElementById("ss-inv-grid");
    if (!grid || !user?.inventory) return;

    const sort = document.getElementById("ss-sort-select")?.value || "gradeDown";
    const gradeVals = { R: 5, S: 4, A: 3, B: 2, C: 1 };
    const list = user.inventory.map((card, index) => ({ ...card, originalIndex: index }));
    list.sort((a, b) => {
      const ae = typeof isCardEquipped === "function" ? isCardEquipped(a) : 0;
      const be = typeof isCardEquipped === "function" ? isCardEquipped(b) : 0;
      if (ae !== be) return be - ae;
      if (sort === "gradeUp") return (gradeVals[a.grade] || 0) - (gradeVals[b.grade] || 0);
      if (sort === "gradeDown") return (gradeVals[b.grade] || 0) - (gradeVals[a.grade] || 0);
      return b.originalIndex - a.originalIndex;
    });

    const favorite = user.favoriteCard;
    grid.innerHTML = list.map((card) => {
      const isEq = typeof isCardEquipped === "function" && isCardEquipped(card);
      const isFav = sameCard(card, favorite);
      const src = typeof getSmallCardUrl === "function"
        ? getSmallCardUrl(card.url, card.grade, card.member, card.theme, card.group)
        : card.url;
      return `
        <div class="ss-card img-placeholder ${isEq ? "equipped" : ""}"
          data-idx="${card.originalIndex}"
          data-grade="${esc(card.grade)}"
          data-group="${esc(card.group).toLowerCase()}"
          data-member="${esc(card.member).toLowerCase()}"
          onclick="openCardDetail(${card.originalIndex})">
          <img class="smooth-load" src="${esc(src)}" loading="lazy"
            onload="this.classList.add('loaded')"
            style="width:100%;height:100%;object-fit:contain;pointer-events:none;">
          ${card.locked ? '<div class="ss-lock"><i class="g g-lock"></i></div>' : ""}
          ${isFav ? '<div class="ss-fav"><i class="g g-crown"></i></div>' : ""}
        </div>`;
    }).join("");
  }

  function applyInventoryFilters(groupFilter) {
    const grid = document.getElementById("ss-inv-grid");
    if (!grid || !user?.inventory) return;

    const gradeFilter = document.getElementById("ss-filter-select")?.value || "all";
    const focusIdx = typeof currentlyViewingCardIndex !== "undefined" ? currentlyViewingCardIndex : null;
    const focusCard = focusIdx !== null ? user.inventory[focusIdx] : null;
    const memberFocus = typeof ssSelectedMember !== "undefined" ? ssSelectedMember : null;
    const normalizedGroup = (groupFilter || "").toLowerCase();

    grid.querySelectorAll(".ss-card").forEach((el) => {
      let show = true;
      const g = el.dataset.group || "";
      const m = el.dataset.member || "";
      const grade = el.dataset.grade || "";

      if (focusCard) {
        show = g === (focusCard.group || "").toLowerCase() && m === (focusCard.member || "").toLowerCase();
      } else if (memberFocus) {
        show = g === normalizedGroup && m === memberFocus.toLowerCase();
      } else if (typeof ssGroupFilterActive !== "undefined" && ssGroupFilterActive && groupFilter) {
        show = g === normalizedGroup;
      }

      if (show && ["R", "S", "A", "B", "C"].includes(gradeFilter) && grade !== gradeFilter) show = false;

      el.classList.toggle("hide", !show);
      el.classList.toggle("focused", focusIdx !== null && Number(el.dataset.idx) === focusIdx);
    });

    const count = document.getElementById("ss-inv-count");
    if (count && typeof getUsedInventorySlots === "function" && typeof getMaxInventorySlots === "function") {
      count.innerText = `${getUsedInventorySlots()} / ${getMaxInventorySlots()}`;
    }

    const clearBtn = document.getElementById("btn-clear-member");
    if (clearBtn) clearBtn.style.display = memberFocus ? "block" : "none";
  }

  window.renderSuperstarRight = renderSuperstarRight = function (groupFilter) {
    if (!user?.inventory) return;
    const signature = signatureForInventory();
    if (signature !== lastInventorySignature) {
      buildInventoryGrid();
      lastInventorySignature = signature;
    }
    applyInventoryFilters(groupFilter);
  };

  const baseSetFavoriteCard = typeof setFavoriteCard === "function" ? setFavoriteCard : null;
  window.setFavoriteCard = setFavoriteCard = function () {
    if (currentlyViewingCardIndex === null || !user?.inventory?.[currentlyViewingCardIndex]) {
      return baseSetFavoriteCard ? baseSetFavoriteCard() : undefined;
    }
    user.favoriteCard = user.inventory[currentlyViewingCardIndex];
    showToast("Favorite card updated.");
    if (typeof updateUI === "function") updateUI();
    lastInventorySignature = "";
    renderSuperstarRight(Object.keys(themeDatabase || {}).sort()[currentSsGroupIndex]);
    updateInspectorCrown();
  };

  function updateInspectorCrown() {
    const panel = document.getElementById("ss-right-inspector-view");
    const btn = panel?.querySelector(".inspector-crown");
    if (!btn || currentlyViewingCardIndex === null) return;
    btn.classList.toggle("on", sameCard(user.favoriteCard, user.inventory[currentlyViewingCardIndex]));
    btn.title = btn.classList.contains("on") ? "Favorite card" : "Set as favorite";
  }

  function injectInspectorCrown() {
    const panel = document.getElementById("ss-right-inspector-view");
    const tools = panel?.firstElementChild;
    if (!panel || !tools || tools.querySelector(".inspector-crown") || currentlyViewingCardIndex === null) return;

    const btn = document.createElement("button");
    btn.className = "fav-crown-btn inspector-crown";
    btn.type = "button";
    btn.innerHTML = '<i class="g g-crown"></i>';
    btn.onclick = (event) => {
      event.stopPropagation();
      setFavoriteCard();
    };
    tools.insertBefore(btn, tools.firstChild);
    updateInspectorCrown();
  }

  const baseInspector = typeof renderSuperstarInspector === "function" ? renderSuperstarInspector : null;
  if (baseInspector) {
    window.renderSuperstarInspector = renderSuperstarInspector = function () {
      baseInspector();
      injectInspectorCrown();
    };
  }
})();

/* ============================================================
 * SUPERSTAR UI REFRESH - card book, event banners, point loop
 * ============================================================ */
(function () {
  const GRADE_ORDER = { R: 5, S: 4, A: 3, B: 2, C: 1 };
  const GRADE_POINTS = { R: 15, S: 10, A: 7, B: 5, C: 3 };

  function normalizeGrade(grade) {
    const text = String(grade ?? "C").trim().toUpperCase();
    if (GRADE_ORDER[text]) return text;
    const numeric = Number(grade);
    if (Number.isFinite(numeric)) {
      if (numeric >= 5) return "R";
      if (numeric === 4) return "S";
      if (numeric === 3) return "A";
      if (numeric === 2) return "B";
    }
    return "C";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function jsArg(value) {
    return JSON.stringify(String(value ?? "")).replace(/"/g, "&quot;");
  }

  function formatKey(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  function allThemesForGroup(groupData) {
    return [...(groupData?.themes || []), ...(groupData?.le_themes || [])];
  }

  function gradeColor(grade) {
    return {
      R: "#ff3d71",
      S: "#facc15",
      A: "#00bbf9",
      B: "#a855f7",
      C: "#94a3b8"
    }[normalizeGrade(grade)];
  }

  window.playRewardBurstSound = function () {
    const sound = typeof sfxEpicReveal !== "undefined" ? sfxEpicReveal : (typeof sfxRareReveal !== "undefined" ? sfxRareReveal : null);
    if (!sound) return;
    sound.volume = Math.min(1, (globalSfxVolume || 0.6) * 0.85);
    sound.currentTime = 0;
    sound.play().catch(() => {});
  };

  window.launchUiBurst = function () {
    const layer = document.createElement("div");
    layer.className = "ui-burst-layer";
    for (let i = 0; i < 24; i++) {
      const p = document.createElement("span");
      p.style.setProperty("--tx", `${(Math.random() - 0.5) * 340}px`);
      p.style.setProperty("--ty", `${(Math.random() - 0.65) * 260}px`);
      p.style.setProperty("--delay", `${Math.random() * 0.14}s`);
      p.style.setProperty("--burst-color", ["#ff3d71", "#00f5d4", "#facc15", "#7dd3fc"][i % 4]);
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1100);
  };

  window.openLobbyBannerDirectory = function () {
    const missions = document.getElementById("missions-modal");
    if (!missions) return;
    if (!user.missionProgress) user.missionProgress = {};
    if (!user.missionClaimed) user.missionClaimed = {};
    missions.style.display = "flex";
    if (typeof switchMissionTab === "function") switchMissionTab("event");
    const list = document.getElementById("mission-list-container");
    if (list) {
      list.classList.add("banner-board-open");
      setTimeout(() => list.classList.remove("banner-board-open"), 900);
    }
  };

  const baseUpdateLobbyBannerUI = typeof updateLobbyBannerUI === "function" ? updateLobbyBannerUI : null;
  if (baseUpdateLobbyBannerUI) {
    window.updateLobbyBannerUI = updateLobbyBannerUI = function () {
      baseUpdateLobbyBannerUI();
      const banner = document.getElementById("lobby-promo-banner");
      if (banner) {
        banner.title = "Open available event banners";
        banner.setAttribute("aria-label", "Open available event banners");
      }
    };
  }

  const baseSwitchMissionTab = typeof switchMissionTab === "function" ? switchMissionTab : null;
  if (baseSwitchMissionTab) {
    window.switchMissionTab = switchMissionTab = function (tabId) {
      if (tabId !== "event") return baseSwitchMissionTab(tabId);
      currentMissionTab = tabId;
      document.querySelectorAll(".m-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelector(`.m-tab[onclick*="'${tabId}'"]`)?.classList.add("active");

      const container = document.getElementById("mission-list-container");
      const events = missionDB?.event_list || [];
      if (!container) return;
      container.innerHTML = events.length ? `
        <div class="event-board-head">
          <span>Event Board</span>
          <strong>${events.length} banner${events.length > 1 ? "s" : ""} available</strong>
        </div>
        <div class="event-board-grid">
          ${events.map((ev, index) => {
            const clickAction = ev.isDirectLink ? `withLoadingCircle(() => { ${ev.action}() })` : `openEventDetail(${jsArg(ev.id)})`;
            return `
              <button class="ev-list-banner event-board-card" style="background-image: url('${esc(ev.banner)}');" onclick="${clickAction}">
                <span class="ev-list-tag">${esc(ev.tag || "EVENT")}</span>
                <span class="event-board-shine"></span>
                <span class="event-board-copy">
                  <small>Banner ${index + 1}</small>
                  <strong>${esc(ev.title || "Special Event")}</strong>
                </span>
                <span class="event-board-cta">Open</span>
              </button>`;
          }).join("")}
        </div>` : `<p style="color: gray; text-align: center; margin-top: 40px;">No events active right now.</p>`;
    };
  }

  window.calculateCardBookData = calculateCardBookData = function () {
    cbCalculatedData = {
      totalUniqueCards: 0,
      totalThemePoints: 0,
      groupStats: {},
      bestGroup: { name: "NONE", points: 0, maxGrade: "C" },
      groupedInventory: {}
    };

    (user.inventory || []).forEach((card) => {
      if (!card || card.type === "material" || !card.group || !card.theme || !card.member) return;
      const group = card.group;
      const theme = card.theme;
      const member = card.member;
      const grade = normalizeGrade(card.grade);
      cbCalculatedData.groupedInventory[group] ||= {};
      cbCalculatedData.groupedInventory[group][theme] ||= {};
      const current = cbCalculatedData.groupedInventory[group][theme][member];
      if (!current || GRADE_ORDER[grade] > GRADE_ORDER[current]) {
        cbCalculatedData.groupedInventory[group][theme][member] = grade;
      }
    });

    Object.keys(themeDatabase || {}).forEach((group) => {
      cbCalculatedData.groupStats[group] = { points: 0, maxGrade: null, owned: 0, total: 0 };
      const dbGroup = themeDatabase[group] || {};
      const themes = allThemesForGroup(dbGroup);
      cbCalculatedData.groupStats[group].total = themes.length * (dbGroup.members || []).length;
      const groupData = cbCalculatedData.groupedInventory[group] || {};
      let maxWeight = 0;

      Object.keys(groupData).forEach((theme) => {
        Object.keys(groupData[theme]).forEach((member) => {
          const grade = normalizeGrade(groupData[theme][member]);
          const points = GRADE_POINTS[grade] || 0;
          cbCalculatedData.totalUniqueCards++;
          cbCalculatedData.totalThemePoints += points;
          cbCalculatedData.groupStats[group].points += points;
          cbCalculatedData.groupStats[group].owned++;
          if (GRADE_ORDER[grade] > maxWeight) {
            maxWeight = GRADE_ORDER[grade];
            cbCalculatedData.groupStats[group].maxGrade = grade;
          }
        });
      });

      if (cbCalculatedData.groupStats[group].points > cbCalculatedData.bestGroup.points) {
        cbCalculatedData.bestGroup = {
          name: group,
          points: cbCalculatedData.groupStats[group].points,
          maxGrade: cbCalculatedData.groupStats[group].maxGrade || "C"
        };
      }
    });
  };

  window.renderCardBookMain = renderCardBookMain = function () {
    const mainView = document.getElementById("cb-view-main");
    if (!mainView) return;
    if (!user.cbMilestones) user.cbMilestones = { cardsLevel: 1, themesLevel: 1 };

    const cardsTarget = user.cbMilestones.cardsLevel * 50;
    const themesTarget = user.cbMilestones.themesLevel * 500;
    const diamondReward = user.cbMilestones.cardsLevel * 10;
    const rpReward = user.cbMilestones.themesLevel * 5000;
    const best = cbCalculatedData.bestGroup;
    const bestColor = gradeColor(best.maxGrade);
    const cardsPct = Math.min(100, (cbCalculatedData.totalUniqueCards / cardsTarget) * 100);
    const themesPct = Math.min(100, (cbCalculatedData.totalThemePoints / themesTarget) * 100);

    mainView.innerHTML = `
      <section class="cb-hero-refresh">
        <div class="cb-hero-copy">
          <span>Top Collection</span>
          <strong>${esc(best.name)}</strong>
          <p>${cbCalculatedData.totalUniqueCards.toLocaleString()} unique cards logged across ${(Object.keys(themeDatabase || {}).length).toLocaleString()} groups.</p>
        </div>
        <div class="cb-grade-medal" style="--grade-color:${bestColor};">${esc(best.maxGrade || "C")}</div>
      </section>

      <section class="cb-metric-grid">
        <div class="cb-metric">
          <span>Theme Points</span>
          <strong>${cbCalculatedData.totalThemePoints.toLocaleString()}</strong>
        </div>
        <div class="cb-metric">
          <span>Best Group</span>
          <strong>${esc(best.name)}</strong>
        </div>
        <div class="cb-metric">
          <span>Milestone Level</span>
          <strong>${user.cbMilestones.cardsLevel} / ${user.cbMilestones.themesLevel}</strong>
        </div>
      </section>

      <section class="cb-reward-stack">
        <div class="cb-reward-box cb-reward-refresh">
          <div class="cb-reward-header">
            <div>
              <span class="cb-kicker aqua">Card Collector</span>
              <h3>Unlock ${cardsTarget.toLocaleString()} unique cards</h3>
            </div>
            <strong>${cbCalculatedData.totalUniqueCards.toLocaleString()} / ${cardsTarget.toLocaleString()}</strong>
          </div>
          <div class="cb-progress"><span style="width:${cardsPct}%"></span></div>
          <div class="cb-reward-footer">
            <span><i class="g g-diamond"></i> ${diamondReward.toLocaleString()} Diamonds</span>
            <button class="btn btn-draw cb-claim-btn" ${cbCalculatedData.totalUniqueCards >= cardsTarget ? `onclick="claimCBMilestone('cards', ${diamondReward})"` : "disabled"}>${cbCalculatedData.totalUniqueCards >= cardsTarget ? "Claim" : "Locked"}</button>
          </div>
        </div>

        <div class="cb-reward-box cb-reward-refresh warm">
          <div class="cb-reward-header">
            <div>
              <span class="cb-kicker rose">Theme Mastery</span>
              <h3>Reach ${themesTarget.toLocaleString()} card book points</h3>
            </div>
            <strong>${cbCalculatedData.totalThemePoints.toLocaleString()} / ${themesTarget.toLocaleString()}</strong>
          </div>
          <div class="cb-progress"><span style="width:${themesPct}%"></span></div>
          <div class="cb-reward-footer">
            <span><i class="g g-rp"></i> ${rpReward.toLocaleString()} RP</span>
            <button class="btn btn-live cb-claim-btn" ${cbCalculatedData.totalThemePoints >= themesTarget ? `onclick="claimCBMilestone('themes', ${rpReward})"` : "disabled"}>${cbCalculatedData.totalThemePoints >= themesTarget ? "Claim" : "Locked"}</button>
          </div>
        </div>
      </section>`;
  };

  window.renderCardBookGroups = renderCardBookGroups = function () {
    const grid = document.getElementById("cb-view-groups");
    if (!grid) return;
    const groups = Object.keys(themeDatabase || {}).sort();

    grid.innerHTML = groups.map((group) => {
      const stats = cbCalculatedData.groupStats[group] || { points: 0, maxGrade: "C", owned: 0, total: 0 };
      const pct = stats.total ? Math.round((stats.owned / stats.total) * 100) : 0;
      const color = gradeColor(stats.maxGrade || "C");
      return `
        <button class="cb-group-card cb-group-refresh" onclick="openCardBookSpecific(${jsArg(group)})" style="--grade-color:${color};">
          <span class="cb-group-logo">${esc(stats.maxGrade || "C")}</span>
          <strong class="cb-group-name">${esc(group)}</strong>
          <span class="cb-group-points">${stats.points.toLocaleString()} pts</span>
          <span class="cb-mini-progress"><span style="width:${pct}%"></span></span>
          <small>${stats.owned.toLocaleString()} / ${stats.total.toLocaleString()} slots</small>
        </button>`;
    }).join("");
  };

  window.openCardBookSpecific = openCardBookSpecific = function (group) {
    switchCardBookTab("specific");
    const title = document.getElementById("cb-specific-group-name");
    const list = document.getElementById("cb-specific-themes");
    if (!list) return;
    if (title) title.innerText = group;

    const dbGroup = themeDatabase[group] || {};
    const members = dbGroup.members || [];
    const themes = allThemesForGroup(dbGroup);

    list.innerHTML = themes.map((theme) => {
      const themeData = cbCalculatedData.groupedInventory[group]?.[theme] || {};
      const owned = members.filter((member) => themeData[member]).length;
      const pct = members.length ? Math.round((owned / members.length) * 100) : 0;
      const isLE = (dbGroup.le_themes || []).some((leTheme) => formatKey(leTheme) === formatKey(theme));
      const cards = members.map((member) => {
        const ownedCards = (user.inventory || []).filter((card) =>
          card &&
          formatKey(card.group) === formatKey(group) &&
          formatKey(card.member) === formatKey(member) &&
          formatKey(card.theme) === formatKey(theme)
        );

        if (ownedCards.length) {
          ownedCards.sort((a, b) =>
            (GRADE_ORDER[normalizeGrade(b.grade)] * 100 + (b.level || 1)) -
            (GRADE_ORDER[normalizeGrade(a.grade)] * 100 + (a.level || 1))
          );
          return `<div class="cb-card-slot">${createCardHTML(ownedCards[0], false, null)}</div>`;
        }

        const ghostUrl = getGhostCardUrl(group, member, theme);
        const ratio = isLE ? "270 / 360" : "2.5 / 3.5";
        return `
          <div class="cb-card-slot unowned">
            <div class="ss-card ghost" style="aspect-ratio:${ratio} !important;">
              <img src="${esc(ghostUrl)}" style="opacity:.48; object-fit:contain;">
            </div>
            <small>${esc(member)}</small>
          </div>`;
      }).join("");

      return `
        <section class="cb-theme-row cb-theme-refresh">
          <div class="cb-theme-header">
            <div>
              <span>${esc(theme)}</span>
              <small>${owned} of ${members.length} members</small>
            </div>
            <div class="cb-theme-meta">
              ${isLE ? `<span class="tag-limited">Limited</span>` : ""}
              <strong>${pct}%</strong>
            </div>
          </div>
          <div class="cb-theme-progress"><span style="width:${pct}%"></span></div>
          <div class="cb-theme-cards">${cards}</div>
        </section>`;
    }).join("");
  };

  window.injectEventPointBadges = injectEventPointBadges = function () {
    const packLabels = {
      PROFILE: { pts: EVENT_POINT_REWARDS.PROFILE, label: "One-time", color: "#a855f7" },
      A_CARD: { pts: EVENT_POINT_REWARDS.A_CARD, label: "+15 pts", color: "#22d3ee" },
      R_PACK: { pts: EVENT_POINT_REWARDS.R_PACK, label: "+70 pts", color: "#f97316" },
      PREMIUM_10: { pts: EVENT_POINT_REWARDS.PREMIUM_10, label: "+35 pts", color: "#facc15" }
    };

    document.querySelectorAll('[onclick*="buySpecialEventPack"]').forEach((el) => {
      const match = el.getAttribute("onclick")?.match(/buySpecialEventPack\(['"](\w+)['"]/);
      if (!match) return;
      const info = packLabels[match[1]];
      if (!info) return;
      el.classList.add("event-buy-with-badge");
      el.style.position = "relative";
      let badge = el.querySelector(".ep-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "ep-badge ep-badge-v2";
        el.appendChild(badge);
      }
      badge.style.background = info.color;
      badge.innerText = match[1] === "PROFILE" ? info.label : `+${info.pts} pts`;
    });

    document.querySelectorAll("[data-event-group][data-event-theme]").forEach((container) => {
      const group = container.dataset.eventGroup;
      const theme = container.dataset.eventTheme;
      const key = `${group}_${theme}`;
      let points = Number(user.eventPoints?.[key] || 0);
      if (points >= EVENT_POINT_GOAL) points %= EVENT_POINT_GOAL;
      const pct = Math.min(100, (points / EVENT_POINT_GOAL) * 100);
      let panel = container.querySelector(".event-point-panel");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "event-point-panel";
        container.prepend(panel);
      }
      panel.innerHTML = `
        <div class="event-point-copy">
          <span>Point Reward Loop</span>
          <strong>${points} / ${EVENT_POINT_GOAL}</strong>
        </div>
        <div class="event-point-track"><span style="width:${pct}%"></span></div>
        <small>Every ${EVENT_POINT_GOAL} points grants another R event card. Extra points roll into the next reward.</small>`;
    });
  };

  window.renderCardBook = renderCardBook = function () {
    calculateCardBookData();
    const specific = document.getElementById("cb-view-specific");
    const groups = document.getElementById("cb-view-groups");
    if (specific && specific.style.display !== "none") {
      const group = document.getElementById("cb-specific-group-name")?.innerText;
      if (group) return openCardBookSpecific(group);
    }
    if (groups && groups.style.display !== "none") return renderCardBookGroups();
    return renderCardBookMain();
  };
})();

/* ═══════════════════════════════════════════════════════════════════
   SHINING SUPERSTAR — ENGINE PATCH v2
   Paste this at the BOTTOM of engine.js

   What this does:
   - Upgrades renderStepUpUI() to also update the visual tracker nodes
   - Adds updateStepUpVisual() helper
   - Adds initEventShopAnimations() for polish
   - Shared LE theme support: no engine changes needed — works as-is
     because the composite key is group_theme per event point tracking
═══════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────
   STEP-UP VISUAL TRACKER PATCH
   Upgrades the boring text-only step-up to show the visual node track
────────────────────────────────────────────────────────────────── */

(function () {

  // Override the existing renderStepUpUI with the upgraded version
  const _origRenderStepUp = typeof renderStepUpUI === 'function' ? renderStepUpUI : null;

  window.renderStepUpUI = function (eventId) {
    // 1. Run the original text update (for backward compat)
    if (_origRenderStepUp) _origRenderStepUp(eventId);

    // 2. Update the visual tracker nodes if they exist in DOM
    updateStepUpVisual(eventId);
  };

  window.updateStepUpVisual = function (eventId) {
    const track = document.getElementById('stepup-track-' + eventId);
    if (!track) return;

    const step = (user.stepUpState && user.stepUpState[eventId]) || 1;
    const nodes = track.querySelectorAll('.stepup-node');
    const connectors = track.querySelectorAll('.stepup-connector');

    // Node 0 = free (step 1), 1 = step 2, 2 = step 3, 3 = done (after step 4)
    nodes.forEach((node, i) => {
      node.classList.remove('active-step', 'completed-step');

      if (step === 4) {
        // All done
        node.classList.add('completed-step');
        node.style.opacity = '1';
      } else if (i < step - 1) {
        // Completed steps
        node.classList.add('completed-step');
        node.style.opacity = '0.5';
      } else if (i === step - 1) {
        // Active step
        node.classList.add('active-step');
        node.style.opacity = '1';
      } else {
        // Future steps
        node.style.opacity = '0.3';
      }
    });

    // Connectors light up for completed transitions
    connectors.forEach((conn, i) => {
      conn.classList.toggle('done', i < step - 1);
    });

    // Update button label for free step
    const btn = document.getElementById('step-up-btn-' + eventId);
    if (btn) {
      btn.classList.remove('free');
      if (step === 1) btn.classList.add('free');
    }
  };

  // On page load, init all visible step-up trackers
  function initAllStepUps() {
    const allStepButtons = document.querySelectorAll('[id^="step-up-btn-"]');
    allStepButtons.forEach(btn => {
      const eventId = btn.id.replace('step-up-btn-', '');
      if (eventId) updateStepUpVisual(eventId);
    });
  }

  // Wait for the game to load user data before initting
  setTimeout(initAllStepUps, 2000);
})();


/* ──────────────────────────────────────────────────────────────────
   MISSIONS MODAL — NEAR FULLSCREEN PATCH
   Makes the mission list take up more usable height
────────────────────────────────────────────────────────────────── */

(function () {
  function patchMissionsModal() {
    const modal = document.getElementById('missions-modal');
    if (!modal) return;

    // Remove max-height cap from the list container
    const list = document.getElementById('mission-list-container');
    if (list) {
      list.style.maxHeight = 'none';
      list.style.flex = '1';
    }
  }

  // Run after DOM is ready
  document.addEventListener('DOMContentLoaded', patchMissionsModal);
  setTimeout(patchMissionsModal, 1000);
})();


/* ──────────────────────────────────────────────────────────────────
   EVENT SHOP — POINT PANEL AUTO-INIT IMPROVEMENT
   Ensures the event point panels appear immediately on tab switch,
   not just after a purchase
────────────────────────────────────────────────────────────────── */

(function () {
  const _origSwitchShopTab = typeof switchShopTab === 'function' ? switchShopTab : null;

  window.switchShopTab = function (tabId) {
    if (_origSwitchShopTab) _origSwitchShopTab(tabId);

    // When switching to event tab, re-inject all point badges and panels
    if (tabId === 'event') {
      setTimeout(() => {
        if (typeof injectEventPointBadges === 'function') injectEventPointBadges();
        // Re-init step-up visual for all events
        document.querySelectorAll('[id^="stepup-track-"]').forEach(track => {
          const eventId = track.id.replace('stepup-track-', '');
          if (typeof updateStepUpVisual === 'function') updateStepUpVisual(eventId);
        });
      }, 50);
    }
  };
})();


/* ──────────────────────────────────────────────────────────────────
   SHARED LE THEME — NOTES (No engine changes needed)

   If you have a monthly theme like "ROLLIE ROSY RUBY" shared across
   6 groups (aespa, TWICE, etc.), it works as-is because:

   - Event points are tracked by: user.eventPoints["aespa_ROLLIE ROSY RUBY"]
   - Card book tracks by: cbCalculatedData.groupedInventory["aespa"]["ROLLIE ROSY RUBY"]
   - Purchase limits use: user.purchaseLimits["profile_aespa_ROLLIE ROSY RUBY"]

   Each group+theme combo is unique, so 6 groups sharing "ROLLIE ROSY RUBY"
   creates 6 independent tracking buckets. Zero conflicts.

   Just make sure each event sub-tab passes the correct GROUP and THEME
   to buySpecialEventPack(). Use the Manager HTML to generate the HTML.
────────────────────────────────────────────────────────────────── */
/* ============================================================
 * v4 immersive shop/profile/cardbook patch
 * Final runtime layer for user-requested UI changes.
 * ============================================================ */
(function () {
  const ICON = {
    rp: '<i class="g g-rp"></i>',
    diamond: '<i class="g g-diamond"></i>',
    hp: '<i class="g g-hp"></i>',
    pack: '<i class="g g-pack"></i>',
    card: '<i class="g g-card"></i>',
    star: '<i class="g g-star"></i>',
    crown: '<i class="g g-crown"></i>',
    ticket: '<i class="g g-ticket"></i>',
    gear: '<i class="g g-gear"></i>'
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function fmtKey(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  function labelCase(value) {
    return String(value || "NONE").replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function groupDataFor(group) {
    const key = Object.keys(themeDatabase || {}).find((g) => fmtKey(g) === fmtKey(group));
    return key ? { key, data: themeDatabase[key] } : { key: group, data: themeDatabase?.[group] || {} };
  }

  function allThemes(data) {
    return [...(data?.themes || []), ...(data?.le_themes || [])];
  }

  function gradeColor(grade) {
    return { R: "#ff3d71", S: "#facc15", A: "#00bbf9", B: "#a855f7", C: "#94a3b8" }[String(grade || "C").toUpperCase()] || "#94a3b8";
  }

  function wallpaperUrl(item) {
    return item?.url || item?.image || item?.img || item?.src || item?.background || item?.thumbnail || "";
  }

  function wallpaperGroup(item) {
    return item?.group || item?.artist || item?.groupName || item?.name || "";
  }

  function isFreeWallpaper(item) {
    const currency = String(item?.currency || "").toLowerCase();
    return currency === "free" || Number(item?.cost || 0) === 0 || String(item?.type || "").toUpperCase() === "BASIC";
  }

  function deterministicIndex(seed, length) {
    if (!length) return 0;
    let hash = 0;
    for (const ch of String(seed || "")) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return Math.abs(hash) % length;
  }

  function findBestGroupWallpaper(group) {
    const db = Array.isArray(wallpaperDatabase) ? wallpaperDatabase : [];
    const groupKey = fmtKey(group);
    let items = db.filter((bg) => wallpaperUrl(bg) && isFreeWallpaper(bg) && fmtKey(wallpaperGroup(bg)) === groupKey);
    if (!items.length) items = db.filter((bg) => wallpaperUrl(bg) && isFreeWallpaper(bg) && fmtKey(wallpaperGroup(bg)).includes(groupKey));
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function cardImage(group, member, theme, grade) {
    return typeof getLargeCardUrl === "function" ? getLargeCardUrl("dynamic", grade, member, theme, group) : "";
  }

  function eventPreviewCards(group, theme, grades) {
    const { key, data } = groupDataFor(group);
    const members = data?.members?.length ? data.members : ["MEMBER"];
    return grades.map((grade, i) => {
      const member = members[i % members.length];
      return { grade, member, src: cardImage(key || group, member, theme, grade) };
    });
  }

  function currencyIcon(currency) {
    const c = String(currency || "").toLowerCase();
    if (c === "rp") return ICON.rp;
    if (c === "hp") return ICON.hp;
    if (c === "diamond" || c === "diamonds") return ICON.diamond;
    return ICON.ticket;
  }

  function spend(currency, amount) {
    const c = String(currency || "diamond").toLowerCase();
    const cost = Number(amount || 0);
    if (c === "rp") {
      if ((user.rp || 0) < cost) return showToast("Not enough RP.");
      user.rp -= cost;
    } else if (c === "hp") {
      if ((user.hp || 0) < cost) return showToast("Not enough HP.");
      user.hp -= cost;
    } else {
      if ((user.diamonds || 0) < cost) return showToast("Not enough Diamonds.");
      user.diamonds -= cost;
    }
    return true;
  }

  function inboxPush(mail) {
    if (!user.inbox) user.inbox = [];
    user.inbox.push({ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, ...mail });
    if (typeof checkInboxNoti === "function") checkInboxNoti();
  }

  function patchStaticCurrencyIcons() {
    const set = (selector, html) => {
      const el = document.querySelector(selector);
      if (el) el.innerHTML = html;
    };
    set('.hud-curr-pill[title="RP"] .curr-icon', ICON.rp);
    set('.hud-curr-pill[title="HP"] .curr-icon', ICON.hp);
    set('.hud-curr-pill[title="Diamonds"] .curr-icon', ICON.diamond);
    const resultRp = document.getElementById("result-rp");
    if (resultRp?.previousElementSibling) resultRp.previousElementSibling.innerHTML = ICON.rp;
    const shopHp = document.getElementById("shop-hp-val");
    if (shopHp?.previousElementSibling) shopHp.previousElementSibling.innerHTML = ICON.hp;
    const shopRp = document.getElementById("shop-rp-val");
    if (shopRp?.previousElementSibling) shopRp.previousElementSibling.innerHTML = ICON.rp;
    const shopDia = document.getElementById("shop-diamond-val");
    if (shopDia?.previousElementSibling) shopDia.previousElementSibling.innerHTML = ICON.diamond;
    document.querySelectorAll(".premium-unlock-btn").forEach((btn) => {
      if (/300/.test(btn.textContent || "")) btn.innerHTML = `UNLOCK PREMIUM (300 ${ICON.diamond})`;
    });
  }

  window.updateBulkDisplay = updateBulkDisplay = function () {
    const qty = parseInt(document.getElementById("bulk-qty-input")?.value, 10) || 1;
    const total = (bulkConfig?.baseCost || 0) * qty;
    const currency = bulkConfig?.currency || "rp";
    const color = currency === "rp" ? "var(--rp-color)" : currency === "hp" ? "var(--hp-color)" : "var(--diamond-color)";
    const target = document.getElementById("bulk-total-cost");
    if (target) target.innerHTML = `<span class="currency-glyph-cost" style="color:${color}">${currencyIcon(currency)} ${total.toLocaleString()}</span>`;
  };

  const baseGetProfilePicUrl = typeof getProfilePicUrl === "function" ? getProfilePicUrl : null;
  window.getProfilePicUrl = getProfilePicUrl = function (baseImgPath) {
    const filename = String(baseImgPath || "").split("@@").pop().replace(".png", "");
    if (!filename) return baseGetProfilePicUrl ? baseGetProfilePicUrl(baseImgPath) : "";
    // FIX: Use face-crop (c_thumb,g_face) for proper circular avatar cropping, not c_pad
    return `https://res.cloudinary.com/shining-superstar/c_thumb,g_face,w_250,h_250,r_50/${filename}.png`;
  };

  window.renderProfilePics = renderProfilePics = function () {
    const grid = document.getElementById("pfp-grid");
    if (!grid) return;
    const groupFilter = typeof currentPfpFilterGroup !== "undefined" ? currentPfpFilterGroup : "ALL";
    let items = Array.isArray(profilePicDatabase) ? profilePicDatabase : [];
    if (groupFilter !== "ALL") items = items.filter((p) => p.group === groupFilter);
    if (!items.length) {
      grid.innerHTML = `<p class="empty-state">No profile pictures found.</p>`;
      return;
    }
    if (!user.unlockedPFPs) user.unlockedPFPs = [];
    if (!user.profile) user.profile = {};
    const groups = [];
    items.forEach((p) => {
      let bucket = groups.find((g) => g.group === p.group && g.member === p.member);
      if (!bucket) {
        bucket = { group: p.group, member: p.member, avatars: [] };
        groups.push(bucket);
      }
      bucket.avatars.push(p);
    });
    grid.innerHTML = groups.map((bucket) => {
      const title = groupFilter === "ALL" ? `${bucket.group} - ${bucket.member}` : bucket.member;
      return `
        <div class="pfp-member-title">${esc(title)}</div>
        ${bucket.avatars.map((pfp) => {
          const pfpUrl = getProfilePicUrl(pfp.basePath);
          const owned = pfp.type === "FREE" || user.unlockedPFPs.includes(pfp.id);
          const equipped = user.profile.profilePic === pfpUrl;
          const action = owned
            ? `confirmProfilePic('${esc(pfpUrl)}', '${esc(pfp.member)}')`
            : pfp.type === "BASIC"
              ? `confirmBuyProfilePic('${esc(pfp.id)}', '${esc(pfp.member)}', '${esc(pfpUrl)}')`
              : `showToast('Event exclusive avatar.')`;
          return `
            <button class="pfp-avatar ${equipped ? "equipped" : ""} ${owned ? "" : "locked"}" onclick="${action}" title="${esc(pfp.member)}">
              <img src="${esc(pfpUrl)}" loading="lazy" onerror="this.closest('.pfp-avatar').classList.add('image-failed'); this.remove();">
              ${owned ? "" : `<span class="pfp-lock">${ICON.ticket}<small>${pfp.type === "BASIC" ? "20K RP" : "EVENT"}</small></span>`}
            </button>`;
        }).join("")}`;
    }).join("");
  };

  function renderCardBookDashboard() {
    const mainView = document.getElementById("cb-view-main");
    if (!mainView) return;
    if (typeof calculateCardBookData === "function") calculateCardBookData();
    if (!user.cbMilestones) user.cbMilestones = { cardsLevel: 1, themesLevel: 1 };
    const cardsTarget = user.cbMilestones.cardsLevel * 50;
    const themesTarget = user.cbMilestones.themesLevel * 500;
    const diamondReward = user.cbMilestones.cardsLevel * 10;
    const rpReward = user.cbMilestones.themesLevel * 5000;
    const best = cbCalculatedData?.bestGroup || { name: "NONE", points: 0, maxGrade: "C" };
    const { data: bestData } = groupDataFor(best.name);
    const stats = cbCalculatedData?.groupStats?.[best.name] || { owned: 0, total: 0, points: 0, maxGrade: "C" };
    const bestWallpaper = findBestGroupWallpaper(best.name);
    const bgUrl = wallpaperUrl(bestWallpaper);
    const cardsPct = Math.min(100, ((cbCalculatedData?.totalUniqueCards || 0) / cardsTarget) * 100);
    const themesPct = Math.min(100, ((cbCalculatedData?.totalThemePoints || 0) / themesTarget) * 100);
    const groupPct = stats.total ? Math.round((stats.owned / stats.total) * 100) : 0;
    const bestColor = gradeColor(best.maxGrade);
    const members = bestData?.members?.length || 0;
    const themeCount = allThemes(bestData).length || 0;

    mainView.innerHTML = `
      <section class="cb-hero-refresh cb-best-wallpaper-hero ${bgUrl ? "has-bg" : "no-bg"}">
        ${bgUrl ? `<img class="cb-best-wallpaper-img" src="${esc(bgUrl)}" alt="" onerror="this.closest('.cb-best-wallpaper-hero').classList.add('bg-failed'); this.remove();">` : ""}
        <div class="cb-wallpaper-scrim"></div>
        <div class="cb-hero-copy cb-hero-copy-v4">
          <span>Best Group Deck</span>
          <strong>${esc(labelCase(best.name))}</strong>
          <p>${stats.points.toLocaleString()} points, ${stats.owned.toLocaleString()} owned slots, ${groupPct}% group coverage. ${bgUrl ? "Free lobby wallpaper sourced from wallpaperData." : "No free lobby wallpaper found for this group yet."}</p>
          <div class="cb-best-detail-row"><span>${members.toLocaleString()} members</span><span>${themeCount.toLocaleString()} themes</span><span>${esc(bestWallpaper?.name || "Blank wallpaper")}</span></div>
        </div>
        <div class="cb-grade-medal cb-grade-medal-v4" style="--grade-color:${bestColor};">${esc(best.maxGrade || "C")}</div>
      </section>
      <section class="cb-metric-grid cb-metric-grid-v4">
        <div class="cb-metric"><span>Total Theme Points</span><strong>${(cbCalculatedData?.totalThemePoints || 0).toLocaleString()}</strong></div>
        <div class="cb-metric"><span>Unique Cards</span><strong>${(cbCalculatedData?.totalUniqueCards || 0).toLocaleString()}</strong></div>
        <div class="cb-metric"><span>Best Group Slots</span><strong>${stats.owned.toLocaleString()} / ${stats.total.toLocaleString()}</strong></div>
      </section>
      <section class="cb-reward-stack cb-reward-stack-v4">
        <div class="cb-reward-box cb-reward-refresh">
          <div class="cb-reward-header"><div><span class="cb-kicker aqua">Card Collector</span><h3>Unlock ${cardsTarget.toLocaleString()} unique cards</h3></div><strong>${(cbCalculatedData?.totalUniqueCards || 0).toLocaleString()} / ${cardsTarget.toLocaleString()}</strong></div>
          <div class="cb-progress"><span style="width:${cardsPct}%"></span></div>
          <div class="cb-reward-footer"><span>${ICON.diamond} ${diamondReward.toLocaleString()} Diamonds</span><button class="btn btn-draw cb-claim-btn" ${cbCalculatedData.totalUniqueCards >= cardsTarget ? `onclick="claimCBMilestone('cards', ${diamondReward})"` : "disabled"}>${cbCalculatedData.totalUniqueCards >= cardsTarget ? "Claim" : "Locked"}</button></div>
        </div>
        <div class="cb-reward-box cb-reward-refresh warm">
          <div class="cb-reward-header"><div><span class="cb-kicker rose">Theme Mastery</span><h3>Reach ${themesTarget.toLocaleString()} card book points</h3></div><strong>${(cbCalculatedData?.totalThemePoints || 0).toLocaleString()} / ${themesTarget.toLocaleString()}</strong></div>
          <div class="cb-progress"><span style="width:${themesPct}%"></span></div>
          <div class="cb-reward-footer"><span>${ICON.rp} ${rpReward.toLocaleString()} RP</span><button class="btn btn-live cb-claim-btn" ${cbCalculatedData.totalThemePoints >= themesTarget ? `onclick="claimCBMilestone('themes', ${rpReward})"` : "disabled"}>${cbCalculatedData.totalThemePoints >= themesTarget ? "Claim" : "Locked"}</button></div>
        </div>
      </section>`;
  }

  window.renderCardBookMain = renderCardBookMain = renderCardBookDashboard;
  window.renderCardBook = renderCardBook = function () {
    if (typeof calculateCardBookData === "function") calculateCardBookData();
    const specific = document.getElementById("cb-view-specific");
    const groups = document.getElementById("cb-view-groups");
    if (specific && specific.style.display !== "none") {
      const group = document.getElementById("cb-specific-group-name")?.innerText;
      if (group && typeof openCardBookSpecific === "function") return openCardBookSpecific(group);
    }
    if (groups && groups.style.display !== "none" && typeof renderCardBookGroups === "function") return renderCardBookGroups();
    return renderCardBookDashboard();
  };

  function packBadgeInfo(packType) {
    return {
      PROFILE: { label: "One-time", color: "#a855f7" },
      A_CARD: { label: `+${EVENT_POINT_REWARDS?.A_CARD || 15} pts`, color: "#22d3ee" },
      R_PACK: { label: `+${EVENT_POINT_REWARDS?.R_PACK || 70} pts`, color: "#f97316" },
      PREMIUM_10: { label: `+${EVENT_POINT_REWARDS?.PREMIUM_10 || 35} pts`, color: "#facc15" }
    }[packType];
  }

  function awardEventPointsToInbox(packType, group, theme) {
    const pts = Number(EVENT_POINT_REWARDS?.[packType] || 0);
    if (!pts || packType === "PROFILE") return;
    if (!user.eventPoints) user.eventPoints = {};
    const eventKey = `${group}_${theme}`;
    const total = Number(user.eventPoints[eventKey] || 0) + pts;
    const rewardCount = Math.floor(total / EVENT_POINT_GOAL);
    user.eventPoints[eventKey] = total % EVENT_POINT_GOAL;
    showToast(`+${pts} Event Points. ${user.eventPoints[eventKey]}/${EVENT_POINT_GOAL} to next point reward.`);
    for (let i = 0; i < rewardCount; i++) {
      inboxPush({ title: `${theme} Point Reward`, type: "pack", packType: "event_specific", grade: "R", group, theme, amount: 1 });
    }
    if (rewardCount > 0) {
      if (typeof playRewardBurstSound === "function") playRewardBurstSound();
      if (typeof launchUiBurst === "function") launchUiBurst();
      showToast(`${rewardCount} point reward${rewardCount > 1 ? "s" : ""} sent to Inbox.`);
    }
  }

  function primeRPackReveal(group, theme) {
    document.body.classList.add("r-pack-reveal-mode");
    const overlay = document.getElementById("gacha-fullscreen-overlay");
    if (!overlay) return;
    overlay.querySelector(".r-pack-wow-banner")?.remove();
    const banner = document.createElement("div");
    banner.className = "r-pack-wow-banner";
    banner.innerHTML = `<span>R Package Boost</span><strong>${esc(labelCase(group))} / ${esc(labelCase(theme))}</strong>`;
    overlay.prepend(banner);
  }

  const baseCloseGachaStage = typeof closeGachaStage === "function" ? closeGachaStage : null;
  if (baseCloseGachaStage) {
    window.closeGachaStage = closeGachaStage = function () {
      document.body.classList.remove("r-pack-reveal-mode");
      document.querySelector(".r-pack-wow-banner")?.remove();
      return baseCloseGachaStage.apply(this, arguments);
    };
  }

  window.buySpecialEventPack = buySpecialEventPack = function (packType, group, theme, poolName, cost) {
    if (!user.purchaseLimits) user.purchaseLimits = {};
    const closeShop = () => {
      previousModalId = "shop-modal";
      const shop = document.getElementById("shop-modal");
      if (shop) shop.style.display = "none";
    };
    if (packType === "PROFILE") {
      const key = `profile_${group}_${theme}`;
      if (user.purchaseLimits[key]) return showToast("Already purchased this profile package.");
      if (!spend("diamond", 800)) return;
      user.purchaseLimits[key] = true;
      if (!user.unlockedPFPs) user.unlockedPFPs = [];
      const groupKey = fmtKey(group);
      const themeKey = fmtKey(theme);
      (profilePicDatabase || []).forEach((pfp) => {
        if (fmtKey(pfp.group) === groupKey && fmtKey(pfp.basePath).includes(themeKey) && !user.unlockedPFPs.includes(pfp.id)) user.unlockedPFPs.push(pfp.id);
      });
      user.diamonds = (user.diamonds || 0) + 300;
      inboxPush({ title: `${theme} Profile Bundle R Card`, type: "pack", packType: "event_specific", grade: "R", group, theme, amount: 1 });
      showToast("Profile set unlocked. R card reward sent to Inbox.");
      updateUI();
      if (typeof renderProfilePics === "function") renderProfilePics();
      return;
    }
    if (packType === "A_CARD") {
      const key = `acard_${group}_${theme}`;
      user.purchaseLimits[key] = Number(user.purchaseLimits[key] || 0);
      if (user.purchaseLimits[key] >= 3) return showToast("Purchase limit reached. 3/3");
      if (!spend("diamond", 150)) return;
      user.purchaseLimits[key] += 1;
      closeShop();
      generateCards(1, "event_specific", "A", group, theme);
    } else if (packType === "R_PACK") {
      if (!spend("diamond", 500)) return;
      primeRPackReveal(group, theme);
      closeShop();
      generateCards(3, "event_specific", ["R", "A", "A"], group, theme);
    } else if (packType === "PREMIUM_10") {
      if (!spend("diamond", 200)) return;
      closeShop();
      generateCards(10, "event_premium", null, group, theme);
    } else if (packType === "CUSTOM") {
      const numericCost = parseInt(cost, 10) || 0;
      if (!spend("diamond", numericCost)) return;
      closeShop();
      generateCards(1, poolName, null, group, theme);
    }
    if (typeof trackMissionProgress === "function") trackMissionProgress("pull", packType === "PREMIUM_10" ? 10 : packType === "R_PACK" ? 3 : 1);
    awardEventPointsToInbox(packType, group, theme);
    updateUI();
    setTimeout(() => { injectEventPointBadges(); buildEventPackShowcases(); }, 80);
  };

  window.injectEventPointBadges = injectEventPointBadges = function () {
    document.querySelectorAll('[onclick*="buySpecialEventPack"]').forEach((el) => {
      const match = el.getAttribute("onclick")?.match(/buySpecialEventPack\(['"](\w+)['"]/);
      if (!match) return;
      const info = packBadgeInfo(match[1]);
      if (!info) return;
      el.classList.add("event-buy-with-badge");
      let badge = el.querySelector(".ep-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "ep-badge ep-badge-v4";
        el.prepend(badge);
      }
      badge.style.background = info.color;
      badge.innerHTML = `${ICON.star} ${info.label}`;
    });
    document.querySelectorAll("[data-event-group][data-event-theme]").forEach((container) => {
      const group = container.dataset.eventGroup;
      const theme = container.dataset.eventTheme;
      const key = `${group}_${theme}`;
      const points = Number(user.eventPoints?.[key] || 0);
      const pct = Math.min(100, (points / EVENT_POINT_GOAL) * 100);
      let panel = container.querySelector(".event-point-panel");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "event-point-panel event-point-panel-v4";
        container.prepend(panel);
      }
      panel.innerHTML = `<div class="event-point-left">${ICON.card}<div><span>Point Reward Inbox</span><strong>R event card at ${EVENT_POINT_GOAL} pts</strong></div></div><div class="event-point-meter"><div class="event-point-copy"><small>${points} / ${EVENT_POINT_GOAL}</small><small>Rewards are mailed</small></div><div class="event-point-track"><span style="width:${pct}%"></span></div></div>`;
    });
  };

  function buildEventPackShowcases() {
    document.querySelectorAll(".event-sub-content[data-event-group][data-event-theme]").forEach((container) => {
      const group = container.dataset.eventGroup;
      const theme = container.dataset.eventTheme;
      const cardsA = eventPreviewCards(group, theme, ["A", "A", "A", "A"]);
      const cardsR = eventPreviewCards(group, theme, ["R", "A", "A"]);
      const aCard = container.querySelector('[onclick*="buySpecialEventPack"][onclick*="A_CARD"]')?.closest(".event-pack-card");
      const rCard = container.querySelector('[onclick*="buySpecialEventPack"][onclick*="R_PACK"]')?.closest(".event-pack-card");
      const setMedia = (card, html) => {
        const media = card?.querySelector(".event-pack-media");
        if (media && !media.classList.contains("limited-preview-ready")) {
          media.classList.add("limited-preview-ready");
          media.innerHTML = html;
        }
      };
      setMedia(aCard, `<div class="limited-a-showcase">${cardsA.map((c, i) => `<img class="limited-preview-card lp-${i}" src="${esc(c.src)}" alt="${esc(c.member)}" onerror="this.remove();">`).join("")}<span>A selector preview</span></div>`);
      setMedia(rCard, `<div class="limited-r-showcase">${cardsR.map((c, i) => `<img class="limited-preview-card rp-${i}" src="${esc(c.src)}" alt="${esc(c.grade)} ${esc(c.member)}" onerror="this.remove();">`).join("")}<div class="r-pack-orbit"><b>R</b><small>+2 A</small></div></div>`);
    });
  }

  function ensureShopRestructure() {
    const tabs = document.querySelector(".shop-tabs-container");
    const content = document.querySelector(".shop-content-area");
    if (!tabs || !content) return;
    const black = document.getElementById("tab-btn-blackmarket");
    if (black) {
      black.dataset.shopTab = "xtreme";
      black.setAttribute("onclick", "switchShopTab('xtreme')");
      black.innerHTML = `${ICON.star} XTREME DEALS`;
      black.style.color = "var(--secondary-glow)";
    }
    ["home", "event", "premium", "wallpaper"].forEach((tab) => {
      const btn = document.getElementById(`tab-btn-${tab}`);
      if (btn) btn.dataset.shopTab = tab;
    });
    if (!document.getElementById("tab-btn-others")) {
      const btn = document.createElement("button");
      btn.className = "shop-tab";
      btn.id = "tab-btn-others";
      btn.dataset.shopTab = "others";
      btn.setAttribute("onclick", "switchShopTab('others')");
      btn.innerHTML = `${ICON.gear} OTHERS`;
      tabs.appendChild(btn);
    }
    let others = document.getElementById("shop-tab-others");
    if (!others) {
      others = document.createElement("div");
      others.id = "shop-tab-others";
      others.style.display = "none";
      others.className = "others-shop-tab";
      content.appendChild(others);
    }
    if (!others.dataset.ready) {
      others.dataset.ready = "true";
      others.innerHTML = `<section class="others-shop-hero"><div><span>Utility Shop</span><strong>Slots, Materials, Selectors</strong><p>Progress tools are grouped here so premium packs have more space.</p></div><button class="btn btn-live" onclick="buyInventorySlots()">${ICON.diamond} 50 / +50 Slots</button></section><h3 class="shop-section-title">Power Up Materials</h3><div class="market-item-grid others-material-grid" id="others-material-grid"></div><h3 class="shop-section-title">Specific Grade Selectors</h3><div class="others-selector-grid"><div class="shop-pack-item selector-card selector-a"><strong>A</strong><p>A Grade Selector</p><button class="btn btn-draw" onclick="buyGradeSelector('A', 120, 'diamond')">${ICON.diamond} 120</button></div><div class="shop-pack-item selector-card selector-s"><strong>S</strong><p>S Grade Selector</p><button class="btn btn-draw" onclick="buyGradeSelector('S', 300, 'diamond')">${ICON.diamond} 300</button></div><div class="shop-pack-item selector-card selector-r"><strong>R</strong><p>R Grade Selector</p><button class="btn btn-live" onclick="buyGradeSelector('R', 650, 'diamond')">${ICON.diamond} 650</button></div></div>`;
    }
    const materialGrid = document.getElementById("others-material-grid");
    const premium = document.getElementById("shop-tab-premium");
    if (materialGrid && premium && !materialGrid.dataset.moved) {
      const items = [...premium.querySelectorAll(".shop-pack-item")].filter((node) => /\bMAT\b|MATERIAL/i.test(node.textContent || ""));
      items.forEach((node) => materialGrid.appendChild(node));
      materialGrid.dataset.moved = "true";
      const heading = [...premium.querySelectorAll("h3")].find((h) => /MATERIAL/i.test(h.textContent || ""));
      if (heading) heading.textContent = "PREMIUM PACKS";
    }
    const xtreme = document.getElementById("shop-tab-blackmarket");
    if (xtreme && !xtreme.dataset.v4) {
      xtreme.dataset.v4 = "true";
      xtreme.innerHTML = `<section class="xtreme-opening-hero"><span>Grand Opening</span><h3>XTREME LAUNCH SALES</h3><p>Limited launch bundles for cards, currencies, premium packs, and grade selectors.</p></section><div class="xtreme-sale-grid"><div class="xtreme-sale-card"><small>CURRENCY</small><strong>RP Surge Bundle</strong><p>120,000 RP + 10 HP</p><button class="btn btn-draw" onclick="buyXtremeDeal('currency_rp')">${ICON.diamond} 100</button></div><div class="xtreme-sale-card"><small>CARDS</small><strong>Opening Card Pack 30</strong><p>30 regular cards delivered to inbox.</p><button class="btn btn-draw" onclick="buyXtremeDeal('cards_30')">${ICON.rp} 250,000</button></div><div class="xtreme-sale-card premium"><small>PREMIUM</small><strong>Premium Pack 30 Sale</strong><p>30 premium cards at a launch price.</p><button class="btn btn-live" onclick="buyXtremeDeal('premium_30')">${ICON.diamond} 160</button></div><div class="xtreme-sale-card selector"><small>SELECTOR</small><strong>R Grade Selector</strong><p>Guaranteed R card selector mail.</p><button class="btn btn-live" onclick="buyXtremeDeal('selector_r')">${ICON.diamond} 600</button></div><div class="xtreme-sale-card"><small>UTILITY</small><strong>Inventory Slot Burst</strong><p>+50 inventory slots.</p><button class="btn btn-draw" onclick="buyInventorySlots()">${ICON.diamond} 50</button></div><div class="xtreme-sale-card selector"><small>SELECTOR</small><strong>S Grade Selector Duo</strong><p>Two guaranteed S cards.</p><button class="btn btn-draw" onclick="buyXtremeDeal('selector_s2')">${ICON.diamond} 420</button></div></div>`;
    }
  }

  window.buyGradeSelector = function (grade, cost, currency) {
    if (!spend(currency || "diamond", cost)) return;
    inboxPush({ title: `${grade} Grade Selector`, type: "pack", packType: "regular", grade, amount: 1 });
    showToast(`${grade} Grade Selector sent to Inbox.`);
    updateUI();
  };

  window.buyXtremeDeal = function (kind) {
    const deals = {
      currency_rp: { cost: 100, currency: "diamond", grant: () => { user.rp = (user.rp || 0) + 120000; user.hp = (user.hp || 0) + 10; } },
      cards_30: { cost: 250000, currency: "rp", mail: { title: "Grand Opening Card Pack 30", type: "pack", packType: "regular", amount: 30 } },
      premium_30: { cost: 160, currency: "diamond", mail: { title: "Grand Opening Premium Pack 30", type: "pack", packType: "premium", amount: 30 } },
      selector_r: { cost: 600, currency: "diamond", mail: { title: "Grand Opening R Selector", type: "pack", packType: "regular", grade: "R", amount: 1 } },
      selector_s2: { cost: 420, currency: "diamond", mail: { title: "Grand Opening S Selector Duo", type: "pack", packType: "regular", grade: "S", amount: 2 } }
    };
    const deal = deals[kind];
    if (!deal || !spend(deal.currency, deal.cost)) return;
    if (deal.mail) inboxPush(deal.mail);
    if (deal.grant) deal.grant();
    showToast("Grand Opening deal claimed.");
    updateUI();
  };

  window.switchShopTab = switchShopTab = function (tabName) {
    ensureShopRestructure();
    const tab = tabName === "blackmarket" ? "xtreme" : tabName;
    document.querySelectorAll(".shop-tab").forEach((btn) => btn.classList.remove("active"));
    document.querySelector(`[data-shop-tab="${tab}"]`)?.classList.add("active");
    document.querySelectorAll('.shop-content-area > div[id^="shop-tab-"]').forEach((panel) => { panel.style.display = "none"; });
    const id = tab === "xtreme" ? "shop-tab-blackmarket" : `shop-tab-${tab}`;
    const selected = document.getElementById(id);
    if (selected) selected.style.display = "block";
    if (tab === "wallpaper") {
      try {
        populateBgGroups();
        filterBgShop("BASIC", document.querySelector("#shop-tab-wallpaper .bg-sub-tab"));
      } catch (error) {
        console.error("Wallpaper load error:", error);
      }
    }
    if (tab === "event") setTimeout(() => { injectEventPointBadges(); buildEventPackShowcases(); }, 60);
  };

  window.openShopModal = openShopModal = function () {
    ensureShopRestructure();
    document.getElementById("shop-modal").style.display = "flex";
    switchShopTab("home");
    if (typeof startShopCarousel === "function") startShopCarousel();
    setTimeout(() => { injectEventPointBadges(); buildEventPackShowcases(); }, 120);
  };

  const baseSwitchEventSubTab = typeof switchEventSubTab === "function" ? switchEventSubTab : null;
  window.switchEventSubTab = switchEventSubTab = function (id, btn) {
    if (baseSwitchEventSubTab) baseSwitchEventSubTab(id, btn);
    setTimeout(() => { injectEventPointBadges(); buildEventPackShowcases(); }, 50);
  };

  function ownedWallpapers() {
    if (!user.wallpapers) user.wallpapers = ["bg_default", "bg_basic_01"];
    return (wallpaperDatabase || []).filter((bg) => user.wallpapers.includes(bg.id) || isFreeWallpaper(bg));
  }

  function favoriteWallpaper() {
    const id = user.profile?.favWallpaper || user.profile?.favoriteWallpaper || user.equippedWallpapers?.[0];
    return (wallpaperDatabase || []).find((bg) => bg.id === id) || ownedWallpapers()[0] || null;
  }

  function themeSetOptions() {
    const map = new Map();
    (user.inventory || []).forEach((card) => {
      if (card?.group && card?.theme) map.set(`${card.group}||${card.theme}`, { group: card.group, theme: card.theme });
    });
    if (user.favoriteCard?.group && user.favoriteCard?.theme) map.set(`${user.favoriteCard.group}||${user.favoriteCard.theme}`, { group: user.favoriteCard.group, theme: user.favoriteCard.theme });
    return [...map.values()].sort((a, b) => `${a.group} ${a.theme}`.localeCompare(`${b.group} ${b.theme}`));
  }

  function buildMyInfoModal() {
    const modal = document.getElementById("profile-modal-bg");
    if (!modal) return;
    modal.classList.add("my-info-v4");
    modal.innerHTML = `<button class="close-btn my-info-close" onclick="withLoadingCircle(() => { document.getElementById('profile-modal').style.display = 'none' })">&times;</button><img class="my-info-wallpaper-img" id="my-info-wallpaper-img" alt="" onerror="this.classList.add('is-blank'); this.removeAttribute('src');"><div class="my-info-shade"></div><section class="my-info-shell"><div class="my-info-top"><button class="mi-avatar-btn" onclick="withLoadingCircle(() => { openProfilePicModal() })"><img id="profile-modal-pic" alt="Profile"></button><div class="mi-name-block"><span>MY INFO</span><strong id="profile-uid">UID</strong><small id="profile-join-date">Joined: Unknown</small></div><div class="mi-stat-strip"><div><span>Cards</span><strong id="profile-total-cards">0</strong></div><div><span>VIP</span><strong id="profile-vip-status">No</strong></div><div><span>Level</span><strong id="profile-level-val">1</strong></div></div></div><div class="my-info-grid"><div class="mi-fav-card-panel"><span>Favorite Card</span><img id="profile-fav-card" alt="Favorite card"><button class="btn btn-draw" onclick="withLoadingCircle(() => { toggleVault() })">CHANGE CARD</button></div><div class="mi-bio-panel"><label>Bio</label><textarea id="profile-bio-input" maxlength="160" placeholder="Add a short profile bio."></textarea><button class="btn btn-live" onclick="saveProfileBio()">${ICON.star} SAVE BIO</button></div><div class="mi-prefs-panel"><label>Favorite Wallpaper</label><select id="profile-wallpaper-select" class="sorting-select" onchange="saveFavoriteWallpaper(this.value)"></select><label>Favorite Theme Set</label><select id="profile-theme-select" class="sorting-select" onchange="saveFavoriteThemeSet(this.value)"></select></div></div><div class="mi-theme-set-chip" id="profile-theme-chip">${ICON.card}<span>No favorite theme set</span></div></section>`;
  }

  window.renderMyInfoDashboard = function () {
    const modal = document.getElementById("profile-modal-bg");
    if (!modal?.classList.contains("my-info-v4")) return;
    if (!user.profile) user.profile = {};
    const bg = favoriteWallpaper();
    const bgImg = document.getElementById("my-info-wallpaper-img");
    if (bgImg) {
      const src = wallpaperUrl(bg);
      if (src) bgImg.src = src;
      else bgImg.removeAttribute("src");
    }
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("profile-uid", uid || "GUEST");
    setText("profile-join-date", `Joined: ${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : "Unknown"}`);
    setText("profile-total-cards", (user.inventory || []).length.toLocaleString());
    setText("profile-vip-status", user.isVIP ? "Yes" : "No");
    setText("profile-level-val", user.level || 1);
    const bio = document.getElementById("profile-bio-input");
    if (bio && document.activeElement !== bio) bio.value = user.profile.bio || "";
    const wSelect = document.getElementById("profile-wallpaper-select");
    if (wSelect) {
      const bgs = ownedWallpapers();
      wSelect.innerHTML = bgs.map((item) => `<option value="${esc(item.id)}">${esc(item.name || item.id)}</option>`).join("") || `<option value="">No wallpapers owned</option>`;
      wSelect.value = user.profile.favWallpaper || bg?.id || "";
    }
    const tSelect = document.getElementById("profile-theme-select");
    const selectedTheme = user.profile.favThemeSet || "";
    if (tSelect) {
      const options = themeSetOptions();
      tSelect.innerHTML = `<option value="">Choose a theme set</option>` + options.map((item) => {
        const value = `${item.group}||${item.theme}`;
        return `<option value="${esc(value)}">${esc(item.group)} - ${esc(item.theme)}</option>`;
      }).join("");
      tSelect.value = selectedTheme;
    }
    const chip = document.getElementById("profile-theme-chip");
    if (chip) {
      const [group, theme] = selectedTheme.split("||");
      chip.innerHTML = selectedTheme ? `${ICON.card}<span>${esc(group)} / ${esc(theme)}</span>` : `${ICON.card}<span>No favorite theme set</span>`;
    }
  };

  window.saveProfileBio = function () {
    if (!user.profile) user.profile = {};
    user.profile.bio = document.getElementById("profile-bio-input")?.value?.trim() || "";
    showToast("Bio saved.");
    updateUI();
  };
  window.saveFavoriteWallpaper = function (id) {
    if (!user.profile) user.profile = {};
    user.profile.favWallpaper = id;
    showToast("Favorite wallpaper saved.");
    updateUI();
  };
  window.saveFavoriteThemeSet = function (value) {
    if (!user.profile) user.profile = {};
    user.profile.favThemeSet = value;
    showToast("Favorite theme set saved.");
    updateUI();
  };
  window.openProfileModal = openProfileModal = function () {
    buildMyInfoModal();
    document.getElementById("profile-modal").style.display = "flex";
    updateUI();
    renderMyInfoDashboard();
  };

  function rewardIconForMail(mail) {
    if (mail.type === "rp") return ICON.rp;
    if (mail.type === "hp") return ICON.hp;
    if (mail.type === "diamond" || mail.type === "diamonds") return ICON.diamond;
    if (mail.type === "pack" || mail.type === "random_card") return mail.grade ? ICON.card : ICON.pack;
    if (mail.type === "vip") return ICON.crown;
    if (mail.type === "mileage") return ICON.ticket;
    return ICON.star;
  }
  function mailLabel(mail) {
    const amt = Number(mail.amount || 1).toLocaleString();
    if (mail.type === "overflow_cards") return `${amt} Overflow Cards`;
    if (mail.type === "rp") return `${amt} RP`;
    if (mail.type === "hp") return `${amt} HP`;
    if (mail.type === "diamond" || mail.type === "diamonds") return `${amt} Diamonds`;
    if (mail.type === "mileage") return `${amt} Ticket`;
    if (mail.type === "vip") return "VIP Pass";
    if (mail.type === "pack") return `${mail.grade ? `${mail.grade}-Grade ` : ""}${mail.packType ? mail.packType.replace(/_/g, " ").toUpperCase() : "CARD"} x${amt}`;
    return "Gift Package";
  }
  window.getRewardDisplayStr = getRewardDisplayStr = mailLabel;
  window.renderInbox = renderInbox = function () {
    const content = document.getElementById("inbox-content");
    if (!content) return;
    if (!user.inbox || user.inbox.length === 0) {
      content.innerHTML = `<p class="empty-state">Inbox is empty.</p>`;
      return;
    }
    // FIX: Use repairMojibakeText on title/label BEFORE esc so emoji bytes decode correctly
    const safeTitle = (t) => esc(typeof repairMojibakeText === 'function' ? repairMojibakeText(t) : t);
    content.innerHTML = user.inbox.map((mail) => {
      const id = String(mail.id || '').replace(/'/g, '');
      const icon = rewardIconForMail(mail);
      const title = safeTitle(mail.title || 'Reward');
      const label = esc(mailLabel(mail));
      return `<div class="inbox-item inbox-item-v4"><div class="inbox-reward-left">${icon}</div><div class="inbox-copy"><strong>${title}</strong><span>${label}</span></div><button class="btn btn-live inbox-claim-btn" onclick="claimDynamicMail('${id}')">CLAIM</button></div>`;
    }).join("");
  };

  function passIcon(type) {
    if (type === "RP") return ICON.rp;
    if (type === "Diamonds") return ICON.diamond;
    if (type === "LE_Pack") return ICON.pack;
    return ICON.star;
  }
  window.updatePassUI = updatePassUI = function () {
    if (!user.starPass) user.starPass = { level: 1, exp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
    const currentLvl = user.starPass.level || 1;
    const reqExp = currentLvl * 100;
    const passLvl = document.getElementById("pass-current-lvl");
    const passText = document.getElementById("pass-exp-text");
    const passFill = document.getElementById("pass-exp-fill");
    if (passLvl) passLvl.textContent = currentLvl;
    if (passText) passText.textContent = `${user.starPass.exp || 0} / ${reqExp} EXP`;
    if (passFill) passFill.style.width = `${Math.min(((user.starPass.exp || 0) / reqExp) * 100, 100)}%`;
    const btn = document.getElementById("buy-premium-btn");
    if (btn) {
      btn.innerHTML = user.starPass.isPremium ? `${ICON.crown} PREMIUM ACTIVE` : `UNLOCK PREMIUM (300 ${ICON.diamond})`;
      btn.disabled = !!user.starPass.isPremium;
      btn.classList.toggle("owned", !!user.starPass.isPremium);
    }
    const container = document.getElementById("pass-tiers-container");
    if (!container) return;
    container.innerHTML = passRewards.map((tier) => {
      const unlocked = currentLvl >= tier.level;
      const freeClaimed = user.starPass.claimedFree?.includes(tier.level);
      const premClaimed = user.starPass.claimedPremium?.includes(tier.level);
      const freeClass = freeClaimed ? "claimed" : unlocked ? "claimable" : "locked";
      const premClass = premClaimed ? "claimed" : unlocked && user.starPass.isPremium ? "claimable premium" : "locked premium";
      const freeClick = !freeClaimed && unlocked ? `onclick="claimPassReward(${tier.level}, 'free')"` : "";
      const premClick = !premClaimed && unlocked && user.starPass.isPremium ? `onclick="claimPassReward(${tier.level}, 'premium')"` : "";
      return `<div class="star-pass-track star-pass-track-v4 ${unlocked ? "unlocked" : ""}"><button class="pass-tier-box ${freeClass}" ${freeClick}>${passIcon(tier.free.type)}<strong>${tier.free.amount}</strong><span>${tier.free.type}</span></button><div class="pass-level-node"><span>${tier.level}</span></div><button class="pass-tier-box ${premClass}" ${premClick}>${passIcon(tier.premium.type)}<strong>${tier.premium.amount}</strong><span>${tier.premium.type.replace("_", " ")}</span></button></div>`;
    }).join("");
  };
  window.openStarPass = openStarPass = function () {
    document.getElementById("star-pass-modal").classList.add("star-pass-fullscreen");
    updatePassUI();
    document.getElementById("star-pass-modal").style.display = "flex";
  };

  function levelRequirement(level) {
    return Math.max(250, Math.round((Number(level) || 1) * 650));
  }
  function showLevelNotice(level, count) {
    document.querySelector(".level-up-notice")?.remove();
    const notice = document.createElement("div");
    notice.className = "level-up-notice";
    notice.innerHTML = `<span>Level Up</span><strong>Lv ${level}</strong><small>${count > 1 ? `+${count} levels gained` : "New rewards unlocked faster"}</small>`;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 3600);
  }
  function processAccountLevelProgress() {
    if (!user) return;
    user.level = Number(user.level || 1);
    user.exp = Number(user.exp || 0);
    let gained = 0;
    while (user.exp >= levelRequirement(user.level)) {
      user.exp -= levelRequirement(user.level);
      user.level += 1;
      gained += 1;
      if (user.level % 5 === 0) inboxPush({ title: `Level ${user.level} Growth Pack`, type: "pack", packType: "premium", amount: 1 });
    }
    if (gained) {
      showLevelNotice(user.level, gained);
      showToast(`Level up. You are now Lv ${user.level}.`);
    }
  }
  function updateAccountLevelVisuals() {
    const fill = document.getElementById("exp-fill");
    if (fill) fill.style.width = `${Math.min(((user.exp || 0) / levelRequirement(user.level || 1)) * 100, 100)}%`;
    const display = document.getElementById("display-uid");
    if (display && uid) display.textContent = uid;
  }
  const baseShowStreamResults = typeof showStreamResults === "function" ? showStreamResults : null;
  if (baseShowStreamResults) {
    window.showStreamResults = showStreamResults = function (multiplier, songData, finalScore) {
      const result = baseShowStreamResults.apply(this, arguments);
      const catchupBonus = Math.max(35, 120 - ((user.level || 1) * 3));
      user.exp = (user.exp || 0) + catchupBonus;
      const expEl = document.getElementById("result-exp");
      if (expEl) expEl.textContent = (parseInt(expEl.textContent, 10) || 0) + catchupBonus;
      showToast(`Growth bonus +${catchupBonus} EXP.`);
      processAccountLevelProgress();
      updateUI();
      return result;
    };
  }
  const baseUpdateUI = typeof updateUI === "function" ? updateUI : null;
  window.updateUI = updateUI = function () {
    processAccountLevelProgress();
    const result = baseUpdateUI ? baseUpdateUI.apply(this, arguments) : undefined;
    patchStaticCurrencyIcons();
    updateAccountLevelVisuals();
    if (document.getElementById("profile-modal")?.style.display === "flex") renderMyInfoDashboard();
    return result;
  };
  document.addEventListener("DOMContentLoaded", () => {
    ensureShopRestructure();
    patchStaticCurrencyIcons();
    buildEventPackShowcases();
    injectEventPointBadges();
  });
  setTimeout(() => {
    ensureShopRestructure();
    patchStaticCurrencyIcons();
    buildEventPackShowcases();
    injectEventPointBadges();
  }, 1200);
})();

/* ============================================================
 * v6 final layer: grand opening shop + cardbook + profile
 * ============================================================ */
(function () {
  const ICON = {
    rp: '<i class="g g-rp"></i>',
    diamond: '<i class="g g-diamond"></i>',
    hp: '<i class="g g-hp"></i>',
    pack: '<i class="g g-pack"></i>',
    card: '<i class="g g-card"></i>',
    crown: '<i class="g g-crown"></i>',
    star: '<i class="g g-star"></i>',
    gear: '<i class="g g-gear"></i>',
    ticket: '<i class="g g-ticket"></i>'
  };
  const GRADE_WEIGHT = { R: 5, S: 4, A: 3, B: 2, C: 1 };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }
  function jsArg(value) {
    return esc(JSON.stringify(String(value ?? "")));
  }
  function key(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }
  function display(value) {
    return String(value || "NONE").replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  }
  function groupInfo(group) {
    const db = themeDatabase || {};
    const found = Object.keys(db).find((name) => key(name) === key(group));
    return { key: found || group, data: found ? db[found] : (db[group] || {}) };
  }
  function gradeColor(grade) {
    return { R: "#ff2f74", S: "#facc15", A: "#22d3ee", B: "#a855f7", C: "#94a3b8" }[String(grade || "C").toUpperCase()] || "#94a3b8";
  }
  function cardImage(card) {
    if (card?.src) return card.src;
    return typeof getLargeCardUrl === "function" ? getLargeCardUrl(card?.url || "dynamic", card?.grade || "C", card?.member, card?.theme, card?.group) : (card?.url || "");
  }
  function officialCards(group, theme, grades) {
    const info = groupInfo(group);
    const members = info.data?.members?.length ? info.data.members : ["MEMBER"];
    return members.map((member, index) => ({
      group: info.key || group,
      member,
      theme,
      grade: grades[index % grades.length],
      src: typeof getLargeCardUrl === "function" ? getLargeCardUrl("dynamic", grades[index % grades.length], member, theme, info.key || group) : ""
    }));
  }
  function ownedThemeCards(group, theme, includeGhosts) {
    const info = groupInfo(group);
    const members = info.data?.members || [];
    const cards = [];
    members.forEach((member) => {
      const owned = (user.inventory || []).filter((card) =>
        card &&
        card.type !== "material" &&
        key(card.group) === key(info.key || group) &&
        key(card.member) === key(member) &&
        key(card.theme) === key(theme)
      );
      if (owned.length) {
        owned.sort((a, b) => ((GRADE_WEIGHT[b.grade] || 0) * 100 + (b.level || 1)) - ((GRADE_WEIGHT[a.grade] || 0) * 100 + (a.level || 1)));
        cards.push({ ...owned[0], owned: true });
      } else if (includeGhosts) {
        cards.push({
          group: info.key || group,
          member,
          theme,
          grade: "C",
          ghost: true,
          src: typeof getGhostCardUrl === "function" ? getGhostCardUrl(info.key || group, member, theme) : ""
        });
      }
    });
    return cards;
  }
  function cardTile(card, cls) {
    const grade = String(card.grade || "C").toUpperCase();
    const src = cardImage(card);
    return `<div class="event-card-tile ${cls || ""} ${card.ghost ? "ghost" : ""}" style="--grade-color:${gradeColor(grade)}">
      <img src="${esc(src)}" alt="${esc(card.member || grade)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
      <div class="event-card-fallback" style="display:none;">${esc(grade)}<small>${esc(card.member || "")}</small></div>
      <span>${esc(card.member || "")}</span>
    </div>`;
  }
  function wallpaperUrl(item) {
    return item?.url || item?.image || item?.img || item?.src || item?.background || item?.thumbnail || "";
  }
  function ownedWallpapers() {
    if (!user.wallpapers) user.wallpapers = ["bg_default", "bg_basic_01"];
    return (wallpaperDatabase || []).filter((bg) => user.wallpapers.includes(bg.id) || String(bg.currency).toLowerCase() === "free" || Number(bg.cost || 0) === 0);
  }
  function favoriteWallpaper() {
    const id = user.profile?.favWallpaper || user.profile?.favoriteWallpaper || user.equippedWallpapers?.[0];
    return (wallpaperDatabase || []).find((bg) => bg.id === id) || ownedWallpapers()[0] || null;
  }

  function grandOpeningDealsHtml() {
    return `<section class="grand-opening-hero-v5">
      <div><span>Grand Opening Event</span><h3>Launch Week Sale</h3><p>Cards, currencies, premium packs, selectors, profile tools, and growth boosts in one event shop.</p></div>
      <button class="btn btn-live" onclick="switchShopTab('event')">${ICON.card} View Featured Cards</button>
    </section>
    <div class="grand-deal-grid-v5">
      <div class="grand-deal-card hot"><small>Premium</small><strong>Premium Pack 30</strong><p>30 premium cards at launch pricing.</p><button class="btn btn-live" onclick="buyGrandOpeningDeal('premium_30')">${ICON.diamond} 160</button></div>
      <div class="grand-deal-card"><small>Cards</small><strong>Card Pack 50</strong><p>A large regular card stock-up bundle.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('cards_50')">${ICON.rp} 390,000</button></div>
      <div class="grand-deal-card selector"><small>Selector</small><strong>R Grade Selector</strong><p>Guaranteed R-grade selector mail.</p><button class="btn btn-live" onclick="buyGrandOpeningDeal('selector_r')">${ICON.diamond} 600</button></div>
      <div class="grand-deal-card selector"><small>Selector</small><strong>S Selector Duo</strong><p>Two S-grade selectors for deck building.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('selector_s2')">${ICON.diamond} 420</button></div>
      <div class="grand-deal-card"><small>Selector</small><strong>A Selector Trio</strong><p>Three A-grade selectors to complete themes.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('selector_a3')">${ICON.diamond} 240</button></div>
      <div class="grand-deal-card currency"><small>Currency</small><strong>RP Surge</strong><p>120,000 RP plus 10 HP instantly.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('currency_rp')">${ICON.diamond} 100</button></div>
      <div class="grand-deal-card currency"><small>Currency</small><strong>HP Refill XL</strong><p>70 HP for long play sessions.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('hp_70')">${ICON.diamond} 90</button></div>
      <div class="grand-deal-card"><small>Inventory</small><strong>Slot Burst</strong><p>Expand inventory by 50 slots.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('slot_50')">${ICON.diamond} 50</button></div>
      <div class="grand-deal-card growth"><small>Growth</small><strong>Power Material Vault</strong><p>5x 50% material cards sent to inventory.</p><button class="btn btn-live" onclick="buyGrandOpeningDeal('mat_50_5')">${ICON.diamond} 180</button></div>
      <div class="grand-deal-card wallpaper"><small>Lobby</small><strong>Wallpaper Ticket</strong><p>Get one free wallpaper unlock ticket.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal('wallpaper_ticket')">${ICON.rp} 80,000</button></div>
      <div class="grand-deal-card vip"><small>VIP</small><strong>Opening VIP Pass</strong><p>Unlock VIP status from a launch bundle.</p><button class="btn btn-live" onclick="buyGrandOpeningDeal('vip_pass')">${ICON.diamond} 300</button></div>
      <div class="grand-deal-card hot"><small>Event</small><strong>Event R Mailer</strong><p>One guaranteed R card from the current event pool.</p><button class="btn btn-live" onclick="buyGrandOpeningDeal('event_r')">${ICON.diamond} 700</button></div>
    </div>`;
  }

  function currentEventContext() {
    const active = [...document.querySelectorAll(".event-sub-content[data-event-group][data-event-theme]")].find((node) => node.style.display !== "none");
    const fallback = document.querySelector(".event-sub-content[data-event-group][data-event-theme]");
    const node = active || fallback;
    return { group: node?.dataset.eventGroup || "aespa", theme: node?.dataset.eventTheme || "Whole Different Animal" };
  }
  function spend(currency, cost) {
    const keyName = currency === "rp" ? "rp" : currency === "hp" ? "hp" : "diamonds";
    if ((user[keyName] || 0) < cost) {
      showToast(`Not enough ${currency === "rp" ? "RP" : currency === "hp" ? "HP" : "Diamonds"}.`);
      return false;
    }
    user[keyName] -= cost;
    return true;
  }
  function inboxPush(mail) {
    if (!user.inbox) user.inbox = [];
    user.inbox.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...mail });
    if (typeof checkInboxNoti === "function") checkInboxNoti();
  }
  window.buyGrandOpeningDeal = function (kind) {
    const ctx = currentEventContext();
    const deals = {
      premium_30: { currency: "diamond", cost: 160, mail: { title: "Grand Opening Premium Pack 30", type: "pack", packType: "premium", amount: 30 } },
      cards_50: { currency: "rp", cost: 390000, mail: { title: "Grand Opening Card Pack 50", type: "pack", packType: "regular", amount: 50 } },
      selector_r: { currency: "diamond", cost: 600, mail: { title: "Grand Opening R Selector", type: "pack", packType: "regular", grade: "R", amount: 1 } },
      selector_s2: { currency: "diamond", cost: 420, mail: { title: "Grand Opening S Selector Duo", type: "pack", packType: "regular", grade: "S", amount: 2 } },
      selector_a3: { currency: "diamond", cost: 240, mail: { title: "Grand Opening A Selector Trio", type: "pack", packType: "regular", grade: "A", amount: 3 } },
      currency_rp: { currency: "diamond", cost: 100, grant: () => { user.rp = (user.rp || 0) + 120000; user.hp = (user.hp || 0) + 10; } },
      hp_70: { currency: "diamond", cost: 90, grant: () => { user.hp = (user.hp || 0) + 70; } },
      slot_50: { currency: "diamond", cost: 50, grant: () => { user.boughtSlots = (user.boughtSlots || 0) + 50; } },
      mat_50_5: { currency: "diamond", cost: 180, grant: () => { for (let i = 0; i < 5; i++) user.inventory.push({ id: `mat_50_${Date.now()}_${i}`, type: "material", chance: .5, grade: "MAT", locked: false, level: 1, group: "SYSTEM", member: "MATERIAL", theme: "RESOURCE", url: "dynamic" }); } },
      wallpaper_ticket: { currency: "rp", cost: 80000, mail: { title: "Grand Opening Wallpaper Ticket", type: "mileage", amount: 1 } },
      vip_pass: { currency: "diamond", cost: 300, grant: () => { user.isVIP = true; } },
      event_r: { currency: "diamond", cost: 700, mail: { title: `${ctx.theme} Event R Mailer`, type: "pack", packType: "event_specific", grade: "R", group: ctx.group, theme: ctx.theme, amount: 1 } }
    };
    const deal = deals[kind];
    if (!deal || !spend(deal.currency, deal.cost)) return;
    if (deal.mail) inboxPush(deal.mail);
    if (deal.grant) deal.grant();
    showToast("Grand Opening Event deal claimed.");
    updateUI();
  };

  function refreshEventShop() {
    const tab = document.getElementById("shop-tab-event");
    if (!tab) return;
    tab.classList.add("event-shop-v5");
    document.querySelectorAll(".event-sub-content[data-event-group][data-event-theme]").forEach((container) => {
      const group = container.dataset.eventGroup;
      const theme = container.dataset.eventTheme;
      const featured = officialCards(group, theme, ["R", "S", "A", "A"]);
      const owned = ownedThemeCards(group, theme, false).length;
      const total = groupInfo(group).data?.members?.length || featured.length;
      container.querySelector(".event-v5-header")?.remove();
      const header = document.createElement("section");
      header.className = "event-v5-header";
      header.innerHTML = `<div class="event-v5-title"><span>Featured Theme</span><strong>${esc(display(group))}</strong><p>${esc(theme)} cards available now. ${owned}/${total} members owned.</p></div><div class="event-v5-card-strip">${featured.map((card, index) => cardTile(card, `featured-${index}`)).join("")}</div>`;
      const pointPanel = container.querySelector(".event-point-panel");
      if (pointPanel) pointPanel.insertAdjacentElement("afterend", header);
      else container.prepend(header);
      [
        { type: "A_CARD", cls: "a-pack", label: "A Grade Card", grades: ["A", "A", "A", "A"] },
        { type: "R_PACK", cls: "r-pack", label: "R Package", grades: ["R", "A", "A"] },
        { type: "PREMIUM_10", cls: "premium-pack", label: "Premium Pack 10", grades: ["R", "S", "A", "A", "S"] }
      ].forEach((cfg) => {
        const card = container.querySelector(`[onclick*="buySpecialEventPack"][onclick*="${cfg.type}"]`)?.closest(".event-pack-card");
        const media = card?.querySelector(".event-pack-media");
        if (!card || !media) return;
        const cards = officialCards(group, theme, cfg.grades);
        card.classList.add("event-pack-card-v5", cfg.cls);
        media.classList.add("limited-preview-ready", "event-pack-media-v5");
        media.innerHTML = `<div class="pack-card-stage ${cfg.cls}">${cards.map((item, index) => cardTile(item, `pack-${index}`)).join("")}</div><div class="pack-stage-label">${esc(display(group))} ${esc(cfg.label)}</div>`;
      });
    });
  }

  function refreshShopShell() {
    const modal = document.querySelector("#shop-modal .custom-modal");
    const tabs = document.querySelector(".shop-tabs-container");
    const home = document.getElementById("shop-tab-home");
    const grand = document.getElementById("shop-tab-blackmarket");
    const grandBtn = document.getElementById("tab-btn-blackmarket");
    if (modal) modal.classList.add("shop-modal-v5");
    if (tabs) tabs.classList.add("shop-tabs-v5");
    if (grandBtn) {
      grandBtn.dataset.shopTab = "grand";
      grandBtn.setAttribute("onclick", "switchShopTab('grand')");
      grandBtn.innerHTML = `${ICON.star} GRAND OPENING EVENT`;
      grandBtn.style.color = "var(--secondary-glow)";
    }
    if (grand) {
      grand.classList.add("grand-opening-tab-v5");
      grand.innerHTML = grandOpeningDealsHtml();
    }
    if (home && !home.querySelector(".shop-home-v5")) {
      home.insertAdjacentHTML("beforeend", `<section class="shop-home-v5">
        <button onclick="switchShopTab('event')"><span>${ICON.card}</span><strong>Featured Event Cards</strong><small>Limited cards by group</small></button>
        <button onclick="switchShopTab('premium')"><span>${ICON.pack}</span><strong>Premium Packs</strong><small>High grade odds</small></button>
        <button onclick="switchShopTab('grand')"><span>${ICON.star}</span><strong>Grand Opening Event</strong><small>Launch sales</small></button>
        <button onclick="switchShopTab('others')"><span>${ICON.gear}</span><strong>Others</strong><small>Slots and selectors</small></button>
      </section>`);
    }
  }

  const baseSwitchShop = typeof switchShopTab === "function" ? switchShopTab : null;
  window.switchShopTab = switchShopTab = function (tabName) {
    const requested = tabName === "blackmarket" || tabName === "xtreme" ? "grand" : tabName;
    if (baseSwitchShop) baseSwitchShop(requested === "grand" ? "xtreme" : requested);
    refreshShopShell();
    document.querySelectorAll(".shop-tab").forEach((btn) => btn.classList.remove("active"));
    const activeBtn = requested === "grand" ? document.getElementById("tab-btn-blackmarket") : document.querySelector(`[data-shop-tab="${requested}"], #tab-btn-${requested}`);
    activeBtn?.classList.add("active");
    document.querySelectorAll('.shop-content-area > div[id^="shop-tab-"]').forEach((panel) => { panel.style.display = "none"; });
    const panelId = requested === "grand" ? "shop-tab-blackmarket" : `shop-tab-${requested}`;
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = "block";
    if (requested === "wallpaper") {
      try {
        if (typeof populateBgGroups === "function") populateBgGroups();
        if (typeof filterBgShop === "function") filterBgShop("BASIC", document.querySelector("#shop-tab-wallpaper .bg-sub-tab"));
      } catch (error) {
        console.error("Wallpaper load error:", error);
      }
    }
    if (requested === "event") setTimeout(refreshEventShop, 50);
  };

  const baseOpenShop = typeof openShopModal === "function" ? openShopModal : null;
  window.openShopModal = openShopModal = function () {
    if (baseOpenShop) baseOpenShop();
    else {
      document.getElementById("shop-modal").style.display = "flex";
      if (typeof startShopCarousel === "function") startShopCarousel();
    }
    refreshShopShell();
    setTimeout(refreshEventShop, 100);
  };

  const baseSwitchEventSubTab = typeof switchEventSubTab === "function" ? switchEventSubTab : null;
  window.switchEventSubTab = switchEventSubTab = function (id, btn) {
    if (baseSwitchEventSubTab) baseSwitchEventSubTab(id, btn);
    setTimeout(refreshEventShop, 50);
  };

  function buildMyInfo() {
    const modal = document.getElementById("profile-modal-bg");
    if (!modal) return;
    modal.className = "custom-modal my-info-v5";
    modal.innerHTML = `<button class="close-btn my-info-close" onclick="withLoadingCircle(() => { document.getElementById('profile-modal').style.display = 'none' })">&times;</button>
      <section class="my-info-v5-shell">
        <header class="my-info-v5-header">
          <button class="mi-avatar-btn" onclick="withLoadingCircle(() => { openProfilePicModal() })"><img id="profile-modal-pic" alt="Profile"></button>
          <div><span>MY INFO</span><strong id="profile-uid">UID</strong><small id="profile-join-date">Joined: Unknown</small></div>
          <div class="mi-stat-strip"><div><span>Cards</span><strong id="profile-total-cards">0</strong></div><div><span>VIP</span><strong id="profile-vip-status">No</strong></div><div><span>Level</span><strong id="profile-level-val">1</strong></div></div>
        </header>
        <div class="my-info-v5-grid">
          <aside class="mi-fav-card-panel"><span>Favorite Card</span><img id="profile-fav-card" alt="Favorite card"><button class="btn btn-draw" onclick="withLoadingCircle(() => { toggleVault() })">CHANGE CARD</button></aside>
          <section class="mi-bio-panel"><label>Bio</label><textarea id="profile-bio-input" maxlength="160" placeholder="Add a short profile bio."></textarea><button class="btn btn-live" onclick="saveProfileBio()">${ICON.star} SAVE BIO</button></section>
          <section class="mi-wallpaper-showcase"><div><span>Favorite Wallpaper</span><small>Set with the crown in Lobby wallpapers</small></div><img id="profile-wallpaper-preview" alt="Favorite wallpaper"><div class="mi-wallpaper-actions"><button class="btn btn-draw" onclick="withLoadingCircle(() => { openBgEquipModal() })">CHANGE</button><button class="btn btn-live" onclick="downloadFavoriteWallpaper()">${ICON.ticket} SAVE IMAGE</button></div></section>
          <section class="mi-theme-showcase"><div><span>${ICON.crown} Favorite Theme Set</span><small>Set with the crown in Choose Theme</small></div><div id="profile-theme-cards" class="mi-theme-card-strip"></div></section>
        </div>
      </section>`;
  }
  function renderMyInfo() {
    const modal = document.getElementById("profile-modal-bg");
    if (!modal?.classList.contains("my-info-v5")) return;
    if (!user.profile) user.profile = {};
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("profile-uid", uid || "GUEST");
    setText("profile-join-date", `Joined: ${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : "Unknown"}`);
    setText("profile-total-cards", (user.inventory || []).length.toLocaleString());
    setText("profile-vip-status", user.isVIP ? "Yes" : "No");
    setText("profile-level-val", user.level || 1);
    const pfp = document.getElementById("profile-modal-pic");
    if (pfp) pfp.src = user.profile.profilePic || "https://ik.imagekit.io/shiningsuperstar/tr:lo-true:l-image,i-live@@resources@@live@@images@@card@@kep1er@@bubble_gum@@c_l_bubble_gum_dayeon.png,w-200,h-200,fo-face,r-max,lx-44,l-end/live/image.png";
    const favImg = document.getElementById("profile-fav-card");
    if (favImg) {
      if (user.favoriteCard) {
        favImg.src = cardImage(user.favoriteCard);
        favImg.style.opacity = "1";
      } else {
        favImg.removeAttribute("src");
        favImg.style.opacity = ".2";
      }
    }
    const bio = document.getElementById("profile-bio-input");
    if (bio && document.activeElement !== bio) bio.value = user.profile.bio || "";
    const wp = favoriteWallpaper();
    const wpImg = document.getElementById("profile-wallpaper-preview");
    if (wpImg) {
      const url = wallpaperUrl(wp);
      if (url) wpImg.src = url;
      else wpImg.removeAttribute("src");
    }
    const strip = document.getElementById("profile-theme-cards");
    if (strip) {
      const [group, theme] = String(user.profile.favThemeSet || "").split("||");
      if (!group || !theme) {
        strip.innerHTML = `<div class="mi-theme-empty">${ICON.crown}<strong>No favorite theme set</strong><span>Use the crown button in Choose Theme.</span></div>`;
      } else {
        const cards = ownedThemeCards(group, theme, false);
        strip.innerHTML = `<div class="mi-theme-title"><strong>${esc(display(group))}</strong><span>${esc(theme)}</span></div><div class="mi-theme-owned-cards">${cards.length ? cards.map((card) => `<div class="mi-theme-owned-card">${typeof createCardHTML === "function" ? createCardHTML(card, false, null) : cardTile(card)}</div>`).join("") : `<div class="mi-theme-empty">${ICON.card}<strong>No owned cards yet</strong><span>Collect this theme to fill the showcase.</span></div>`}</div>`;
      }
    }
  }
  window.downloadFavoriteWallpaper = function () {
    const wp = favoriteWallpaper();
    const url = wallpaperUrl(wp);
    if (!url) return showToast("No favorite wallpaper image to save.");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${key(wp?.name || "favorite_wallpaper")}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  window.saveFavoriteWallpaper = function (id) {
    if (!user.profile) user.profile = {};
    user.profile.favWallpaper = id;
    showToast("Favorite wallpaper saved.");
    updateUI();
    if (typeof renderBgEquipGrid === "function") renderBgEquipGrid();
    renderMyInfo();
  };
  window.setFavoriteWallpaper = window.saveFavoriteWallpaper;
  window.setFavoriteThemeSet = function (group, theme) {
    if (!user.profile) user.profile = {};
    user.profile.favThemeSet = `${group}||${theme}`;
    showToast(`${theme} set as favorite theme.`);
    updateUI();
    renderMyInfo();
  };
  window.openThemeSelectorModal = openThemeSelectorModal = function () {
    const groups = Object.keys(themeDatabase || {}).sort();
    const activeGroup = groups.length > 0 ? groups[currentSsGroupIndex] : null;
    const container = document.getElementById("theme-rows-container");
    if (!activeGroup || !container) return showToast("Select a group first.");
    const data = themeDatabase[activeGroup] || {};
    const themes = [...(data.themes || []), ...(data.le_themes || [])];
    const members = data.members || [];
    const favorite = user.profile?.favThemeSet || "";
    container.innerHTML = themes.map((theme) => {
      const cards = members.map((member) => {
        const owned = (user.inventory || []).filter((card) => card && card.type !== "material" && key(card.group) === key(activeGroup) && key(card.member) === key(member) && key(card.theme) === key(theme));
        if (owned.length) {
          owned.sort((a, b) => ((GRADE_WEIGHT[b.grade] || 0) * 100 + (b.level || 1)) - ((GRADE_WEIGHT[a.grade] || 0) * 100 + (a.level || 1)));
          return `<div class="theme-select-card">${typeof createCardHTML === "function" ? createCardHTML(owned[0], false, null) : cardTile(owned[0])}</div>`;
        }
        return `<div class="theme-select-card ghost"><img src="${esc(typeof getGhostCardUrl === "function" ? getGhostCardUrl(activeGroup, member, theme) : "")}" alt="${esc(member)}"></div>`;
      }).join("");
      const isFav = favorite === `${activeGroup}||${theme}`;
      return `<section class="theme-select-row-v5 ${isFav ? "favorite" : ""}"><header><div><span>${esc(theme)}</span><small>${esc(activeGroup)}</small></div><div class="theme-select-actions"><button class="fav-theme-btn ${isFav ? "on" : ""}" onclick="setFavoriteThemeSet(${jsArg(activeGroup)}, ${jsArg(theme)})" title="Set favorite theme">${ICON.crown}</button><button class="btn btn-draw" onclick="equipThemeCards(${jsArg(activeGroup)}, ${jsArg(theme)})">Equip theme</button></div></header><div class="theme-select-card-strip">${cards}</div></section>`;
    }).join("");
    document.getElementById("theme-selector-modal").style.display = "flex";
  };
  window.openProfileModal = openProfileModal = function () {
    buildMyInfo();
    document.getElementById("profile-modal").style.display = "flex";
    updateUI();
    renderMyInfo();
  };

  function topThemeForGroup(group) {
    const info = groupInfo(group);
    const groupInv = cbCalculatedData?.groupedInventory?.[info.key] || cbCalculatedData?.groupedInventory?.[group] || {};
    const themes = Object.keys(groupInv);
    if (!themes.length) return (info.data?.themes || info.data?.le_themes || [])[0] || "BASE";
    themes.sort((a, b) => Object.keys(groupInv[b] || {}).length - Object.keys(groupInv[a] || {}).length);
    return themes[0];
  }
  function renderCardBookMainFinal() {
    const main = document.getElementById("cb-view-main");
    if (!main) return;
    if (typeof calculateCardBookData === "function") calculateCardBookData();
    if (!user.cbMilestones) user.cbMilestones = { cardsLevel: 1, themesLevel: 1 };
    const best = cbCalculatedData?.bestGroup || { name: "NONE", points: 0, maxGrade: "C" };
    const stats = cbCalculatedData?.groupStats?.[best.name] || { owned: 0, total: 0, points: 0, maxGrade: "C" };
    const info = groupInfo(best.name);
    const theme = topThemeForGroup(best.name);
    const cards = ownedThemeCards(info.key || best.name, theme, true);
    const cardsTarget = user.cbMilestones.cardsLevel * 50;
    const themesTarget = user.cbMilestones.themesLevel * 500;
    const totalUnique = Number(cbCalculatedData?.totalUniqueCards || 0);
    const totalThemePoints = Number(cbCalculatedData?.totalThemePoints || 0);
    const cardPct = Math.min(100, (totalUnique / cardsTarget) * 100);
    const themePct = Math.min(100, (totalThemePoints / themesTarget) * 100);
    // FIX: Get lobby bg skin for hero background
    const equippedBgId = user.equippedWallpapers?.[0];
    const equippedBgItem = (wallpaperDatabase || []).find(bg => bg.id === equippedBgId);
    const lobbyBgUrl = equippedBgItem ? (equippedBgItem.url || equippedBgItem.image || equippedBgItem.img || equippedBgItem.src || "") : "";
    const heroBgStyle = lobbyBgUrl ? `background-image: url('${lobbyBgUrl}'); background-size: cover; background-position: center;` : "";
    // FIX: Member shortage display — show count with clear label
    const memberCount = stats.owned || 0;
    const memberTotal = stats.total || 0;
    const shortage = Math.max(0, memberTotal - memberCount);
    const shortageText = shortage > 0 ? ` (${shortage} missing)` : " (complete!)";
    main.classList.add("cb-main-v5");
    main.innerHTML = `<section class="cb-v5-hero" style="${heroBgStyle}">
      <div class="cb-v5-hero-copy"><span>Best Group Deck</span><strong>${esc(display(best.name))}</strong><p>${Number(stats.points || 0).toLocaleString()} pts &mdash; ${memberCount} / ${memberTotal} members${shortageText}. Theme: ${esc(theme)}.</p></div>
      <div class="cb-v5-card-strip">${cards.map((card) => card.ghost ? cardTile(card, "cb-ghost") : `<div class="cb-v5-owned-card">${typeof createCardHTML === "function" ? createCardHTML(card, false, null) : cardTile(card)}</div>`).join("")}</div>
      <div class="cb-grade-medal cb-grade-medal-v4" style="--grade-color:${gradeColor(best.maxGrade)}">${esc(best.maxGrade || "C")}</div>
    </section>
    <section class="cb-v5-stats">
      <div><span>Total Theme Points</span><strong>${totalThemePoints.toLocaleString()}</strong></div>
      <div><span>Unique Cards</span><strong>${totalUnique.toLocaleString()}</strong></div>
      <div><span>Best Group Slots</span><strong>${Number(stats.owned || 0).toLocaleString()} / ${Number(stats.total || 0).toLocaleString()}</strong></div>
      <div><span>Best Grade</span><strong>${esc(best.maxGrade || "C")}</strong></div>
    </section>
    <section class="cb-v5-rewards">
      <div class="cb-reward-box cb-reward-refresh"><div class="cb-reward-header"><div><span class="cb-kicker aqua">Card Collector</span><h3>Unlock ${cardsTarget.toLocaleString()} unique cards</h3></div><strong>${totalUnique.toLocaleString()} / ${cardsTarget.toLocaleString()}</strong></div><div class="cb-progress"><span style="width:${cardPct}%"></span></div><div class="cb-reward-footer"><span>${ICON.diamond} ${(user.cbMilestones.cardsLevel * 10).toLocaleString()} Diamonds</span><button class="btn btn-draw cb-claim-btn" ${totalUnique >= cardsTarget ? `onclick="claimCBMilestone('cards', ${user.cbMilestones.cardsLevel * 10})"` : "disabled"}>${totalUnique >= cardsTarget ? "Claim" : "Locked"}</button></div></div>
      <div class="cb-reward-box cb-reward-refresh warm"><div class="cb-reward-header"><div><span class="cb-kicker rose">Theme Mastery</span><h3>Reach ${themesTarget.toLocaleString()} card book points</h3></div><strong>${totalThemePoints.toLocaleString()} / ${themesTarget.toLocaleString()}</strong></div><div class="cb-progress"><span style="width:${themePct}%"></span></div><div class="cb-reward-footer"><span>${ICON.rp} ${(user.cbMilestones.themesLevel * 5000).toLocaleString()} RP</span><button class="btn btn-live cb-claim-btn" ${totalThemePoints >= themesTarget ? `onclick="claimCBMilestone('themes', ${user.cbMilestones.themesLevel * 5000})"` : "disabled"}>${totalThemePoints >= themesTarget ? "Claim" : "Locked"}</button></div></div>
    </section>`;
  }
  window.renderCardBookMain = renderCardBookMain = renderCardBookMainFinal;
  const baseRenderCardBook = typeof renderCardBook === "function" ? renderCardBook : null;
  window.renderCardBook = renderCardBook = function () {
    const specific = document.getElementById("cb-view-specific");
    const groups = document.getElementById("cb-view-groups");
    if (specific && specific.style.display !== "none") {
      const group = document.getElementById("cb-specific-group-name")?.innerText;
      if (group && typeof openCardBookSpecific === "function") return openCardBookSpecific(group);
    }
    if (groups && groups.style.display !== "none" && typeof renderCardBookGroups === "function") return renderCardBookGroups();
    return renderCardBookMainFinal() || (baseRenderCardBook ? baseRenderCardBook() : undefined);
  };

  const baseUpdateUI = typeof updateUI === "function" ? updateUI : null;
  window.updateUI = updateUI = function () {
    const result = baseUpdateUI ? baseUpdateUI.apply(this, arguments) : undefined;
    if (document.getElementById("profile-modal")?.style.display === "flex") renderMyInfo();
    return result;
  };

  document.addEventListener("DOMContentLoaded", () => {
    refreshShopShell();
    refreshEventShop();
  });
  setTimeout(() => {
    refreshShopShell();
    refreshEventShop();
  }, 1300);
})();

// Initialize tickets in user object if not present
if (!user.tickets) {
  user.tickets = { cardSelector: 0, wallpaper: 0 };
}

// Opens the Card Selector UI
function useCardSelectorTicket() {
  if (user.tickets.cardSelector <= 0) {
    alert("You don't have any Card Selector Tickets!");
    return;
  }
  
  document.getElementById('card-selector-modal').style.display = 'flex';
  document.getElementById('selector-group-list').style.display = 'grid';
  document.getElementById('selector-card-list').style.display = 'none';
  
  // Example: Populate groups (Replace with your actual group database variable)
  const groupContainer = document.getElementById('selector-group-list');
  groupContainer.innerHTML = ''; 
  
  const groups = ["Aespa", "Stray Kids", "LOONA", "New Jeans", "ILLIT"]; // Replace with your DB array
  groups.forEach(group => {
    let btn = document.createElement('button');
    btn.className = 'btn btn-draw glam-btn';
    btn.innerText = group;
    btn.onclick = () => showCardsForGroup(group);
    groupContainer.appendChild(btn);
  });
}

// Shows cards for the selected group
function showCardsForGroup(groupName) {
  document.getElementById('selector-group-list').style.display = 'none';
  const cardContainer = document.getElementById('selector-card-list');
  cardContainer.style.display = 'grid';
  cardContainer.innerHTML = `<button class="btn" onclick="useCardSelectorTicket()">Back to Groups</button><br>`;
  
  // You will need to filter your master card database here
  // Mock example:
  let mockCard = document.createElement('div');
  mockCard.className = 'card-item glass-card';
  mockCard.innerHTML = `
    <h4>${groupName} - Any Theme</h4>
    <button class="btn btn-live" onclick="confirmCardSelection('${groupName}_Card_ID')">Select</button>
  `;
  cardContainer.appendChild(mockCard);
}

// Finalize the selection
function confirmCardSelection(cardId) {
  if (confirm("Are you sure you want to select this card?")) {
    user.tickets.cardSelector -= 1;
    user.inventory.push(cardId); // Ensure this matches your actual inventory logic
    document.getElementById('card-selector-modal').style.display = 'none';
    updateUI(); // Refresh top bar
    alert("Card successfully claimed!");
  }
}
// Wrap your existing wallpaper buy button to call this function first
function attemptWallpaperPurchase(wallpaperId, cost, currencyType) {
  const hasTicket = user.tickets && user.tickets.wallpaper > 0;
  
  if (hasTicket) {
    // Show prompt if they have a ticket
    const useTicket = confirm(`You have ${user.tickets.wallpaper} Wallpaper Ticket(s)! Do you want to use a ticket instead of paying ${cost} ${currencyType}? \n\nOK = Use Ticket \nCancel = Pay with ${currencyType}`);
    
    if (useTicket) {
      user.tickets.wallpaper -= 1;
      grantWallpaper(wallpaperId);
      return;
    }
  }
  
  // Fallback to normal currency check if no ticket or they clicked cancel
  if (currencyType === 'diamonds' && user.diamonds >= cost) {
    user.diamonds -= cost;
    grantWallpaper(wallpaperId);
  } else if (currencyType === 'rp' && user.rp >= cost) {
    user.rp -= cost;
    grantWallpaper(wallpaperId);
  } else {
    alert(`Not enough ${currencyType}!`);
  }
}

// Keep your existing grant logic inside this function
function grantWallpaper(wallpaperId) {
  user.profile.favWallpaper = wallpaperId; // Or push to an unlocked list
  updateUI();
  alert("Wallpaper unlocked!");
}
