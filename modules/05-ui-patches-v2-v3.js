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
    if (reward.type === "PassEXP") return "Tour XP";
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
