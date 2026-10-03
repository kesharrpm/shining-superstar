/* ============================================================
 * SHINING SUPERSTAR 4.2.0 · LUXE CLIENT EXPERIENCE
 * - deterministic gacha reveal / flip
 * - real selector flows (card / wallpaper / profile)
 * - picker-first profile + lobby wallpaper setup
 * - selector mail is no longer converted into random packs
 * ============================================================ */
(() => {
  const $id = (id) => document.getElementById(id);
  const uiEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uiSlug = (value) => String(value ?? '').trim().toLowerCase().replace(/[’']/g,'').replace(/&/g,'and').replace(/\s+/g,'_').replace(/[^a-z0-9_.-]/g,'').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  const label = (value) => String(value ?? '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function saveSelectorState() {
    if (typeof uid !== 'undefined' && uid && typeof db !== 'undefined') {
      db.collection('users').doc(currentUserDocId()).update({
        selectorCredits: user.selectorCredits || {},
        tickets: user.tickets || {},
        inventory: user.inventory || [],
        wallpapers: user.wallpapers || [],
        equippedWallpapers: user.equippedWallpapers || [],
        unlockedPFPs: user.unlockedPFPs || [],
        profile: user.profile || {},
        inbox: user.inbox || []
      }).catch(err => console.log('[Selector Save]', err));
    }
  }

  function ensureCredits() {
    if (!user.selectorCredits || typeof user.selectorCredits !== 'object') user.selectorCredits = {};
    if (!user.selectorCredits.card || typeof user.selectorCredits.card !== 'object') user.selectorCredits.card = {};
    if (!Number.isFinite(Number(user.selectorCredits.wallpaper))) user.selectorCredits.wallpaper = 0;
    if (!Number.isFinite(Number(user.selectorCredits.profile))) user.selectorCredits.profile = 0;
    return user.selectorCredits;
  }

  function addSelectorCredit(kind, amount=1, grade='R') {
    const credits = ensureCredits();
    amount = Math.max(1, Number(amount) || 1);
    if (kind === 'card') {
      grade = String(grade || 'R').toUpperCase();
      credits.card[grade] = Number(credits.card[grade] || 0) + amount;
    } else {
      credits[kind] = Number(credits[kind] || 0) + amount;
    }
    saveSelectorState();
  }

  function selectorCount(kind, grade='R') {
    const credits = ensureCredits();
    return kind === 'card' ? Number(credits.card[String(grade).toUpperCase()] || 0) : Number(credits[kind] || 0);
  }

  function consumeSelector(kind, grade='R') {
    const credits = ensureCredits();
    if (kind === 'card') {
      const g = String(grade).toUpperCase();
      if (Number(credits.card[g] || 0) <= 0) return false;
      credits.card[g]--;
    } else {
      if (Number(credits[kind] || 0) <= 0) return false;
      credits[kind]--;
    }
    saveSelectorState();
    return true;
  }

  function gachaHeader(batch) {
    const overlay = $id('gacha-fullscreen-overlay');
    const header = overlay?.querySelector('.gacha-overlay-header');
    if (!overlay || !header) return;
    const boost = overlay.querySelector('.r-pack-wow-banner');
    let kicker = 'NEW CARDS';
    let title = batch.length <= 3 ? 'PACKAGE REVEAL' : 'CARD OPEN';
    let sub = `${batch.length} card${batch.length === 1 ? '' : 's'} acquired`;
    if (boost) {
      const boostLabel = boost.querySelector('span')?.textContent?.trim();
      const boostName = boost.querySelector('strong')?.textContent?.trim();
      kicker = boostLabel || 'R PACKAGE';
      title = boostName || title;
      sub = 'Tap a revealed card for details';
      boost.remove();
    }
    header.innerHTML = `<span class="draw-kicker">${uiEsc(kicker)}</span><h2>${uiEsc(title)}</h2><p>${uiEsc(sub)}</p>`;
  }

  function playRevealSfx(card) {
    try {
      const audio = card?.grade === 'R' || (typeof isLimitedTheme === 'function' && isLimitedTheme(card.group, card.theme)) ? sfxEpicReveal : card?.grade === 'S' ? sfxRareReveal : null;
      if (audio) { audio.currentTime = 0; audio.volume = Math.min(1, Number(globalSfxVolume ?? .6)); audio.play().catch(() => {}); }
    } catch (_) {}
  }

  async function revealDrawCard(wrapper, card, index) {
    const container = wrapper.querySelector('.card-container');
    if (!container || container.classList.contains('revealed')) return;
    const isLE = typeof isLimitedTheme === 'function' && isLimitedTheme(card.group, card.theme);
    wrapper.classList.add('is-revealing');
    container.classList.toggle('is-r-grade', card.grade === 'R' && !isLE);
    container.classList.toggle('is-le-grade', isLE);
    await sleep(60);
    requestAnimationFrame(() => {
      container.classList.add('reveal', 'revealed');
      wrapper.classList.add('reveal-flare');
    });
    playRevealSfx(card);
    if ((card.grade === 'R' || isLE) && typeof createRGradeBurst === 'function') {
      createRGradeBurst(wrapper);
      if (isLE) setTimeout(() => createRGradeBurst(wrapper), 180);
    }
    await sleep(isLE ? 1050 : card.grade === 'R' ? 820 : 680);
    wrapper.classList.remove('is-revealing');
    wrapper.classList.add('is-revealed');
    setTimeout(() => wrapper.classList.remove('reveal-flare'), 700);
  }

  window.renderGachaBatch = renderGachaBatch = async function renderGachaBatchV420() {
    const overlay = $id('gacha-fullscreen-overlay');
    const drawGrid = $id('draw-stage-cards');
    const nextBtn = $id('gacha-next-btn');
    const finishBtn = $id('gacha-finish-btn');
    if (!overlay || !drawGrid) return;

    drawGrid.innerHTML = '';
    if (nextBtn) nextBtn.style.display = 'none';
    if (finishBtn) finishBtn.style.display = 'none';

    const batchSize = 10;
    const startIndex = currentGachaBatchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, fullPulledCardList.length);
    const batch = fullPulledCardList.slice(startIndex, endIndex);
    overlay.classList.toggle('gacha-small-batch', batch.length <= 3);
    overlay.classList.toggle('gacha-single-batch', batch.length === 1);
    gachaHeader(batch);

    batch.forEach((card, index) => {
      const wrapper = document.createElement('div');
      const isLE = typeof isLimitedTheme === 'function' && isLimitedTheme(card.group, card.theme);
      const rawPhotoUrl = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;
      wrapper.className = `card-wrapper draw-card-shell draw-grade-${String(card.grade || 'C').toLowerCase()}${isLE ? ' draw-limited' : ''}`;
      wrapper.dataset.index = String(index);
      wrapper.innerHTML = `
        <div class="draw-card-aura"></div>
        <div class="card-container">
          <div class="card-face card-back"><span class="draw-back-mark">✦</span></div>
          <div class="card-face card-front">
            <img src="${uiEsc(rawPhotoUrl)}" alt="${uiEsc(card.member)} · ${uiEsc(card.theme)}" draggable="false">
            ${isLE ? '<div class="draw-le-glass"></div>' : ''}
            <div class="draw-card-meta"><b>${uiEsc(card.grade)}</b><span>${uiEsc(card.member)}</span><small>${uiEsc(card.theme)}</small></div>
          </div>
        </div>`;
      wrapper.addEventListener('click', () => {
        const container = wrapper.querySelector('.card-container');
        if (!container.classList.contains('revealed')) revealDrawCard(wrapper, card, index);
        else if (typeof inspectGachaCard === 'function') inspectGachaCard(card);
      });
      drawGrid.appendChild(wrapper);
    });

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const wrappers = [...drawGrid.querySelectorAll('.draw-card-shell')];
    wrappers.forEach((wrapper, i) => setTimeout(() => wrapper.classList.add('show'), i * 70));
    await sleep(420);

    for (let i = 0; i < wrappers.length; i++) {
      await revealDrawCard(wrappers[i], batch[i], i);
      await sleep(batch.length <= 3 ? 130 : 55);
    }

    const isLastBatch = (currentGachaBatchIndex + 1) * batchSize >= fullPulledCardList.length;
    const btn = isLastBatch ? finishBtn : nextBtn;
    if (btn) {
      btn.textContent = isLastBatch ? 'COLLECT' : 'NEXT SET';
      btn.style.display = 'inline-flex';
      requestAnimationFrame(() => btn.classList.add('draw-action-ready'));
    }
  };

  // -------------------- Picker shell --------------------
  const pickerState = { kind: null, grade: 'R', group: null, theme: null, selected: null, legacyTicket: false };

  function ensureUniversalPicker() {
    let modal = $id('universal-selector-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'universal-selector-modal';
    modal.className = 'custom-modal-overlay selector-studio-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `<div class="custom-modal selector-studio">
      <header class="selector-studio-head">
        <div><span id="selector-studio-kicker">SELECTOR</span><h2 id="selector-studio-title">Choose</h2><p id="selector-studio-sub">Select an item to continue.</p></div>
        <button class="close-btn selector-close" type="button">×</button>
      </header>
      <div class="selector-step-rail" id="selector-step-rail"></div>
      <div class="selector-toolbar"><button id="selector-back-btn" class="selector-back-btn" type="button">‹ Back</button><div class="selector-search-wrap"><span>⌕</span><input id="selector-search" autocomplete="off" placeholder="Search"></div><span class="selector-credit" id="selector-credit"></span></div>
      <main id="selector-studio-body" class="selector-studio-body"></main>
      <footer id="selector-studio-footer" class="selector-studio-footer"></footer>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.selector-close').onclick = () => { modal.style.display = 'none'; };
    $id('selector-back-btn').onclick = selectorBack;
    $id('selector-search').addEventListener('input', renderSelectorStep);
    return modal;
  }

  function pickerGroups(kind) {
    if (kind === 'profile') return [...new Set((profilePicDatabase || []).map(p => p.groupName || p.group).filter(Boolean))].sort();
    if (kind === 'wallpaper') return [...new Set((wallpaperDatabase || []).map(w => w.group).filter(Boolean))].sort();
    return Object.keys(themeDatabase || {}).sort();
  }

  function groupSubtitle(kind, group) {
    if (kind === 'profile') return `${(profilePicDatabase || []).filter(p => (p.groupName || p.group) === group || p.group === String(group).toUpperCase()).length} profile looks`;
    if (kind === 'wallpaper') return `${(wallpaperDatabase || []).filter(w => w.group === group).length} wallpapers`;
    const info = themeDatabase?.[group] || {};
    return `${(info.members || []).length} members · ${[...(info.themes || []), ...(info.le_themes || [])].length} themes`;
  }

  function pickerGroupCard(group) {
    return `<button class="selector-group-card" data-pick-group="${uiEsc(group)}"><span>${uiEsc(group).slice(0,2).toUpperCase()}</span><div><strong>${uiEsc(group)}</strong><small>${uiEsc(groupSubtitle(pickerState.kind, group))}</small></div><i>›</i></button>`;
  }

  function renderSelectorGroupStep() {
    const body = $id('selector-studio-body');
    const q = ($id('selector-search')?.value || '').trim().toLowerCase();
    const groups = pickerGroups(pickerState.kind).filter(g => !q || String(g).toLowerCase().includes(q));
    body.innerHTML = groups.length ? `<div class="selector-group-grid">${groups.map(pickerGroupCard).join('')}</div>` : `<div class="selector-empty">No groups match your search.</div>`;
    body.querySelectorAll('[data-pick-group]').forEach(btn => btn.onclick = () => {
      pickerState.group = btn.dataset.pickGroup;
      pickerState.theme = null;
      pickerState.selected = null;
      $id('selector-search').value = '';
      renderSelectorStep();
    });
  }

  function renderCardThemeStep() {
    const body = $id('selector-studio-body');
    const info = themeDatabase?.[pickerState.group] || {};
    const q = ($id('selector-search')?.value || '').trim().toLowerCase();
    const normal = (info.themes || []).map(theme => ({theme, le:false}));
    const limited = (info.le_themes || []).map(theme => ({theme, le:true}));
    const themes = [...normal, ...limited].filter(t => !q || t.theme.toLowerCase().includes(q));
    body.innerHTML = themes.length ? `<div class="selector-theme-grid">${themes.map(({theme,le}) => {
      const members = (info.members || []).slice(0,3);
      const mini = members.map(m => `<img src="${uiEsc(typeof getSmallCardUrl === 'function' ? getSmallCardUrl('dynamic', pickerState.grade, m, theme, pickerState.group) : '')}" alt="">`).join('');
      return `<button class="selector-theme-card ${le?'limited':''}" data-pick-theme="${uiEsc(theme)}"><div class="selector-theme-preview">${mini}</div><div><span>${le?'LIMITED':'THEME'}</span><strong>${uiEsc(theme)}</strong><small>${(info.members || []).length} selectable members</small></div><i>›</i></button>`;
    }).join('')}</div>` : `<div class="selector-empty">No themes found.</div>`;
    body.querySelectorAll('[data-pick-theme]').forEach(btn => btn.onclick = () => { pickerState.theme = btn.dataset.pickTheme; pickerState.selected = null; $id('selector-search').value=''; renderSelectorStep(); });
  }

  function renderCardMemberStep() {
    const body = $id('selector-studio-body');
    const info = themeDatabase?.[pickerState.group] || {};
    const q = ($id('selector-search')?.value || '').trim().toLowerCase();
    const members = (info.members || []).filter(m => !q || String(m).toLowerCase().includes(q));
    body.innerHTML = `<div class="selector-card-grid">${members.map(member => {
      const src = typeof getLargeCardUrl === 'function' ? getLargeCardUrl('dynamic', pickerState.grade, member, pickerState.theme, pickerState.group) : '';
      return `<button class="selector-real-card" data-member="${uiEsc(member)}"><div class="selector-card-image"><img src="${uiEsc(src)}" alt="${uiEsc(member)}"></div><span>${uiEsc(pickerState.grade)} GRADE</span><strong>${uiEsc(member)}</strong><small>${uiEsc(pickerState.theme)}</small></button>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-member]').forEach(btn => btn.onclick = () => {
      body.querySelectorAll('.selector-real-card').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      pickerState.selected = { member: btn.dataset.member };
      renderSelectorFooter();
    });
  }

  function renderWallpaperItems(selectorMode=true) {
    const body = $id('selector-studio-body');
    const q = ($id('selector-search')?.value || '').trim().toLowerCase();
    let items = (wallpaperDatabase || []).filter(w => w.group === pickerState.group);
    if (!selectorMode) items = items.filter(w => (user.wallpapers || []).includes(w.id));
    items = items.filter(w => !q || String(w.name || '').toLowerCase().includes(q));
    body.innerHTML = items.length ? `<div class="selector-wallpaper-grid">${items.map(w => {
      const owned = (user.wallpapers || []).includes(w.id);
      const active = (user.equippedWallpapers || []).includes(w.id);
      return `<button class="selector-wallpaper-card ${active?'active':''}" data-wallpaper-id="${uiEsc(w.id)}"><div class="selector-wallpaper-media"><img src="${uiEsc(w.url || '')}" alt="${uiEsc(w.name)}"></div><div><span>${selectorMode?(owned?'OWNED':'SELECTABLE'):(active?'IN ROTATION':'OWNED')}</span><strong>${uiEsc(w.name)}</strong><small>${uiEsc(w.group)}</small></div><i>${active?'✓':'›'}</i></button>`;
    }).join('')}</div>` : `<div class="selector-empty">No wallpapers found for this group.</div>`;
    body.querySelectorAll('[data-wallpaper-id]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.wallpaperId;
      if (selectorMode) {
        body.querySelectorAll('.selector-wallpaper-card').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected'); pickerState.selected = {id}; renderSelectorFooter();
      } else if (typeof toggleWallpaperEquip === 'function') {
        toggleWallpaperEquip(id); renderWallpaperItems(false);
      }
    });
  }

  function renderProfileItems(selectorMode=true) {
    const body = $id('selector-studio-body');
    const q = ($id('selector-search')?.value || '').trim().toLowerCase();
    let items = (profilePicDatabase || []).filter(p => (p.groupName || p.group) === pickerState.group || p.group === String(pickerState.group).toUpperCase());
    if (!selectorMode) items = items.filter(p => !q || `${p.member} ${p.theme}`.toLowerCase().includes(q));
    else items = items.filter(p => !q || `${p.member} ${p.theme}`.toLowerCase().includes(q));
    body.innerHTML = items.length ? `<div class="selector-profile-grid">${items.map(p => {
      const src = typeof getCatalogProfilePicUrl === 'function' ? getCatalogProfilePicUrl(p.groupName || p.group, p.member, p.theme) : getProfilePicUrl(p.basePath);
      const owned = p.type === 'FREE' || (user.unlockedPFPs || []).includes(p.id);
      const equipped = user.profile?.profilePic === src;
      return `<button class="selector-profile-card ${equipped?'active':''}" data-pfp-id="${uiEsc(p.id)}"><div class="selector-profile-media"><img src="${uiEsc(src)}" alt="${uiEsc(p.member)}"></div><span>${selectorMode?(owned?'OWNED':'SELECTABLE'):(equipped?'EQUIPPED':owned?'OWNED':p.type)}</span><strong>${uiEsc(p.member)}</strong><small>${uiEsc(p.theme)}</small></button>`;
    }).join('')}</div>` : `<div class="selector-empty">No profiles found for this group.</div>`;
    body.querySelectorAll('[data-pfp-id]').forEach(btn => btn.onclick = () => {
      const p = (profilePicDatabase || []).find(x => x.id === btn.dataset.pfpId);
      if (!p) return;
      const src = typeof getCatalogProfilePicUrl === 'function' ? getCatalogProfilePicUrl(p.groupName || p.group, p.member, p.theme) : getProfilePicUrl(p.basePath);
      if (selectorMode) {
        body.querySelectorAll('.selector-profile-card').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected'); pickerState.selected = {id:p.id, src, member:p.member}; renderSelectorFooter();
      } else {
        const owned = p.type === 'FREE' || (user.unlockedPFPs || []).includes(p.id);
        if (owned && typeof confirmProfilePic === 'function') confirmProfilePic(src, p.member);
        else if (p.type === 'BASIC' && typeof confirmBuyProfilePic === 'function') confirmBuyProfilePic(p.id, p.member, src);
        else if (typeof showToast === 'function') showToast('Event profile. Unlock it from its event package or selector.');
      }
    });
  }

  function renderSelectorFooter() {
    const footer = $id('selector-studio-footer');
    if (!footer) return;
    if (!pickerState.selected) { footer.innerHTML = '<span>Select an item to continue.</span>'; return; }
    footer.innerHTML = `<div><span>Selection ready</span><strong>${pickerState.kind === 'card' ? `${uiEsc(pickerState.group)} · ${uiEsc(pickerState.theme)} · ${uiEsc(pickerState.selected.member)}` : pickerState.kind === 'wallpaper' ? 'Wallpaper selected' : `${uiEsc(pickerState.selected.member || 'Profile')} selected`}</strong></div><button class="selector-confirm-btn" type="button">CONFIRM SELECTION <i>→</i></button>`;
    footer.querySelector('.selector-confirm-btn').onclick = confirmSelectorChoice;
  }

  function selectorBack() {
    pickerState.selected = null;
    if (pickerState.kind === 'card' && pickerState.theme) pickerState.theme = null;
    else if (pickerState.group) pickerState.group = null;
    else { $id('universal-selector-modal').style.display='none'; return; }
    $id('selector-search').value='';
    renderSelectorStep();
  }

  function selectorStepName() {
    if (!pickerState.group) return 'GROUP';
    if (pickerState.kind === 'card' && !pickerState.theme) return 'THEME';
    return pickerState.kind === 'card' ? 'MEMBER' : pickerState.kind.toUpperCase();
  }

  function renderSelectorStep() {
    const modal = ensureUniversalPicker();
    const step = selectorStepName();
    const kindName = pickerState.kind === 'card' ? `${pickerState.grade} CARD SELECTOR` : `${pickerState.kind.toUpperCase()} SELECTOR`;
    $id('selector-studio-kicker').textContent = kindName;
    $id('selector-studio-title').textContent = !pickerState.group ? 'Choose a group' : pickerState.kind === 'card' && !pickerState.theme ? pickerState.group : pickerState.kind === 'card' ? pickerState.theme : pickerState.group;
    $id('selector-studio-sub').textContent = step === 'GROUP' ? 'Start with the artist or group.' : step === 'THEME' ? 'Choose the exact theme you want.' : pickerState.kind === 'card' ? `Choose a ${pickerState.grade}-grade member card.` : `Choose the exact ${pickerState.kind} you want.`;
    $id('selector-step-rail').innerHTML = ['GROUP', ...(pickerState.kind==='card'?['THEME','MEMBER']:[pickerState.kind.toUpperCase()])].map(s => `<span class="${s===step?'active':''}">${s}</span>`).join('<i>›</i>');
    $id('selector-back-btn').style.visibility = pickerState.group ? 'visible' : 'hidden';
    $id('selector-search').placeholder = `Search ${step.toLowerCase()}…`;
    $id('selector-credit').textContent = `${selectorCount(pickerState.kind, pickerState.grade)} available`;
    renderSelectorFooter();
    if (!pickerState.group) renderSelectorGroupStep();
    else if (pickerState.kind === 'card' && !pickerState.theme) renderCardThemeStep();
    else if (pickerState.kind === 'card') renderCardMemberStep();
    else if (pickerState.kind === 'wallpaper') renderWallpaperItems(true);
    else renderProfileItems(true);
    modal.style.display='flex';
  }

  function openSelector(kind, grade='R', options={}) {
    if (selectorCount(kind, grade) <= 0 && !options.legacyTicket) {
      if (typeof showToast === 'function') showToast(`No ${kind} selector available.`);
      return;
    }
    pickerState.kind = kind;
    pickerState.grade = String(grade || 'R').toUpperCase();
    pickerState.group = null; pickerState.theme = null; pickerState.selected = null;
    pickerState.legacyTicket = !!options.legacyTicket;
    ensureUniversalPicker();
    $id('selector-search').value='';
    renderSelectorStep();
  }
  window.openSelector = openSelector;

  function confirmSelectorChoice() {
    if (!pickerState.selected) return;
    let consumed = false;
    if (pickerState.legacyTicket && pickerState.kind === 'card') {
      if (Number(user.tickets?.cardSelector || 0) <= 0) return showToast('No legacy Card Selector Ticket available.');
      user.tickets.cardSelector--; consumed = true;
    } else consumed = consumeSelector(pickerState.kind, pickerState.grade);
    if (!consumed) return showToast('Selector credit is no longer available.');

    if (pickerState.kind === 'card') {
      const card = typeof generateDynamicCard === 'function' ? generateDynamicCard(pickerState.group, pickerState.selected.member, pickerState.theme, pickerState.grade) : {group:pickerState.group, member:pickerState.selected.member, theme:pickerState.theme, grade:pickerState.grade, level:1, locked:false, url:'dynamic'};
      if (!user.inventory) user.inventory=[];
      if (typeof getUsedInventorySlots === 'function' && typeof getMaxInventorySlots === 'function' && getUsedInventorySlots() >= getMaxInventorySlots()) {
        if (!user.inbox) user.inbox=[];
        user.inbox.push({id:`selector_${Date.now()}`,title:'Selector Overflow Card',type:'overflow_cards',cards:[card],amount:1});
        showToast('Inventory full. Selected card was sent to Inbox.');
      } else {
        user.inventory.push(card);
        showToast(`${pickerState.grade} ${pickerState.selected.member} · ${pickerState.theme} added to Inventory.`);
      }
    } else if (pickerState.kind === 'wallpaper') {
      if (!user.wallpapers) user.wallpapers=[];
      if (!user.wallpapers.includes(pickerState.selected.id)) user.wallpapers.push(pickerState.selected.id);
      if (!user.equippedWallpapers) user.equippedWallpapers=[];
      if (!user.equippedWallpapers.includes(pickerState.selected.id)) user.equippedWallpapers=[pickerState.selected.id, ...user.equippedWallpapers].slice(0,25);
      if (typeof applyLobbyBackgrounds === 'function') applyLobbyBackgrounds();
      showToast('Wallpaper unlocked and added to Lobby rotation.');
    } else if (pickerState.kind === 'profile') {
      const p = (profilePicDatabase || []).find(x => x.id === pickerState.selected.id);
      if (!user.unlockedPFPs) user.unlockedPFPs=[];
      if (p && !user.unlockedPFPs.includes(p.id)) user.unlockedPFPs.push(p.id);
      if (!user.profile) user.profile={};
      user.profile.profilePic = pickerState.selected.src;
      showToast(`${pickerState.selected.member || 'Profile'} unlocked and equipped.`);
    }
    saveSelectorState();
    if (typeof updateUI === 'function') updateUI();
    $id('universal-selector-modal').style.display='none';
  }

  // Selector mails are real selectors, not random-card packs.
  const baseRewardDisplay = typeof getRewardDisplayStr === 'function' ? getRewardDisplayStr : null;
  if (baseRewardDisplay) window.getRewardDisplayStr = getRewardDisplayStr = function(mail) {
    if (mail?.type === 'selector') {
      const amount = Number(mail.amount || 1);
      const name = mail.selectorType === 'card' ? `${String(mail.grade || 'R').toUpperCase()} Card Selector` : `${label(mail.selectorType)} Selector`;
      return `SELECTOR · ${name} ×${amount}`;
    }
    return baseRewardDisplay(mail);
  };

  const baseClaimMail = typeof claimDynamicMail === 'function' ? claimDynamicMail : null;
  if (baseClaimMail) window.claimDynamicMail = claimDynamicMail = async function(mailId) {
    const index = (user.inbox || []).findIndex(m => m.id == mailId);
    const mail = index >= 0 ? user.inbox[index] : null;
    if (!mail || mail.type !== 'selector') return baseClaimMail.apply(this, arguments);
    const kind = mail.selectorType || 'card';
    const grade = String(mail.grade || 'R').toUpperCase();
    addSelectorCredit(kind, Number(mail.amount || 1), grade);
    user.inbox.splice(index,1);
    saveSelectorState();
    if (typeof renderInbox === 'function') renderInbox();
    if (typeof updateUI === 'function') updateUI();
    openSelector(kind, grade);
  };

  // Legacy card selector tickets now open the real picker.
  window.useCardSelectorTicket = useCardSelectorTicket = function() {
    if (Number(user.tickets?.cardSelector || 0) <= 0) return showToast('No Card Selector Ticket available.');
    openSelector('card', 'R', {legacyTicket:true});
  };

  // Intercept launch-event selector deals so they grant selector mail.
  const baseGrandDeal = typeof window.buyGrandOpeningDeal === 'function' ? window.buyGrandOpeningDeal : null;
  function selectorDeal(kind) {
    const map = {
      selector_r: {currency:'diamond', cost:600, selectorType:'card', grade:'R', amount:1, title:'Grand Opening R Selector'},
      selector_s2:{currency:'diamond', cost:420, selectorType:'card', grade:'S', amount:2, title:'Grand Opening S Selector Duo'},
      selector_a3:{currency:'diamond', cost:240, selectorType:'card', grade:'A', amount:3, title:'Grand Opening A Selector Trio'},
      wallpaper_ticket:{currency:'rp', cost:80000, selectorType:'wallpaper', amount:1, title:'Grand Opening Wallpaper Selector'},
      profile_selector:{currency:'diamond', cost:180, selectorType:'profile', amount:1, title:'Grand Opening Profile Selector'}
    };
    const deal=map[kind]; if(!deal) return false;
    const key=deal.currency==='rp'?'rp':'diamonds';
    if(Number(user[key]||0)<deal.cost){showToast(`Not enough ${deal.currency==='rp'?'RP':'Diamonds'}.`);return true;}
    user[key]-=deal.cost; if(!user.inbox)user.inbox=[];
    user.inbox.push({id:`selector_mail_${Date.now()}_${Math.random().toString(36).slice(2)}`,title:deal.title,type:'selector',selectorType:deal.selectorType,grade:deal.grade,amount:deal.amount});
    saveSelectorState(); updateUI(); if(typeof checkInboxNoti==='function')checkInboxNoti();
    showToast(`${deal.title} sent to Inbox.`); return true;
  }
  if (baseGrandDeal) window.buyGrandOpeningDeal = function(kind) { if (selectorDeal(kind)) return; return baseGrandDeal.apply(this, arguments); };

  function injectProfileSelectorDeal() {
    const grid = document.querySelector('.grand-deal-grid-v5');
    if (!grid || grid.querySelector('[data-profile-selector-deal]')) return;
    const card = document.createElement('div');
    card.className='grand-deal-card selector profile-selector-deal'; card.dataset.profileSelectorDeal='1';
    card.innerHTML='<small>Selector</small><strong>Profile Selector</strong><p>Choose an exact group, member, and profile theme.</p><button class="btn btn-draw" onclick="buyGrandOpeningDeal(\'profile_selector\')">DIAMOND 180</button>';
    grid.appendChild(card);
  }
  const shopObserver = new MutationObserver(() => injectProfileSelectorDeal());
  document.addEventListener('DOMContentLoaded', () => { injectProfileSelectorDeal(); const shop=$id('shop-modal'); if(shop)shopObserver.observe(shop,{childList:true,subtree:true}); });
  setTimeout(injectProfileSelectorDeal, 1800);

  // -------------------- Normal Profile picker --------------------
  function ensureProfilePickerShell() {
    const modal=$id('profile-pic-modal'); const shell=modal?.querySelector('.custom-modal'); if(!shell)return null;
    if(shell.classList.contains('profile-picker-v6'))return shell;
    shell.classList.add('profile-picker-v6');
    shell.innerHTML=`<header class="asset-picker-head"><div><span>MY PROFILE</span><h2>Profile Atelier</h2><p>Choose a group, then the exact member look.</p></div><button class="close-btn" type="button">×</button></header><div class="asset-picker-toolbar"><button id="pfp-picker-back" class="selector-back-btn" type="button">‹ Groups</button><div class="selector-search-wrap"><span>⌕</span><input id="pfp-picker-search" placeholder="Search groups…"></div></div><div id="pfp-picker-body" class="asset-picker-body"></div>`;
    shell.querySelector('.close-btn').onclick=()=>modal.style.display='none';
    $id('pfp-picker-back').onclick=()=>{ currentPfpFilterGroup='ALL'; renderProfileGroupPicker(); };
    $id('pfp-picker-search').addEventListener('input',()=> currentPfpFilterGroup==='ALL'?renderProfileGroupPicker():renderProfileAssetPicker(currentPfpFilterGroup));
    return shell;
  }
  function renderProfileGroupPicker(){
    pickerState.kind='profile';
    ensureProfilePickerShell(); const body=$id('pfp-picker-body'); const q=($id('pfp-picker-search')?.value||'').toLowerCase();
    const groups=[...new Set((profilePicDatabase||[]).map(p=>p.groupName||p.group).filter(Boolean))].sort().filter(g=>!q||String(g).toLowerCase().includes(q));
    $id('pfp-picker-back').style.visibility='hidden'; $id('pfp-picker-search').placeholder='Search groups…';
    body.innerHTML=`<div class="selector-group-grid">${groups.map(pickerGroupCard).join('')}</div>`;
    body.querySelectorAll('[data-pick-group]').forEach(btn=>btn.onclick=()=>{currentPfpFilterGroup=btn.dataset.pickGroup;$id('pfp-picker-search').value='';renderProfileAssetPicker(currentPfpFilterGroup);});
  }
  function renderProfileAssetPicker(group){
    const body=$id('pfp-picker-body'); const q=($id('pfp-picker-search')?.value||'').toLowerCase();
    $id('pfp-picker-back').style.visibility='visible'; $id('pfp-picker-search').placeholder='Search member or theme…';
    let items=(profilePicDatabase||[]).filter(p=>(p.groupName||p.group)===group||p.group===String(group).toUpperCase()).filter(p=>!q||`${p.member} ${p.theme}`.toLowerCase().includes(q));
    body.innerHTML=`<div class="profile-atelier-grid">${items.map(p=>{
      const src=typeof getCatalogProfilePicUrl==='function'?getCatalogProfilePicUrl(p.groupName||p.group,p.member,p.theme):getProfilePicUrl(p.basePath); const owned=p.type==='FREE'||(user.unlockedPFPs||[]).includes(p.id); const equipped=user.profile?.profilePic===src;
      return `<button class="profile-atelier-card ${equipped?'active':''}" data-id="${uiEsc(p.id)}"><div><img src="${uiEsc(src)}" alt="${uiEsc(p.member)}"></div><span>${equipped?'EQUIPPED':owned?'OWNED':p.type}</span><strong>${uiEsc(p.member)}</strong><small>${uiEsc(p.theme)}</small></button>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>{const p=(profilePicDatabase||[]).find(x=>x.id===btn.dataset.id);if(!p)return;const src=typeof getCatalogProfilePicUrl==='function'?getCatalogProfilePicUrl(p.groupName||p.group,p.member,p.theme):getProfilePicUrl(p.basePath);const owned=p.type==='FREE'||(user.unlockedPFPs||[]).includes(p.id);if(owned)confirmProfilePic(src,p.member);else if(p.type==='BASIC')confirmBuyProfilePic(p.id,p.member,src);else showToast('Event-exclusive profile. Use its event package or a Profile Selector.');});
  }
  window.openProfilePicModal = openProfilePicModal = function(){ ensureProfilePickerShell(); currentPfpFilterGroup='ALL'; const modal=$id('profile-pic-modal'); modal.style.display='flex'; $id('pfp-picker-search').value=''; renderProfileGroupPicker(); };

  // -------------------- Normal Lobby wallpaper picker --------------------
  let lobbyPickerGroup=null;
  function ensureLobbyPickerShell(){
    const modal=$id('bg-equip-modal');const shell=modal?.querySelector('.custom-modal');if(!shell)return null;if(shell.classList.contains('lobby-picker-v6'))return shell;
    shell.classList.add('lobby-picker-v6');shell.innerHTML=`<header class="asset-picker-head"><div><span>LOBBY</span><h2>Wallpaper Gallery</h2><p>Choose a group, then build your rotating lobby set.</p></div><button class="close-btn" type="button">×</button></header><div class="asset-picker-toolbar"><button id="lobby-picker-back" class="selector-back-btn" type="button">‹ Groups</button><div class="selector-search-wrap"><span>⌕</span><input id="lobby-picker-search" placeholder="Search groups…"></div><span class="lobby-equip-counter"><b id="bg-equip-count">0</b>/25</span></div><select id="equip-bg-group-select" hidden><option value="ALL">ALL</option></select><div id="inventory-wallpaper-grid" class="asset-picker-body"></div>`;
    shell.querySelector('.close-btn').onclick=()=>modal.style.display='none';$id('lobby-picker-back').onclick=()=>{lobbyPickerGroup=null;renderLobbyGroupPicker();};$id('lobby-picker-search').addEventListener('input',()=>lobbyPickerGroup?renderLobbyWallpaperPicker(lobbyPickerGroup):renderLobbyGroupPicker());return shell;
  }
  function ownedWallpaperGroups(){return [...new Set((wallpaperDatabase||[]).filter(w=>(user.wallpapers||[]).includes(w.id)).map(w=>w.group).filter(Boolean))].sort();}
  function renderLobbyGroupPicker(){pickerState.kind='wallpaper';ensureLobbyPickerShell();const grid=$id('inventory-wallpaper-grid');const q=($id('lobby-picker-search')?.value||'').toLowerCase();$id('lobby-picker-back').style.visibility='hidden';$id('lobby-picker-search').placeholder='Search owned wallpaper groups…';$id('bg-equip-count').textContent=(user.equippedWallpapers||[]).length;const groups=ownedWallpaperGroups().filter(g=>!q||g.toLowerCase().includes(q));grid.innerHTML=`<div class="selector-group-grid">${groups.map(pickerGroupCard).join('')}</div>`;grid.querySelectorAll('[data-pick-group]').forEach(btn=>btn.onclick=()=>{lobbyPickerGroup=btn.dataset.pickGroup;$id('lobby-picker-search').value='';renderLobbyWallpaperPicker(lobbyPickerGroup);});}
  function renderLobbyWallpaperPicker(group){
    ensureLobbyPickerShell();
    const grid=$id('inventory-wallpaper-grid');
    const q=($id('lobby-picker-search')?.value||'').toLowerCase();
    $id('lobby-picker-back').style.visibility='visible';
    $id('lobby-picker-search').placeholder='Search wallpapers…';
    $id('bg-equip-count').textContent=(user.equippedWallpapers||[]).length;
    let items=(wallpaperDatabase||[]).filter(w=>w.group===group&&(user.wallpapers||[]).includes(w.id)).filter(w=>!q||String(w.name||'').toLowerCase().includes(q));
    grid.innerHTML=items.length?`<div class="selector-wallpaper-grid">${items.map(w=>{const active=(user.equippedWallpapers||[]).includes(w.id);return `<button class="selector-wallpaper-card ${active?'active':''}" data-wallpaper-id="${uiEsc(w.id)}"><div class="selector-wallpaper-media"><img src="${uiEsc(w.url||'')}" alt="${uiEsc(w.name)}"></div><span>${active?'IN ROTATION':'OWNED'}</span><strong>${uiEsc(w.name)}</strong><small>${uiEsc(w.group)}</small><i>${active?'✓':'›'}</i></button>`}).join('')}</div>`:`<div class="selector-empty">No owned wallpapers found for this group.</div>`;
    grid.querySelectorAll('[data-wallpaper-id]').forEach(btn=>btn.onclick=()=>{if(typeof toggleWallpaperEquip==='function'){toggleWallpaperEquip(btn.dataset.wallpaperId);setTimeout(()=>renderLobbyWallpaperPicker(group),0);}});
  }
  window.openBgEquipModal = openBgEquipModal = function(){ensureLobbyPickerShell();lobbyPickerGroup=null;const modal=$id('bg-equip-modal');modal.style.display='flex';$id('lobby-picker-search').value='';renderLobbyGroupPicker();};
  const baseToggleWallpaper=typeof toggleWallpaperEquip==='function'?toggleWallpaperEquip:null;
  if(baseToggleWallpaper) window.toggleWallpaperEquip=toggleWallpaperEquip=function(id){const result=baseToggleWallpaper.apply(this,arguments);if($id('bg-equip-modal')?.style.display==='flex'&&lobbyPickerGroup)setTimeout(()=>renderLobbyWallpaperPicker(lobbyPickerGroup),0);return result;};

  // Remove web-only clutter from My Info. Keep the actions players actually use.
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.mi-wallpaper-actions button').forEach(btn=>{if(/SAVE IMAGE/i.test(btn.textContent||''))btn.remove();});
    ensureUniversalPicker();
  });

  // Keep the old card-selector modal from flashing if a legacy button targets it directly.
  const oldSelector=$id('card-selector-modal'); if(oldSelector) oldSelector.style.display='none';
})();


/* ============================================================
 * SHINING SUPERSTAR 4.3.0 · FOUNDATION PASS
 * Stability + real reveal theater + collection studio cleanup.
 * Catalog/API architecture intentionally unchanged.
 * ============================================================ */
(() => {
  const byId = (id) => document.getElementById(id);
  const esc430 = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wait430 = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ---------- REVEAL THEATER ----------
  const reveal430 = { batch: [], wrappers: [], revealed: 0, busy: false, complete: false };

  function isLE430(card) {
    try { return typeof isLimitedTheme === 'function' && isLimitedTheme(card.group, card.theme); }
    catch (_) { return false; }
  }

  function revealSound430(card) {
    try {
      const le = isLE430(card);
      const audio = (card?.grade === 'R' || le) ? sfxEpicReveal : card?.grade === 'S' ? sfxRareReveal : null;
      if (audio) {
        audio.currentTime = 0;
        audio.volume = Math.min(1, Number(typeof globalSfxVolume !== 'undefined' ? globalSfxVolume : .55));
        audio.play().catch(() => {});
      }
    } catch (_) {}
  }

  function updateReveal430() {
    const overlay = byId('gacha-fullscreen-overlay');
    const counter = overlay?.querySelector('[data-reveal-counter]');
    const progress = overlay?.querySelector('[data-reveal-progress]');
    if (counter) counter.textContent = `${reveal430.revealed} / ${reveal430.batch.length}`;
    if (progress) progress.style.width = `${reveal430.batch.length ? (reveal430.revealed / reveal430.batch.length) * 100 : 0}%`;
  }

  function setRevealAction430() {
    const finish = byId('gacha-finish-btn');
    const next = byId('gacha-next-btn');
    if (next) next.style.display = 'none';
    if (!finish) return;
    finish.classList.remove('draw-action-ready');
    finish.style.display = 'inline-flex';
    if (!reveal430.complete) {
      finish.textContent = reveal430.revealed ? `REVEAL REST · ${reveal430.batch.length - reveal430.revealed}` : 'REVEAL ALL';
      finish.onclick = () => revealAll430();
    } else {
      const isLast = (currentGachaBatchIndex + 1) * 10 >= fullPulledCardList.length;
      finish.textContent = isLast ? 'COLLECT' : 'NEXT SET';
      finish.onclick = () => isLast ? closeGachaStage() : nextGachaBatch();
      requestAnimationFrame(() => finish.classList.add('draw-action-ready'));
    }
  }

  async function flipCard430(wrapper, card) {
    if (!wrapper || wrapper.classList.contains('is-flipped') || wrapper.dataset.locked === '1') return;
    wrapper.dataset.locked = '1';
    wrapper.classList.add('is-flipping');
    await wait430(40);
    wrapper.classList.add('is-flipped');
    revealSound430(card);
    const le = isLE430(card);
    if ((card.grade === 'R' || le) && typeof createRGradeBurst === 'function') {
      try { createRGradeBurst(wrapper); if (le) setTimeout(() => createRGradeBurst(wrapper), 180); } catch (_) {}
    }
    await wait430(le ? 980 : card.grade === 'R' ? 820 : 680);
    wrapper.classList.remove('is-flipping');
    wrapper.classList.add('is-settled');
    wrapper.dataset.locked = '0';
    reveal430.revealed += 1;
    updateReveal430();
    if (reveal430.revealed >= reveal430.batch.length) reveal430.complete = true;
    setRevealAction430();
  }

  async function revealAll430() {
    if (reveal430.busy || reveal430.complete) return;
    reveal430.busy = true;
    const finish = byId('gacha-finish-btn');
    if (finish) { finish.disabled = true; finish.textContent = 'REVEALING…'; }
    for (let i = 0; i < reveal430.wrappers.length; i++) {
      const wrapper = reveal430.wrappers[i];
      if (!wrapper.classList.contains('is-flipped')) {
        await flipCard430(wrapper, reveal430.batch[i]);
        await wait430(reveal430.batch.length <= 3 ? 165 : 70);
      }
    }
    reveal430.busy = false;
    if (finish) finish.disabled = false;
    setRevealAction430();
  }
  window.revealAllCards = revealAll430;

  function revealHeader430(batch) {
    const overlay = byId('gacha-fullscreen-overlay');
    const header = overlay?.querySelector('.gacha-overlay-header');
    if (!header) return;
    const boost = overlay.querySelector('.r-pack-wow-banner');
    let kicker = batch.length <= 3 ? 'PREMIUM DRAW' : 'NEW CARDS';
    let title = batch.length === 1 ? 'CARD REVEAL' : batch.length <= 3 ? 'PACKAGE REVEAL' : 'CARD OPEN';
    let sub = 'Tap a card or reveal the full set.';
    if (boost) {
      kicker = boost.querySelector('span')?.textContent?.trim() || 'R PACKAGE';
      title = boost.querySelector('strong')?.textContent?.trim() || title;
      sub = 'R package secured · reveal each card to continue.';
      boost.remove();
    }
    header.innerHTML = `<div class="draw-title-cluster"><span class="draw-kicker">${esc430(kicker)}</span><h2>${esc430(title)}</h2><p>${esc430(sub)}</p></div><div class="draw-reveal-meter"><div><span>REVEALED</span><b data-reveal-counter>0 / ${batch.length}</b></div><i><em data-reveal-progress></em></i></div>`;
  }

  window.renderGachaBatch = renderGachaBatch = async function renderGachaBatchV430() {
    const overlay = byId('gacha-fullscreen-overlay');
    const grid = byId('draw-stage-cards');
    const next = byId('gacha-next-btn');
    const finish = byId('gacha-finish-btn');
    if (!overlay || !grid) return;

    const start = currentGachaBatchIndex * 10;
    const batch = fullPulledCardList.slice(start, Math.min(start + 10, fullPulledCardList.length));
    reveal430.batch = batch; reveal430.wrappers = []; reveal430.revealed = 0; reveal430.busy = false; reveal430.complete = false;
    grid.innerHTML = '';
    overlay.classList.add('foundation-reveal-theater');
    overlay.classList.toggle('gacha-small-batch', batch.length <= 3);
    overlay.classList.toggle('gacha-single-batch', batch.length === 1);
    if (next) next.style.display = 'none';
    if (finish) { finish.disabled = false; finish.style.display = 'none'; finish.classList.remove('draw-action-ready'); }
    revealHeader430(batch);

    batch.forEach((card, index) => {
      const le = isLE430(card);
      const img = typeof getLargeCardUrl === 'function' ? getLargeCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;
      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = `foundation-draw-card draw-grade-${String(card.grade || 'C').toLowerCase()}${le ? ' is-limited' : ''}`;
      wrapper.dataset.index = String(index);
      wrapper.dataset.locked = '0';
      wrapper.setAttribute('aria-label', `Reveal ${card.grade} ${card.member} ${card.theme}`);
      wrapper.innerHTML = `<div class="foundation-card-aura"></div><div class="card-container"><div class="card-face card-back"><span class="draw-back-mark">✦</span><small>SHINING</small></div><div class="card-face card-front"><img src="${esc430(img)}" alt="${esc430(card.member)} · ${esc430(card.theme)}" draggable="false">${le ? '<div class="foundation-le-sheen"></div>' : ''}</div></div><div class="foundation-rarity-line"></div>`;
      wrapper.onclick = () => {
        if (!wrapper.classList.contains('is-flipped')) flipCard430(wrapper, card);
        else if (typeof inspectGachaCard === 'function') inspectGachaCard(card);
      };
      grid.appendChild(wrapper);
      reveal430.wrappers.push(wrapper);
    });

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    reveal430.wrappers.forEach((wrapper, i) => setTimeout(() => wrapper.classList.add('is-dealt'), 90 + i * 90));
    await wait430(Math.min(800, 260 + batch.length * 70));
    updateReveal430();
    setRevealAction430();
  };

  // ---------- REMOVE LEGACY SELECTOR ROUTES ----------
  window.useCardSelectorTicket = useCardSelectorTicket = function() {
    if (Number(user.tickets?.cardSelector || 0) <= 0) return showToast('No Card Selector Ticket available.');
    if (typeof openSelector === 'function') openSelector('card', 'R', { legacyTicket: true });
  };
  window.showCardsForGroup = function() { if (typeof openSelector === 'function') openSelector('card', 'R', { legacyTicket: true }); };
  window.confirmCardSelection = function() { if (typeof openSelector === 'function') openSelector('card', 'R', { legacyTicket: true }); };

  // ---------- COLLECTION STUDIO ----------
  function materialTile430(card, originalIndex) {
    const chance = Math.round(Number(card.chance || 0) * 100);
    return `<button class="collection-card-tile material-tile" type="button" onclick="openCardDetail(${originalIndex})"><div class="collection-material-art"><span>${chance || 10}%</span><b>POWER UP</b></div><div class="collection-card-caption"><strong>Upgrade Material</strong><span>${chance || 10}% success card</span></div></button>`;
  }

  function cardTile430(card, originalIndex) {
    const equipped = typeof isCardEquipped === 'function' && isCardEquipped(card);
    const le = isLE430(card);
    const src = typeof getSmallCardUrl === 'function' ? getSmallCardUrl(card.url, card.grade, card.member, card.theme, card.group) : card.url;
    return `<button class="collection-card-tile ${equipped ? 'equipped' : ''} ${le ? 'limited' : ''}" type="button" onclick="openCardDetail(${originalIndex})"><div class="collection-card-art"><img class="smooth-load" src="${esc430(src)}" alt="${esc430(card.member)}" onload="this.classList.add('loaded')">${card.locked ? '<span class="collection-lock">LOCKED</span>' : ''}${equipped ? '<span class="collection-equipped">EQUIPPED</span>' : ''}</div><div class="collection-card-caption"><div><strong>${esc430(card.member)}</strong><b>${esc430(card.grade)}</b></div><span>${esc430(card.theme)}</span><small>Lv. ${Number(card.level || 1)} · ${esc430(card.group)}</small></div></button>`;
  }

  function currentCollectionGroup430() {
    const groups = Object.keys(themeDatabase || {}).sort();
    return groups.length ? groups[Math.max(0, Math.min(groups.length - 1, currentSsGroupIndex || 0))] : null;
  }

  function renderCollectionMetrics430() {
    const root = byId('collection-studio-metrics');
    if (!root || !user?.inventory) return;
    const real = user.inventory.filter(c => c && c.type !== 'material');
    const r = real.filter(c => c.grade === 'R').length;
    const locked = real.filter(c => c.locked).length;
    const le = real.filter(c => isLE430(c)).length;
    root.innerHTML = `<div><span>CARDS</span><b>${real.length}</b></div><div><span>R GRADE</span><b>${r}</b></div><div><span>LIMITED</span><b>${le}</b></div><div><span>LOCKED</span><b>${locked}</b></div>`;
  }

  function refreshCollectionControls430() {
    const filter = byId('ss-filter-select')?.value || 'all';
    document.querySelectorAll('#ss-grade-chips [data-grade]').forEach(btn => btn.classList.toggle('active', btn.dataset.grade.toLowerCase() === String(filter).toLowerCase()));
    const groupBtn = byId('btn-toggle-group-filter');
    if (groupBtn) groupBtn.textContent = ssGroupFilterActive ? 'CURRENT GROUP' : 'ALL GROUPS';
    const clear = byId('btn-clear-member');
    if (clear) clear.style.display = ssSelectedMember ? 'inline-flex' : 'none';
  }

  function prepareCollectionStudio430() {
    const modal = byId('superstar-collection-modal');
    if (!modal) return;
    const shell = modal.firstElementChild;
    if (!shell || shell.classList.contains('collection-studio-shell')) return;
    shell.classList.add('collection-studio-shell');
    const children = [...shell.children];
    const panes = children.filter(el => el.tagName === 'DIV');
    if (panes[0]) panes[0].classList.add('collection-deck-pane');
    if (panes[1]) panes[1].classList.add('collection-inventory-pane');

    const top = document.createElement('header');
    top.className = 'collection-studio-top';
    top.innerHTML = `<div><span>COLLECTION</span><h2>Card Atelier</h2><p>Build decks, inspect cards, and manage your collection.</p></div><div id="collection-studio-metrics" class="collection-studio-metrics"></div>`;
    shell.insertBefore(top, panes[0] || shell.firstChild);

    const bar = byId('ss-right-header-bar');
    if (bar) {
      bar.className = 'collection-toolbar';
      bar.innerHTML = `<div class="collection-toolbar-main"><div class="collection-capacity"><span>INVENTORY</span><strong id="ss-inv-count">0 / 0</strong></div><label class="collection-search"><span>⌕</span><input id="ss-search-input" type="search" autocomplete="off" placeholder="Search member, theme, group…"></label><button id="btn-toggle-group-filter" class="collection-segment-btn" type="button">CURRENT GROUP</button><button id="btn-clear-member" class="collection-segment-btn subtle" type="button" style="display:none">CLEAR MEMBER</button></div><div class="collection-toolbar-sub"><div id="ss-grade-chips" class="collection-grade-chips">${['all','R','S','A','B','C'].map(g => `<button type="button" data-grade="${g}" class="${g==='all'?'active':''}">${g==='all'?'ALL':g}</button>`).join('')}</div><select id="ss-filter-select" hidden><option value="all">All</option><option>R</option><option>S</option><option>A</option><option>B</option><option>C</option></select><label class="collection-sort"><span>SORT</span><select id="ss-sort-select"><option value="gradeDown">Highest Grade</option><option value="gradeUp">Lowest Grade</option><option value="newest">Newest</option></select></label><button class="collection-tool-btn" type="button" data-open-theme>DECK THEME</button><button class="collection-tool-btn accent" type="button" data-open-book>CARD BOOK</button></div>`;
      byId('ss-search-input')?.addEventListener('input', () => renderSuperstarUI());
      byId('ss-sort-select')?.addEventListener('change', () => renderSuperstarUI());
      byId('btn-toggle-group-filter')?.addEventListener('click', () => toggleGroupFilter());
      byId('btn-clear-member')?.addEventListener('click', () => { ssSelectedMember = null; renderSuperstarUI(); });
      bar.querySelectorAll('[data-grade]').forEach(btn => btn.onclick = () => { byId('ss-filter-select').value = btn.dataset.grade; renderSuperstarUI(); });
      bar.querySelector('[data-open-theme]').onclick = () => openThemeSelectorModal();
      bar.querySelector('[data-open-book]').onclick = () => openCardBook();
    }
    renderCollectionMetrics430();
  }

  window.createGroupCircleBtn = createGroupCircleBtn = function(groupName, isSelected, onClickAction) {
    const emblem = typeof getGroupEmblemUrl === 'function' ? getGroupEmblemUrl(groupName) : '';
    return `<button type="button" class="collection-group-chip ${isSelected ? 'active' : ''}" onclick="${onClickAction}"><span><img src="${esc430(emblem)}" alt="" onerror="this.style.display='none'"></span><b>${esc430(groupName)}</b></button>`;
  };

  window.toggleGroupFilter = toggleGroupFilter = function() {
    ssGroupFilterActive = !ssGroupFilterActive;
    renderSuperstarUI();
  };

  window.renderSuperstarRight = renderSuperstarRight = function renderSuperstarRightV430(groupFilter) {
    const grid = byId('ss-inv-grid');
    if (!grid || !user?.inventory) return;
    const sort = byId('ss-sort-select')?.value || 'gradeDown';
    const grade = byId('ss-filter-select')?.value || 'all';
    const query = (byId('ss-search-input')?.value || '').trim().toLowerCase();
    let list = user.inventory.map((c, i) => c ? ({...c, originalIndex:i}) : null).filter(Boolean);

    if (currentlyViewingCardIndex !== null) {
      const viewed = user.inventory[currentlyViewingCardIndex];
      if (viewed) list = list.filter(c => c.group === viewed.group && c.member === viewed.member);
    } else if (ssSelectedMember) {
      list = list.filter(c => String(c.group||'').toLowerCase() === String(groupFilter||'').toLowerCase() && c.member === ssSelectedMember);
    } else if (ssGroupFilterActive && groupFilter) {
      list = list.filter(c => String(c.group||'').toLowerCase() === String(groupFilter||'').toLowerCase());
    }
    if (['R','S','A','B','C'].includes(grade)) list = list.filter(c => c.grade === grade);
    if (query) list = list.filter(c => `${c.group||''} ${c.member||''} ${c.theme||''} ${c.grade||''} ${c.type||''}`.toLowerCase().includes(query));

    const gradeVals = {R:5,S:4,A:3,B:2,C:1};
    list.sort((a,b) => {
      const ae = typeof isCardEquipped === 'function' && isCardEquipped(a), be = typeof isCardEquipped === 'function' && isCardEquipped(b);
      if (ae !== be) return Number(be)-Number(ae);
      if (sort === 'gradeDown') return (gradeVals[b.grade]||0)-(gradeVals[a.grade]||0) || (b.level||1)-(a.level||1);
      if (sort === 'gradeUp') return (gradeVals[a.grade]||0)-(gradeVals[b.grade]||0) || (b.level||1)-(a.level||1);
      return b.originalIndex-a.originalIndex;
    });

    const used = typeof getUsedInventorySlots === 'function' ? getUsedInventorySlots() : list.length;
    const max = typeof getMaxInventorySlots === 'function' ? getMaxInventorySlots() : '?';
    const count = byId('ss-inv-count'); if (count) count.textContent = `${used} / ${max}`;
    grid.className = 'collection-card-grid';
    grid.innerHTML = list.length ? list.map(c => c.type === 'material' ? materialTile430(c,c.originalIndex) : cardTile430(c,c.originalIndex)).join('') : `<div class="collection-empty"><span>NO MATCHES</span><strong>Your collection is quiet here.</strong><small>Change the grade, group, member, or search.</small></div>`;
    refreshCollectionControls430(); renderCollectionMetrics430();
  };

  const baseRender430 = typeof renderSuperstarUI === 'function' ? renderSuperstarUI : null;
  if (baseRender430) {
    window.renderSuperstarUI = renderSuperstarUI = function() {
      prepareCollectionStudio430();
      const result = baseRender430.apply(this, arguments);
      refreshCollectionControls430(); renderCollectionMetrics430();
      return result;
    };
  }

  const baseVault430 = typeof toggleVault === 'function' ? toggleVault : null;
  if (baseVault430) {
    window.toggleVault = toggleVault = function() {
      prepareCollectionStudio430();
      const result = baseVault430.apply(this, arguments);
      setTimeout(() => { if (byId('superstar-collection-modal')?.style.display === 'flex') renderSuperstarUI(); }, 0);
      return result;
    };
  }

  // ---------- SMALL STABILITY CLEANUPS ----------
  document.addEventListener('DOMContentLoaded', () => {
    prepareCollectionStudio430();
    const legacy = byId('card-selector-modal'); if (legacy) legacy.remove();
    document.body.classList.add('foundation-430');
  });
})();


