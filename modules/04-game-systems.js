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
    const gachaDock = document.querySelector(".hud-bottom-dock");
    if (gachaDock) { gachaDock.style.opacity = "0"; gachaDock.style.pointerEvents = "none"; }

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
        if (!Array.isArray(user.inbox)) user.inbox = [];
        user.inbox.push({ id: Date.now().toString() + "_overflow", title: "Overflow Cards", type: "overflow_cards", cards: overflowCards, amount: overflowCards.length });
        if (typeof showToast === 'function') showToast(`⚠️ Inventory Full! ${overflowCards.length} cards sent to Inbox.`);
        if (typeof checkInboxNoti === 'function') checkInboxNoti();
    }

    // ✨ Push newly generated cards immediately to Firebase!
    if (typeof uid !== 'undefined' && typeof db !== 'undefined') {
        db.collection("users").doc(currentUserDocId()).update({ inventory: user.inventory, inbox: user.inbox, rp: user.rp, hp: user.hp, diamonds: user.diamonds, missions: user.missions || {} }).catch(err => console.log(err));
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
        const gachaDock = document.querySelector(".hud-bottom-dock");
        if (gachaDock) { gachaDock.style.opacity = "1"; gachaDock.style.pointerEvents = "auto"; }
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
        if (currency === "rp" && user.rp < cost) return showToast("Not enough RP!");
        if (currency === "diamond" && user.diamonds < cost) return showToast("Not enough Diamonds!");
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
    const isLETheme = isLimitedTheme(group, selectedTheme);
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
          const isLE = isLimitedTheme(group, selectedTheme);
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
              showToast(`You don't own any cards for this theme.`);
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
            document.getElementById('superstar-collection-modal').style.display = 'flex'; 
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
    // Catalog/themeData determine LE status; EVENT alone is not treated as limited.
    const isLE = rawPhotoUrl.includes("limitednewframe") || isLimitedTheme(card.group, card.theme);
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
    
    const isLE = isLimitedTheme(c.group, c.theme);
    
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
    const isLE = isLimitedTheme(card.group, card.theme);
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
                <h2 style="color: var(--tertiary-glow); letter-spacing: 3px; margin-bottom: 5px;">MAX LEVEL MILESTONE!</h2>
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
            db.collection("users").doc(currentUserDocId()).update({
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

          if (code === "") return showToast("Please enter a code.");
          if (user.claimedCoupons.includes(code)) return showToast("Coupon already claimed.");

          showToast("Verifying code...");

          try {
            const couponDoc = await db.collection("coupons").doc(code).get();

            if (!couponDoc.exists) {
              return showToast("Invalid or expired coupon code.");
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
            showToast("Could not connect to the server.");
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
        db.collection("users").doc(currentUserDocId()).update({
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
    if (fusionSlots.includes(null)) return showToast("Fill all 3 slots to fuse.");
    if (user.rp < 10000) return showToast("Not enough RP! (Need 10,000)");

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
                <h2 style="color: #d4af37; margin-top: 0; font-family: sans-serif; letter-spacing: 2px;">BUNDLE CLAIMED!</h2>
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

