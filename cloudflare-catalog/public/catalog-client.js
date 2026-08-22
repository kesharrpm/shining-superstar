export class ShiningCatalogClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl || "").replace(/\/$/, "");
    this.bootstrap = null;
    this.groupCache = new Map();
  }

  async init() {
    const r = await fetch(`${this.baseUrl}/api/bootstrap`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Catalog bootstrap failed: HTTP ${r.status}`);
    this.bootstrap = await r.json();
    return this.bootstrap;
  }

  async group(group) {
    const groupSlug = this.slug(group);
    if (this.groupCache.has(groupSlug)) return this.groupCache.get(groupSlug);
    const r = await fetch(`${this.baseUrl}/api/group/${encodeURIComponent(groupSlug)}`);
    if (!r.ok) throw new Error(`Catalog group failed: HTTP ${r.status}`);
    const data = await r.json();
    this.groupCache.set(groupSlug, data);
    return data;
  }

  asset(bindingKey) {
    if (!this.bootstrap) throw new Error("Call Catalog.init() before requesting assets");
    return `${this.baseUrl}/a/${encodeURIComponent(this.bootstrap.version)}/${encodeURIComponent(bindingKey)}`;
  }

  card({ group, theme, member, grade, size = "large" }) {
    return this.asset(`card:${this.slug(group)}:${this.slug(theme)}:${this.slug(member)}:${String(grade).toLowerCase()}:${size}`);
  }

  ghostCard({ group, theme, member, size = "large" }) {
    return this.asset(`ghost:${this.slug(group)}:${this.slug(theme)}:${this.slug(member)}:${size}`);
  }

  profile({ group, theme, member }) {
    return this.asset(`profile:${this.slug(group)}:${this.slug(theme)}:${this.slug(member)}`);
  }

  alias(name) {
    return this.asset(this.normalizeAssetName(name));
  }

  slug(value) {
    return String(value ?? "")
      .trim().toLowerCase().replace(/[’']/g, "").replace(/&/g, "and")
      .replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  normalizeAssetName(value) {
    return String(value ?? "").replace(/\\/g, "/").split("?")[0].split("#")[0]
      .replace(/^\/+/, "").replace(/^images\//i, "")
      .replace(/\.(png|webp|jpe?g|gif|avif)$/i, "").toLowerCase();
  }
}
