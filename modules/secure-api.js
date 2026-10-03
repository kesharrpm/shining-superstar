/* SHINING SUPERSTAR 6.3 Secure Client Bridge
 * Loaded after the legacy engine modules. It moves authentication and
 * deterministic protected mutations to the Cloudflare Worker while keeping the
 * current UI and function names intact.
 */
(() => {
  const workerBase = (window.SHINING_SECURE_WORKER || (typeof CATALOG_WORKER_BASE !== 'undefined' ? CATALOG_WORKER_BASE : '') || '').replace(/\/$/, '');
  const active = Boolean(workerBase);
  const state = { active, stageToken: null, stageMeta: null, lastError: null };

  async function token() {
    const current = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!current) throw new Error('Please sign in again.');
    return current.getIdToken();
  }

  async function call(path, body = null, method = 'POST') {
    if (!active) throw new Error('Secure Worker URL is not configured.');
    const headers = { 'authorization': `Bearer ${await token()}`, 'x-request-id': crypto.randomUUID() };
    if (body !== null) headers['content-type'] = 'application/json';
    const res = await fetch(`${workerBase}${path}`, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { data = { ok: false, error: `HTTP ${res.status}` }; }
    if (!res.ok || data?.ok === false) {
      const err = new Error(data?.error || `Secure action failed (${res.status})`);
      err.code = data?.code || '';
      err.status = res.status;
      throw err;
    }
    if (data?.player) applyPlayer(data.player);
    return data;
  }

  function applyPlayer(serverPlayer) {
    if (!serverPlayer || typeof serverPlayer !== 'object') return;
    try {
      if (typeof authUid !== 'undefined' && auth?.currentUser?.uid) authUid = auth.currentUser.uid;
      if (typeof uid !== 'undefined') uid = String(serverPlayer.handle || uid || 'PLAYER');
      if (typeof user !== 'undefined') user = { ...user, ...serverPlayer };
      if (typeof updateUI === 'function') updateUI();
      if (typeof checkInboxNoti === 'function') checkInboxNoti();
    } catch (e) { console.warn('[Secure] apply player failed', e); }
  }

  function messageFor(error) {
    if (error?.code === 'CHANCE_FEATURE_COMPAT_ONLY') return 'This chance-based reward stays in compatibility mode and is not handled by the secure Worker.';
    return error?.message || 'Secure action failed.';
  }

  async function run(path, body, after) {
    try {
      const data = await call(path, body);
      if (typeof after === 'function') after(data);
      return data;
    } catch (e) {
      state.lastError = e;
      console.error('[Secure Worker]', e);
      if (typeof showToast === 'function') showToast(messageFor(e));
      throw e;
    }
  }

  // updateUI() may still call currentUserDocRef().set(fullUser). Return a wrapper
  // that writes only the two client-safe cosmetic fields permitted by Firestore rules.
  if (typeof currentUserDocRef === 'function' && typeof db !== 'undefined') {
    currentUserDocRef = function secureSafeUserRef() {
      const id = (typeof currentUserDocId === 'function' ? currentUserDocId() : auth?.currentUser?.uid);
      if (!id) return null;
      const real = db.collection('users').doc(id);
      return {
        set(data) {
          const safe = {};
          if (data?.profile !== undefined) safe.profile = data.profile;
          if (data?.favoriteCard !== undefined) safe.favoriteCard = data.favoriteCard;
          if (!Object.keys(safe).length) return Promise.resolve();
          return real.set(safe, { merge: true });
        }
      };
    };
  }

  // Public leaderboard projection is now written by the Worker, never directly.
  let publicSyncTimer = 0;
  schedulePublicPlayerSync = function securePublicSync() {
    if (!auth?.currentUser || !active) return;
    clearTimeout(publicSyncTimer);
    publicSyncTimer = setTimeout(() => call('/api/player/public-sync', {}).catch(() => {}), 750);
  };

  // ---- Auth V3 ------------------------------------------------------------
  loadAuthenticatedPlayer = async function secureLoadAuthenticatedPlayer(firebaseUser, preferredHandle = '') {
    if (!firebaseUser) return false;
    authUid = firebaseUser.uid;
    let data;
    try { data = await call('/api/player/state', null, 'GET'); }
    catch (e) {
      if (e.status !== 404) throw e;
      data = await call('/api/player/bootstrap', { handle: preferredHandle || localStorage.getItem('shining_uid') || 'PLAYER' });
    }
    if (data?.player) applyPlayer(data.player);
    if (typeof completeLogin === 'function') completeLogin();
    return true;
  };

  handleAuth = async function secureHandleAuth(mode = 'login') {
    const handle = document.getElementById('user-id')?.value.trim() || '';
    const password = document.getElementById('user-pass')?.value || '';
    if (!handle) return showToast?.('Please enter your username / UID.');
    if (!password) return showToast?.('Please enter your password.');
    if (mode === 'register' && password.length < 8) return showToast?.('Use at least 8 characters for new accounts.');
    try {
      if (typeof setAuthPersistence === 'function') await setAuthPersistence();
      const email = await authEmailForHandle(handle);
      let credential;
      if (mode === 'register') credential = await auth.createUserWithEmailAndPassword(email, password);
      else credential = await auth.signInWithEmailAndPassword(email, password);
      authUid = credential.user.uid;
      uid = handle;
      const data = await call('/api/player/bootstrap', { handle });
      applyPlayer(data.player);
      completeLogin?.();
      showToast?.(mode === 'register' ? 'Secure account created.' : `Welcome back, ${handle}!`);
    } catch (e) {
      console.error('[Secure Auth]', e);
      // During the one-time migration window only, the existing legacy bridge may
      // still be used before strict Firestore rules are deployed.
      if (mode === 'login' && ['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(String(e?.code || '')) && window.SHINING_ALLOW_LEGACY_MIGRATION === true && typeof tryLegacyMigration === 'function') {
        try { if (await tryLegacyMigration(handle, password)) return; } catch (migrationError) { e = migrationError; }
      }
      showToast?.(typeof authErrorMessage === 'function' ? authErrorMessage(e, mode) : (e.message || 'Authentication failed.'));
    }
  };

  restoreAuthSession = async function secureRestoreSession() {
    const firebaseUser = await new Promise(resolve => {
      let done = false;
      const stop = auth.onAuthStateChanged(v => { if (done) return; done = true; stop(); resolve(v || null); }, () => { if (!done) { done = true; resolve(null); } });
      setTimeout(() => { if (!done) { done = true; try { stop(); } catch {} resolve(auth.currentUser || null); } }, 8000);
    });
    if (!firebaseUser) return false;
    try { return await loadAuthenticatedPlayer(firebaseUser); }
    catch (e) { console.warn('[Secure Auth] session restore failed', e); await auth.signOut().catch(()=>{}); return false; }
  };

  // Login, pulls, and upgrades are no longer allowed to write mission progress
  // directly from the browser. Login/play progress is credited by trusted routes.
  const legacyTrackMissionProgress = typeof trackMissionProgress === 'function' ? trackMissionProgress : null;
  trackMissionProgress = function secureTrackMissionProgress(actionType, amount = 1, context = {}) {
    if (!active && legacyTrackMissionProgress) return legacyTrackMissionProgress(actionType, amount, context);
    // UI-only group-specific progress remains local; protected rewards still require server validation.
    if (actionType === 'play_group' && user?.missionProgress) return;
  };

  // ---- Deterministic protected economy ------------------------------------
  buyWallpaper = async function secureBuyWallpaper(id) {
    const data = await run('/api/player/wallpaper', { id });
    showToast?.('Background purchased!');
    if (typeof filterBgShop === 'function') filterBgShop(currentShopBgType, document.querySelector('.bg-sub-tab.active'));
    return data;
  };

  executeBuyProfilePic = async function secureBuyProfilePic() {
    if (!pendingPurchasePfpId) return;
    const data = await run('/api/player/profile-purchase', { pfpId: pendingPurchasePfpId });
    document.getElementById('pfp-purchase-modal')?.style && (document.getElementById('pfp-purchase-modal').style.display = 'none');
    showToast?.('Profile image unlocked!');
    renderProfilePics?.();
    return data;
  };

  buyInventorySlots = async function secureInventorySlots() {
    const data = await run('/api/player/inventory-slots', {});
    showToast?.('Inventory expanded by +50 slots!');
    renderSuperstarUI?.();
    return data;
  };

  exchangeRP = async function secureExchangeRP() {
    const data = await run('/api/player/exchange-rp', {});
    showToast?.('Converted 1,000 RP to 5 HP.');
    return data;
  };

  claimCoupon = async function secureCoupon() {
    const el = document.getElementById('coupon-input');
    const code = el?.value.trim().toUpperCase() || '';
    if (!code) return showToast?.('Please enter a code.');
    const data = await run('/api/player/coupon', { code });
    if (el) el.value = '';
    const modal = document.getElementById('coupon-modal'); if (modal) modal.style.display = 'none';
    showToast?.('Coupon claimed securely.');
    return data;
  };

  executeClaimMission = async function secureMissionClaim(tabId, missionId) {
    const data = await run('/api/player/mission/claim', { id: missionId });
    showToast?.('Mission reward claimed.');
    if (typeof switchMissionTab === 'function') switchMissionTab(tabId);
    return data;
  };

  buyPremiumPass = async function securePremiumPass() {
    const data = await run('/api/player/star-pass/purchase', {});
    showToast?.('Premium pass activated.');
    updatePassUI?.();
    return data;
  };

  claimPassReward = async function securePassReward(level, track) {
    const data = await run('/api/player/star-pass/claim', { level, track });
    showToast?.('Pass reward claimed.');
    updatePassUI?.();
    return data;
  };

  claimEventReward = async function secureEventReward(count) {
    const data = await run('/api/player/event/claim', { count });
    showToast?.('Event reward claimed.');
    openEventModal?.();
    return data;
  };

  buyShopItem = async function secureShopItem(item) {
    const data = await run('/api/player/shop-item', { item });
    showToast?.(`${item} purchased.`);
    return data;
  };

  claimDynamicMail = async function secureInboxClaim(mailId) {
    const data = await run('/api/player/inbox/claim', { mailId });
    showToast?.('Inbox item claimed.');
    renderInbox?.();
    return data;
  };

  claimCardBookReward = async function secureCardBookReward(group, theme) {
    const data = await run('/api/player/cardbook/theme-claim', { group, theme });
    showToast?.(`Completed Theme: ${theme}! +50 Diamonds`);
    renderCardBook?.();
    return data;
  };

  toggleLock = async function secureToggleLock(index) {
    const data = await run('/api/player/card/lock', { index });
    renderVault?.(); renderSuperstarUI?.();
    return data;
  };
  toggleLockAndRefresh = async function secureToggleLockRefresh(index) { await toggleLock(index); renderSuperstarUI?.(); };

  scrapCard = async function secureScrapCard(index) {
    if (!confirm('Are you sure you want to sell this card for RP?')) return;
    const data = await run('/api/player/card/sell', { index });
    showToast?.(`Card sold for ${data.result?.rpGain || 0} RP.`);
    renderVault?.();
    return data;
  };
  scrapCardAndClear = async function secureScrapAndClear(index) { await scrapCard(index); closeCardDetail?.(); };

  equipSingleCard = async function secureEquip(index) {
    const data = await run('/api/player/deck', { action: 'equip', index });
    renderSuperstarUI?.(); renderDeck?.(); return data;
  };
  unequipSingleCard = async function secureUnequip(group, member) {
    const data = await run('/api/player/deck', { action: 'unequip', group, member });
    renderSuperstarUI?.(); renderDeck?.(); return data;
  };
  autoEquipSuperstar = async function secureAutoEquipSuperstar() {
    const group = typeof getCurrentSSGroup === 'function' ? getCurrentSSGroup() : '';
    if (!group) return showToast?.('No group selected!');
    const data = await run('/api/player/deck', { action: 'auto', group });
    renderSuperstarUI?.(); renderDeck?.(); return data;
  };
  if (typeof autoEquipDeck === 'function') {
    autoEquipDeck = async function secureAutoEquipDeck() {
      const group = typeof deckGroup !== 'undefined' ? deckGroup : '';
      if (!group) return showToast?.('No group selected!');
      const data = await run('/api/player/deck', { action: 'auto', group });
      renderDeck?.(); return data;
    };
  }

  // ---- Stage integrity -----------------------------------------------------
  const baseLaunch3DStage = typeof launch3DStage === 'function' ? launch3DStage : null;
  if (baseLaunch3DStage) {
    launch3DStage = async function secureLaunchStage(diff) {
      const song = typeof arcadeSongs !== 'undefined' ? arcadeSongs[selectedArcadeSongIndex] : null;
      try {
        const data = await call('/api/player/stage/start', { songId: song?.title || String(selectedArcadeSongIndex), group: song?.group || '', difficulty: diff });
        state.stageToken = data.token; state.stageMeta = { diff, song };
      } catch (e) { showToast?.(messageFor(e)); return; }
      return baseLaunch3DStage(diff);
    };
  }

  const baseShowStreamResults = typeof showStreamResults === 'function' ? showStreamResults : null;
  if (baseShowStreamResults) {
    showStreamResults = function secureShowStreamResults(multiplier, songData, finalScore) {
      baseShowStreamResults(multiplier, songData, finalScore);
      if (!state.stageToken) return;
      const tokenValue = state.stageToken; state.stageToken = null;
      run('/api/player/stage/complete', { token: tokenValue }, data => {
        const r = data.result || {};
        const set = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
        if (Number.isFinite(r.finalScore)) set('result-total-score', Number(r.finalScore).toLocaleString());
        if (Number.isFinite(r.earnedRP)) set('result-rp', r.earnedRP);
        if (Number.isFinite(r.earnedEXP)) set('result-exp', r.earnedEXP);
      }).catch(()=>{});
    };
  }

  // Chance-based card grant/pull/upgrade functions are intentionally not replaced
  // by trusted endpoints. In strict mode Firestore rules prevent those legacy
  // browser mutations from becoming authoritative server state.

  window.ShiningSecure = Object.freeze({
    active, state, call, applyPlayer,
    refresh: () => call('/api/player/state', null, 'GET'),
    publicSync: () => call('/api/player/public-sync', {})
  });
  console.info(`[SHINING Secure] ${active ? 'active' : 'inactive'} · ${workerBase || 'no worker URL'}`);
})();
