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
      let visualEffectsEnabled = localStorage.getItem("shining_fx_enabled") !== "false";
      let particleAnimationFrame = 0;

      const sfxClick = new Audio("https://superstarcdn.onelocal.host/mixkit-modern-technology-select-3124.wav");
      // Add the audio elements (replace with your preferred URLs)
const sfxRareReveal = new Audio("https://superstarcdn.onelocal.host/mixkit-rare-reveal.wav"); // Use for S grade
const sfxEpicReveal = new Audio("https://superstarcdn.onelocal.host/mixkit-epic-reveal.wav"); // Use for R/LE grade
let previousModalId = null;
async function bootShiningGame() {
  try {
    applySettingsOnLoad();
    hideInstantWaitScreen();

    let edgeCatalog = null;
    setLoadingState("CONNECTING CATALOG", "Cloudflare D1 + edge assets…", 6);
    try {
      edgeCatalog = await loadEdgeCatalog();
    } catch (apiError) {
      catalogRuntime.mode = "legacy-bundles";
      catalogRuntime.apiHealthy = false;
      console.warn("[Catalog API] Edge catalog unavailable. Falling back to encrypted bundles.", apiError);
    }

    if (edgeCatalog) {
      setLoadingState("LOADING GAME DATA", "Live groups, themes & wallpapers…", 44);
      themeDatabase = edgeCatalog.themeData;
      wallpaperDatabase = normalizeApiWallpaperRows(edgeCatalog.wallpaperRows);
      setLoadingState("CATALOG READY", catalogApiStatusText(), 92);
      const cacheStatus = document.getElementById("catalog-cache-status");
      if (cacheStatus) cacheStatus.textContent = "Cloudflare edge catalog · assets load only when needed";
    } else {
      setLoadingState("FALLBACK CATALOG", "Preparing encrypted manifest…", 2);
      await fetchManifest();
      setLoadingState("FALLBACK CATALOG", "Theme & wallpaper metadata…", 4);
      const requiredMetadataPromise = Promise.all([
        fetchProjectJson("qa/wallpaperData.json", { required: true, label: "Wallpaper data" }),
        fetchProjectJson("qa/themeData.json", { required: true, label: "Theme data" })
      ]);
      const [, [w, t]] = await Promise.all([preloadAllBundles(), requiredMetadataPromise]);
      wallpaperDatabase = remapWallpaperDatabaseToCatalog(Array.isArray(w) ? w : []);
      themeDatabase = t && typeof t === "object" ? t : {};
    }

    poolData = poolData && typeof poolData === "object" ? poolData : { main: [] };
    urlData = Array.isArray(urlData) ? urlData : [];
    cardMap = cardMap && typeof cardMap === "object" ? cardMap : {};
    noticeDatabase = Array.isArray(noticeDatabase) ? noticeDatabase : [];
    lobbyBanners = Array.isArray(lobbyBanners) ? lobbyBanners : [];

    if (!Object.keys(themeDatabase || {}).length) throw new Error("Theme database is empty");
    if (!Array.isArray(wallpaperDatabase)) wallpaperDatabase = [];

    buildProfilePictureDatabase();

    // Legacy static promotional art stays untouched. Dynamic game cards/profiles/
    // ghosts/wallpapers now resolve through the Worker in edge mode.
    if (!catalogRuntime.apiHealthy) hydrateStaticCatalogAssets(document);
    initPremiumInteractions();
    setLoadingState("FINALIZING", "Preparing interface…", 97);

    if (canvas && ctx) {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas, { passive: true });
      initParticles();
      animate();
    }

    const savedUid = localStorage.getItem("shining_uid");
    const idInput = document.getElementById("user-id");
    if (savedUid && idInput) idInput.value = savedUid;
    try { await restoreAuthSession(); }
    catch (authError) { console.warn("[Boot] Auth session restore skipped:", authError); }

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
    const readyDetail = catalogRuntime.apiHealthy
      ? `EDGE CATALOG · ${catalogApiStatusText()}`
      : `${bootState.catalog.loadedBundles} fallback bundles · ${bootState.catalog.assets} assets`;
    setLoadingState("READY", readyDetail, 100);
    armStartGate();
    queueMicrotask(() => {
      loadOptionalGameData().catch((error) => console.info("[Boot] Optional game data finished with errors.", error));
    });
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
        const snapshot = await db.collection("leaderboard").get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = doc.id === currentUserDocId();
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
                name: data.handle || "PLAYER",
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
    
    let icon = bulkConfig.currency === 'rp' ? 'RP' : (bulkConfig.currency === 'diamond' ? 'DIAMOND' : 'HP');
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
        if (user.diamonds < totalCost) return showToast("Not enough Diamonds!");
        user.diamonds -= totalCost;
    } else {
        if (user.rp < totalCost) return showToast("Not enough RP!");
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
    if (card.locked) return showToast("Card is locked. Unlock it first.");
    
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
        if (user.diamonds < 50) return showToast("Not enough Diamonds!");

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
      /* ✨ PERFORMANCE-AWARE AMBIENT PARTICLE ENGINE ✨ */
      function initParticles() {
        if (!canvas || !ctx) return;
        particles.length = 0;
        if (!visualEffectsEnabled || isReduceTrans) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
        const area = Math.max(1, window.innerWidth * window.innerHeight);
        const count = Math.max(24, Math.min(window.innerWidth < 720 ? 34 : 64, Math.round(area / 28000)));
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.18,
            vy: -0.04 - Math.random() * 0.14,
            size: 0.7 + Math.random() * 1.8,
            alpha: 0.12 + Math.random() * 0.34,
            phase: Math.random() * Math.PI * 2,
            tone: Math.random() > 0.55 ? "255,35,88" : (Math.random() > 0.5 ? "0,245,212" : "255,214,64")
          });
        }
      }
      function animate() {
        if (particleAnimationFrame) cancelAnimationFrame(particleAnimationFrame);
        const frame = (now = 0) => {
          particleAnimationFrame = requestAnimationFrame(frame);
          if (!ctx || document.hidden || !visualEffectsEnabled || isReduceTrans) {
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -8) { p.y = canvas.height + 8; p.x = Math.random() * canvas.width; }
            if (p.x < -8) p.x = canvas.width + 8;
            if (p.x > canvas.width + 8) p.x = -8;
            const twinkle = 0.72 + Math.sin(now * 0.0015 + p.phase) * 0.28;
            ctx.fillStyle = `rgba(${p.tone},${Math.max(0.04, p.alpha * twinkle)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * twinkle, 0, Math.PI * 2);
            ctx.fill();
          }
        };
        particleAnimationFrame = requestAnimationFrame(frame);
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
            db.collection("users").doc(currentUserDocId()).update({ profile: user.profile });
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
            return showToast("Not enough RP! You need 20,000 RP.");
        }

        user.rp -= 20000;
        user.unlockedPFPs.push(pendingPurchasePfpId);
        
        if (uid && typeof db !== "undefined") {
            db.collection("users").doc(currentUserDocId()).update({
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
        const isLE = isLimitedTheme(c.group, c.theme);

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
    const isLE = isLimitedTheme(card.group, card.theme);

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
        showToast("Not enough RP! You need 20,000 RP.");
        return;
    }

    // Process the transaction
    user.rp -= 20000;
    user.unlockedPFPs.push(pendingPurchasePfpId);
    
    // Save to Firebase immediately
    if (uid && typeof db !== "undefined") {
        db.collection("users").doc(currentUserDocId()).update({
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

  // If no wallpaper is equipped, prefer a free published/legacy wallpaper.
  if (!user.equippedWallpapers || user.equippedWallpapers.length === 0) {
    if (Array.isArray(wallpaperDatabase) && wallpaperDatabase.length > 0) {
      const freeWallpapers = wallpaperDatabase.filter((bg) => bg.currency === "free");
      const pool = freeWallpapers.length ? freeWallpapers : wallpaperDatabase;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      user.equippedWallpapers = pick?.id ? [pick.id] : [];
    }
    if (!user.equippedWallpapers?.length) user.equippedWallpapers = ["H2H_01"];
  }

  const recordFor = (id) => {
    if (!Array.isArray(wallpaperDatabase) || !wallpaperDatabase.length) return null;
    return wallpaperDatabase.find((w) => String(w.id) === String(id)) || wallpaperDatabase[0] || null;
  };

  const imageLoads = (url) => new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 6500);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });

  const resolveBgUrl = async (id) => {
    const bg = recordFor(id);
    if (!bg) return "";
    const candidates = [...new Set([
      bg.url,
      bg.legacyUrl,
      bg.legacy_url,
      bg.sourceUrl,
      bg.source_url
    ].filter(Boolean).map(String))];
    for (const url of candidates) {
      if (await imageLoads(url)) return url;
    }
    return candidates[0] || "";
  };

  let bgRequestToken = 0;
  const setLobbyBackground = async (id) => {
    const token = ++bgRequestToken;
    const bgUrl = await resolveBgUrl(id);
    if (!bgUrl || token !== bgRequestToken) return;

    // Important is intentional: the wallpaper is content and must win over
    // decorative body gradients from later theme/CSS layers.
    document.body.style.setProperty("background-image", `url("${bgUrl.replace(/"/g, '\\"')}")`, "important");
    document.body.style.setProperty("background-size", "cover", "important");
    document.body.style.setProperty("background-position", "center center", "important");
    document.body.style.setProperty("background-repeat", "no-repeat", "important");
    document.body.dataset.lobbyWallpaper = String(id || "");
  };

  let currentIndex = Math.floor(Math.random() * Math.max(1, user.equippedWallpapers.length));
  setLobbyBackground(user.equippedWallpapers[currentIndex]);

  if (user.equippedWallpapers.length > 1) {
    bgRotationInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % user.equippedWallpapers.length;
      setLobbyBackground(user.equippedWallpapers[currentIndex]);
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
            return showToast("Keep at least 1 background equipped.");
          }
          user.equippedWallpapers.splice(index, 1);
        } else {
          // Trying to equip
          if (user.equippedWallpapers.length >= 25) {
            return showToast("Maximum of 25 backgrounds equipped.");
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
        if (!container) return;
        container.innerHTML = "";
        if (!visualEffectsEnabled || isReduceTrans) return;
        const count = window.innerWidth < 720 ? 14 : 26;
        for (let i = 0; i < count; i++) {
          const sparkle = document.createElement("div");
          sparkle.className = "css-sparkle";
          sparkle.style.top = Math.random() * 100 + "%";
          sparkle.style.left = Math.random() * 100 + "%";
          sparkle.style.animationDuration = 1.8 + Math.random() * 3.5 + "s";
          sparkle.style.animationDelay = Math.random() * 3 + "s";
          sparkle.style.opacity = String(0.22 + Math.random() * 0.65);
          container.appendChild(sparkle);
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
        const bgmSlider = document.getElementById("vol-bgm");
        const sfxSlider = document.getElementById("vol-sfx");
        const bgm = document.getElementById("bgm");
        const preview = document.getElementById("song-preview-audio");
        const transparencyToggle = document.getElementById("toggle-transparency");
        const effectsToggle = document.getElementById("toggle-effects");
        if (bgmSlider) bgmSlider.value = globalBgmVolume;
        if (sfxSlider) sfxSlider.value = globalSfxVolume;
        if (bgm) bgm.volume = globalBgmVolume;
        if (preview) preview.volume = globalBgmVolume;
        if (transparencyToggle) transparencyToggle.checked = isReduceTrans;
        if (effectsToggle) effectsToggle.checked = visualEffectsEnabled;
        document.body.classList.toggle("reduce-transparency", isReduceTrans);
        applyVisualEffectsPreference();
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
        document.body.classList.toggle("reduce-transparency", isChecked);
        applyVisualEffectsPreference();
      }

      function applyVisualEffectsPreference() {
        const enabled = visualEffectsEnabled && !isReduceTrans;
        document.body.classList.toggle("effects-off", !enabled);
        if (!canvas || !ctx) return;
        if (enabled) {
          resizeCanvas();
          initParticles();
          animate();
          if (bootState.started) spawnLobbySparkles();
        } else {
          if (particleAnimationFrame) cancelAnimationFrame(particleAnimationFrame);
          particleAnimationFrame = 0;
          particles.length = 0;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const sparkleLayer = document.getElementById("lobby-sparkles");
          if (sparkleLayer) sparkleLayer.innerHTML = "";
        }
      }

      function toggleVisualEffects(isChecked) {
        visualEffectsEnabled = Boolean(isChecked);
        localStorage.setItem("shining_fx_enabled", String(visualEffectsEnabled));
        applyVisualEffectsPreference();
      }
      window.toggleVisualEffects = toggleVisualEffects;

