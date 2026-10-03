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
    const raw = String(baseImgPath || "").split("@@").pop();
    const normalized = normalizeAssetName(raw);
    if (catalogRuntime.apiHealthy && Array.isArray(profilePicDatabase)) {
      const pfp = profilePicDatabase.find((item) => normalizeAssetName(item?.basePath) === normalized);
      if (pfp) return getCatalogProfilePicUrl(pfp.groupName || pfp.group, pfp.member, pfp.theme);
    }
    const filename = raw.replace(/\.png$/i, "");
    if (!filename) return baseGetProfilePicUrl ? baseGetProfilePicUrl(baseImgPath) : "";
    return `https://res.cloudinary.com/shining-superstar/c_thumb,g_face,w_200,h_200,r_max/${filename}.png`;
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

// Legacy fake selector implementation removed in 4.3.0.

