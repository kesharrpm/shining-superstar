      /* ✨ UTILS ✨ */
      function resizeCanvas() {
        if (!canvas || !ctx) return;
        // Keep a 1:1 drawing buffer for this tiny ambient layer; huge DPR buffers
        // waste memory on phones/4K screens without visible benefit for soft particles.
        canvas.width = Math.max(1, window.innerWidth);
        canvas.height = Math.max(1, window.innerHeight);
        if (visualEffectsEnabled && !isReduceTrans) initParticles();
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

      /* AUTH V2 — Firebase Auth + private Firestore player documents */
function freshUserTemplate(handle, firebaseUid) {
  return {
    authUid: firebaseUid, authVersion: 2, handle, handleKey: normalizeHandleKey(handle),
    rp: 50000, hp: 50, exp: 0, level: 1, mileage: 5, diamonds: 500,
    inventory: [], deck: {}, profile: {},
    missions: { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false },
    inbox: [{ id: Date.now().toString(), title: "Welcome to SHINING SUPERSTAR!", type: "pack", packType: "premium", amount: 3 }],
    isVIP: false, joinDate: new Date().toISOString(), lastLogin: new Date().toISOString()
  };
}

function sanitizePrivateUserData(data) {
  const clean = { ...(data || {}) };
  delete clean.passcode;
  delete clean.password;
  delete clean.passwordHash;
  return clean;
}

async function setAuthPersistence() {
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
}

async function loadAuthenticatedPlayer(firebaseUser, preferredHandle = "") {
  if (!firebaseUser) return false;
  const ref = db.collection("users").doc(firebaseUser.uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Authenticated account has no SHINING profile.");
  const data = sanitizePrivateUserData(snap.data());
  authUid = firebaseUser.uid;
  uid = String(data.handle || preferredHandle || localStorage.getItem("shining_uid") || "PLAYER");
  user = { ...user, ...data, authUid, authVersion: 2, handle: uid, handleKey: normalizeHandleKey(uid) };
  completeLogin();
  return true;
}

function authErrorMessage(error, mode = "login") {
  const code = String(error?.code || "");
  if (code === "auth/email-already-in-use") return "That username already has an account. Use ENTER STAGE.";
  if (code === "auth/weak-password") return "Use a password with at least 8 characters.";
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(code)) return "Username or password is incorrect.";
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  return error?.message || (mode === "register" ? "Account creation failed." : "Authentication failed.");
}

async function tryLegacyMigration(handle, password) {
  // Transitional bridge only. Once strict Firestore rules are deployed, old
  // plaintext-password documents are intentionally no longer readable.
  const legacyRef = db.collection("users").doc(handle);
  let legacySnap;
  try { legacySnap = await legacyRef.get(); }
  catch (error) {
    if (String(error?.code || "").includes("permission-denied")) return false;
    throw error;
  }
  if (!legacySnap.exists) return false;
  const legacy = legacySnap.data() || {};
  if (!legacy.passcode) throw new Error("This passwordless legacy account needs an admin migration/reset.");
  if (String(legacy.passcode) !== password) return false;
  if (password.length < 8) throw new Error("This legacy password is too short. Migrate/reset the account with a new 8+ character password.");

  const email = await authEmailForHandle(handle);
  const credential = await auth.createUserWithEmailAndPassword(email, password);
  const clean = sanitizePrivateUserData(legacy);
  clean.authUid = credential.user.uid;
  clean.authVersion = 2;
  clean.handle = handle;
  clean.handleKey = normalizeHandleKey(handle);
  clean.migratedAt = new Date().toISOString();
  clean.lastLogin = new Date().toISOString();

  const batch = db.batch();
  batch.set(db.collection("users").doc(credential.user.uid), clean, { merge: true });
  batch.delete(legacyRef);
  await batch.commit();
  showToast("Legacy account upgraded to secure Firebase Authentication.");
  return loadAuthenticatedPlayer(credential.user, handle);
}

async function handleAuth(mode = "login") {
  const handle = document.getElementById("user-id")?.value.trim() || "";
  const password = document.getElementById("user-pass")?.value || "";
  if (!handle) return showToast("Please enter your username / UID.");
  if (!password) return showToast("Please enter your password.");
  if (mode === "register" && password.length < 8) return showToast("Use at least 8 characters for new accounts.");
  playClickSound();
  await setAuthPersistence();
  const email = await authEmailForHandle(handle);

  try {
    if (mode === "register") {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      authUid = credential.user.uid;
      uid = handle;
      user = { ...user, ...freshUserTemplate(handle, authUid) };
      await db.collection("users").doc(authUid).set(user, { merge: false });
      completeLogin();
      showToast("New secure account created! +50,000 RP");
      checkInboxNoti();
      return;
    }

    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      await loadAuthenticatedPlayer(credential.user, handle);
      return;
    } catch (error) {
      const code = String(error?.code || "");
      if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
        const migrated = await tryLegacyMigration(handle, password);
        if (migrated) return;
      }
      throw error;
    }
  } catch (error) {
    console.error("Firebase Auth Error:", error);
    showToast(authErrorMessage(error, mode));
  }
}

async function restoreAuthSession() {
  const firebaseUser = await new Promise((resolve) => {
    let settled = false;
    const stop = auth.onAuthStateChanged((value) => {
      if (settled) return;
      settled = true; stop(); resolve(value || null);
    }, () => { if (!settled) { settled = true; resolve(null); } });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { stop(); } catch (_) {}
      resolve(auth.currentUser || null);
    }, 8000);
  });
  if (!firebaseUser) return false;
  try { return await loadAuthenticatedPlayer(firebaseUser); }
  catch (error) {
    console.warn("[Auth] Persisted session had no usable profile.", error);
    await auth.signOut().catch(() => {});
    authUid = null;
    return false;
  }
}

let leaderboardSyncTimer = 0;
function schedulePublicPlayerSync() {
  if (!authUid || !uid) return;
  clearTimeout(leaderboardSyncTimer);
  leaderboardSyncTimer = setTimeout(() => {
    const payload = {
      authUid, handle: String(uid),
      leagueScore: Math.max(0, Number(user?.leagueScore || 0)),
      level: Math.max(1, Number(user?.level || 1)),
      profilePic: String(user?.profile?.profilePic || ""),
      updatedAt: new Date().toISOString()
    };
    db.collection("leaderboard").doc(authUid).set(payload, { merge: true }).catch((error) => {
      console.info("[Leaderboard] Public profile sync skipped:", error?.message || error);
    });
  }, 500);
}

function updateUI() {
  if (uid) localStorage.setItem("shining_uid", uid);
  if (!user.missions) user.missions = { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false };
  if (!user.profile) user.profile = {};
  const defaultPfp = "https://ik.imagekit.io/shiningsuperstar/tr:lo-true:l-image,i-live@@resources@@live@@images@@card@@kep1er@@bubble_gum@@c_l_bubble_gum_dayeon.png,w-200,h-200,fo-face,r-max,lx-44,l-end/live/image.png";
  const currentPfp = user.profile.profilePic || defaultPfp;
  const headerPic = document.getElementById("header-profile-pic");
  const modalPic = document.getElementById("profile-modal-pic");
  if (headerPic) headerPic.src = currentPfp;
  if (modalPic) modalPic.src = currentPfp;
  const setTxt = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
  setTxt("hp-val", (user.hp || 0).toLocaleString());
  setTxt("rp-val", (user.rp || 0).toLocaleString());
  setTxt("diamond-val", (user.diamonds || 0).toLocaleString());
  setTxt("exp-val", (user.exp || 0).toLocaleString());
  setTxt("mileage-val", (user.mileage || 0).toLocaleString());
  setTxt("shop-hp-val", (user.hp || 0).toLocaleString());
  setTxt("shop-rp-val", (user.rp || 0).toLocaleString());
  setTxt("shop-diamond-val", (user.diamonds || 0).toLocaleString());
  const expFill = document.getElementById("exp-fill");
  if (expFill) { const reqExp = (user.level || 1) * 1000; expFill.style.width = `${Math.min(((user.exp || 0) / reqExp) * 100, 100)}%`; }
  setTxt("profile-uid", publicPlayerName());
  setTxt("profile-total-cards", (user.inventory || []).length);
  setTxt("display-uid", publicPlayerName());
  if (user.favoriteCard) {
    const fav = document.getElementById("profile-fav-card");
    if (fav) fav.src = typeof getLargeCardUrl === "function" ? getLargeCardUrl(user.favoriteCard.url, user.favoriteCard.grade, user.favoriteCard.member, user.favoriteCard.theme, user.favoriteCard.group) : user.favoriteCard.url;
  }
  const ref = currentUserDocRef();
  if (ref) {
    const cleanUser = JSON.parse(JSON.stringify(user, (key, value) => value === undefined ? null : value));
    delete cleanUser.passcode; delete cleanUser.password; delete cleanUser.passwordHash;
    cleanUser.authUid = currentUserDocId(); cleanUser.authVersion = 2;
    cleanUser.handle = String(uid || cleanUser.handle || "PLAYER");
    cleanUser.handleKey = normalizeHandleKey(cleanUser.handle);
    ref.set(cleanUser, { merge: true }).catch((e) => console.log("Offline or Sync Error:", e));
    schedulePublicPlayerSync();
  }
}

function completeLogin() {
  localStorage.removeItem("shining_pass");
  const displayUid = document.getElementById("display-uid");
  if (displayUid) displayUid.innerText = publicPlayerName();
  const authScreen = document.getElementById("auth-screen");
  if (authScreen) authScreen.style.display = "none";
  document.getElementById("bgm")?.play().catch(() => console.log("BGM Autoplay blocked"));
  trackMissionProgress("login", 1);
  updateUI(); applyLobbyBackgrounds();
  showToast(`Welcome back, ${publicPlayerName()}!`);
  checkDailyReward(user.lastLogin); checkInboxNoti(); initLobbyBanner();
}

async function saveLegacyPassword() {
  showToast("Legacy password storage is disabled. Use Firebase Authentication.");
  const modal = document.getElementById("setup-password-modal");
  if (modal) modal.style.display = "none";
}

async function logout() {
  try { await auth.signOut(); } catch (_) {}
  authUid = null; uid = undefined;
  localStorage.removeItem("shining_uid");
  localStorage.removeItem("shining_pass");
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
          showToast("Daily Reward: +5,000 RP");
      } else if (today === 2 || today === 5) { 
          user.diamonds += 10;
          showToast("Daily Reward: +10 Diamonds");
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
            return showToast("Inventory is completely full. Sell cards first.");
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
          db.collection("users").doc(currentUserDocId()).update({ inbox: user.inbox, rp: user.rp, hp: user.hp, diamonds: user.diamonds }).catch(err => console.log("Inbox save err:", err));
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
        { id: "ev_starpass", title: "Shining Tour",    tag: "HOT",    banner: "https://jyp.com/800x200/333/fff?text=Shining+Tour", isDirectLink: true, action: "openStarPass" }
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
        { id: "sp1", action: "play",    target: 5,  title: "Tour: Live Shows",  desc: "Clear 5 Live Stages.",  reward: { type: "PassEXP", amt: 50, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp2", action: "pull",    target: 5,  title: "Tour: Collector",   desc: "Open 5 Card Packs.",    reward: { type: "PassEXP", amt: 50, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp3", action: "powerup", target: 3,  title: "Tour: Power Up",    desc: "Power Up 3 cards.",     reward: { type: "PassEXP", amt: 30, icon: "🌟", color: "var(--tertiary-glow)" } },
        { id: "sp4", action: "login",   target: 7,  title: "Tour: Attendance",  desc: "Log in 7 days.",        reward: { type: "PassEXP", amt: 100,icon: "🌟", color: "var(--tertiary-glow)" } }
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
            setTimeout(() => showToast(`SHINING TOUR LEVEL UP · Lv ${user.starPass.level}`), 2500);
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
        db.collection("users").doc(currentUserDocId()).update({ missionProgress: user.missionProgress });
    }
}

