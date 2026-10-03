/* ========================================================================
 * SHINING SUPERSTAR 5.1.0 · REVEAL + UI POLISH HOTFIX
 * - reliable automatic card flipping with one state machine
 * - event-shop preview sizing / profile fallback carousel
 * - modern card inspector
 * - card-book view-state cleanup
 * - defensive UI guards for optional HUD nodes
 * ======================================================================== */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc510 = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wait510 = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const key510 = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9.-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const gradeAccent510 = (g) => ({R:'#ff4f79',S:'#f3d584',A:'#67d8ef',B:'#b794f6',C:'#94a3b8'}[String(g || 'C').toUpperCase()] || '#94a3b8');
  const isLE510 = (card) => {
    try { return typeof isLimitedTheme === 'function' && isLimitedTheme(card?.group, card?.theme); }
    catch (_) { return false; }
  };
  const cardUrl510 = (card) => {
    try {
      return typeof getLargeCardUrl === 'function'
        ? getLargeCardUrl(card?.url || 'dynamic', card?.grade || 'C', card?.member, card?.theme, card?.group)
        : (card?.url || '');
    } catch (_) { return card?.url || ''; }
  };

  // ----------------------------------------------------------------------
  // 1) GACHA — one reveal state machine, automatic sequential flip.
  // ----------------------------------------------------------------------
  const reveal510 = {
    token: 0,
    batch: [],
    wrappers: [],
    revealed: 0,
    busy: false,
    complete: false,
    autoRunning: false
  };

  function revealSfx510(card) {
    try {
      const le = isLE510(card);
      const audio = (card?.grade === 'R' || le) ? sfxEpicReveal : card?.grade === 'S' ? sfxRareReveal : null;
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = Math.min(1, Number(typeof globalSfxVolume !== 'undefined' ? globalSfxVolume : .55));
      audio.play().catch(() => {});
    } catch (_) {}
  }

  function updateMeter510() {
    const overlay = $('gacha-fullscreen-overlay');
    const count = overlay?.querySelector('[data-v510-reveal-count]');
    const bar = overlay?.querySelector('[data-v510-reveal-progress]');
    if (count) count.textContent = `${reveal510.revealed} / ${reveal510.batch.length}`;
    if (bar) bar.style.width = `${reveal510.batch.length ? (reveal510.revealed / reveal510.batch.length) * 100 : 0}%`;
  }

  function setGachaAction510() {
    const finish = $('gacha-finish-btn');
    const next = $('gacha-next-btn');
    if (next) next.style.display = 'none';
    if (!finish) return;
    finish.style.display = 'inline-flex';
    finish.disabled = false;
    finish.classList.remove('draw-action-ready', 'v510-skip');

    if (!reveal510.complete) {
      const remaining = Math.max(0, reveal510.batch.length - reveal510.revealed);
      finish.textContent = reveal510.autoRunning ? `SKIP REVEAL · ${remaining}` : `REVEAL REST · ${remaining}`;
      finish.classList.add('v510-skip');
      finish.onclick = () => revealAll510(true);
      return;
    }

    const isLast = (currentGachaBatchIndex + 1) * 10 >= fullPulledCardList.length;
    finish.textContent = isLast ? 'COLLECT' : 'NEXT SET';
    finish.onclick = () => isLast ? closeGachaStage() : nextGachaBatch();
    requestAnimationFrame(() => finish.classList.add('draw-action-ready'));
  }

  async function flipCard510(wrapper, card, { fast = false } = {}) {
    if (!wrapper || wrapper.classList.contains('v510-flipped') || wrapper.dataset.locked === '1') return false;
    wrapper.dataset.locked = '1';
    wrapper.classList.add('v510-flipping');

    // Give the browser one paint before changing the 3D state. This is the
    // important reliability fix for Chromium builds that skipped the old flip.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    wrapper.classList.add('v510-flipped');
    revealSfx510(card);

    const le = isLE510(card);
    if ((card?.grade === 'R' || le) && typeof createRGradeBurst === 'function') {
      try {
        createRGradeBurst(wrapper);
        if (le && !fast) setTimeout(() => createRGradeBurst(wrapper), 150);
      } catch (_) {}
    }

    await wait510(fast ? 150 : le ? 760 : card?.grade === 'R' ? 620 : 470);
    wrapper.classList.remove('v510-flipping');
    wrapper.classList.add('v510-settled');
    wrapper.dataset.locked = '0';

    if (wrapper.dataset.counted !== '1') {
      wrapper.dataset.counted = '1';
      reveal510.revealed += 1;
      if (reveal510.revealed >= reveal510.batch.length) reveal510.complete = true;
      updateMeter510();
      setGachaAction510();
    }
    return true;
  }

  async function revealAll510(fast = false, token = reveal510.token) {
    if (reveal510.busy && !fast) return;
    if (reveal510.busy && fast) {
      reveal510.autoRunning = false;
      reveal510.wrappers.forEach((wrapper, i) => {
        if (!wrapper.classList.contains('v510-flipped')) wrapper.classList.add('v510-flipped', 'v510-settled');
        if (wrapper.dataset.counted !== '1') {
          wrapper.dataset.counted = '1';
          reveal510.revealed += 1;
        }
      });
      reveal510.complete = reveal510.revealed >= reveal510.batch.length;
      updateMeter510();
      setGachaAction510();
      return;
    }
    reveal510.busy = true;
    if (fast) reveal510.autoRunning = false;
    setGachaAction510();

    for (let i = 0; i < reveal510.wrappers.length; i++) {
      if (token !== reveal510.token) break;
      const wrapper = reveal510.wrappers[i];
      if (!wrapper.classList.contains('v510-flipped')) {
        await flipCard510(wrapper, reveal510.batch[i], { fast });
        await wait510(fast ? 34 : reveal510.batch.length <= 3 ? 150 : 72);
      }
    }

    reveal510.busy = false;
    reveal510.autoRunning = false;
    if (reveal510.revealed >= reveal510.batch.length) reveal510.complete = true;
    updateMeter510();
    setGachaAction510();
  }
  window.revealAllCards = revealAll510;

  function gachaHeader510(batch) {
    const overlay = $('gacha-fullscreen-overlay');
    const header = overlay?.querySelector('.gacha-overlay-header');
    if (!header) return;
    const boost = overlay.querySelector('.r-pack-wow-banner');
    let kicker = batch.length === 1 ? 'NEW CARD' : 'NEW CARDS';
    let title = batch.length === 1 ? 'CARD REVEAL' : 'CARD OPEN';
    let sub = 'Cards will reveal automatically. Tap any card to reveal it early.';
    if (boost) {
      kicker = boost.querySelector('span')?.textContent?.trim() || 'PREMIUM PACKAGE';
      title = boost.querySelector('strong')?.textContent?.trim() || title;
      sub = 'Premium cards secured · automatic reveal started.';
      boost.remove();
    }
    header.innerHTML = `
      <div class="v510-draw-title">
        <span>${esc510(kicker)}</span>
        <h2>${esc510(title)}</h2>
        <p>${esc510(sub)}</p>
      </div>
      <div class="v510-reveal-meter">
        <div><span>REVEALED</span><strong data-v510-reveal-count>0 / ${batch.length}</strong></div>
        <i><em data-v510-reveal-progress></em></i>
      </div>`;
  }

  window.renderGachaBatch = renderGachaBatch = async function renderGachaBatchV510() {
    const overlay = $('gacha-fullscreen-overlay');
    const grid = $('draw-stage-cards');
    const finish = $('gacha-finish-btn');
    const next = $('gacha-next-btn');
    if (!overlay || !grid) return;

    const token = ++reveal510.token;
    const start = currentGachaBatchIndex * 10;
    const batch = fullPulledCardList.slice(start, Math.min(start + 10, fullPulledCardList.length));
    reveal510.batch = batch;
    reveal510.wrappers = [];
    reveal510.revealed = 0;
    reveal510.busy = false;
    reveal510.complete = false;
    reveal510.autoRunning = false;

    overlay.classList.remove('foundation-reveal-theater');
    overlay.classList.add('v510-reveal-theater');
    overlay.classList.toggle('v510-small-batch', batch.length <= 3);
    overlay.classList.toggle('v510-single-batch', batch.length === 1);
    overlay.style.display = 'flex';
    grid.innerHTML = '';
    if (next) next.style.display = 'none';
    if (finish) { finish.style.display = 'none'; finish.disabled = false; finish.onclick = null; }
    gachaHeader510(batch);

    batch.forEach((card, index) => {
      const le = isLE510(card);
      const accent = gradeAccent510(card?.grade);
      const url = cardUrl510(card);
      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = `v510-draw-card grade-${String(card?.grade || 'C').toLowerCase()}${le ? ' limited' : ''}`;
      wrapper.dataset.locked = '0';
      wrapper.dataset.counted = '0';
      wrapper.style.setProperty('--card-accent', accent);
      wrapper.setAttribute('aria-label', `Reveal ${card?.grade || ''} ${card?.member || ''} ${card?.theme || ''}`.trim());
      wrapper.innerHTML = `
        <span class="v510-card-aura" aria-hidden="true"></span>
        <span class="v510-card-flip">
          <span class="v510-card-face v510-card-back">
            <i>✦</i><b>SHINING</b><small>SUPERSTAR</small>
          </span>
          <span class="v510-card-face v510-card-front">
            <img src="${esc510(url)}" alt="${esc510(card?.member || 'Card')} · ${esc510(card?.theme || '')}" draggable="false">
            <span class="v510-card-info"><b>${esc510(card?.grade || 'C')}</b><span>${esc510(card?.member || '')}</span><small>${esc510(card?.theme || '')}</small></span>
          </span>
        </span>
        <span class="v510-rarity-line" aria-hidden="true"></span>`;

      const img = wrapper.querySelector('img');
      if (img) {
        img.onerror = () => {
          img.style.display = 'none';
          const front = wrapper.querySelector('.v510-card-front');
          if (front && !front.querySelector('.v510-card-fallback')) {
            front.insertAdjacentHTML('beforeend', `<span class="v510-card-fallback"><strong>${esc510(card?.grade || 'C')}</strong><b>${esc510(card?.member || 'CARD')}</b><small>${esc510(card?.theme || '')}</small></span>`);
          }
        };
      }

      wrapper.onclick = () => {
        if (!wrapper.classList.contains('v510-flipped')) flipCard510(wrapper, card, { fast: false });
        else if (typeof inspectGachaCard === 'function') inspectGachaCard(card);
      };
      grid.appendChild(wrapper);
      reveal510.wrappers.push(wrapper);
    });

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    reveal510.wrappers.forEach((wrapper, i) => setTimeout(() => {
      if (token === reveal510.token) wrapper.classList.add('v510-dealt');
    }, 70 + i * 70));

    updateMeter510();
    setGachaAction510();

    // Automatic reveal requested by design. A short deal pause keeps the flip
    // readable while still feeling instant.
    await wait510(Math.min(820, 520 + batch.length * 32));
    if (token !== reveal510.token) return;
    reveal510.autoRunning = true;
    setGachaAction510();
    await revealAll510(false, token);
  };

  // Clean all reveal-only classes on close so a later pull always starts fresh.
  const baseCloseGacha510 = typeof closeGachaStage === 'function' ? closeGachaStage : null;
  if (baseCloseGacha510) {
    window.closeGachaStage = closeGachaStage = function closeGachaStageV510() {
      reveal510.token++;
      reveal510.autoRunning = false;
      reveal510.busy = false;
      const overlay = $('gacha-fullscreen-overlay');
      overlay?.classList.remove('v510-reveal-theater', 'v510-small-batch', 'v510-single-batch');
      return baseCloseGacha510.apply(this, arguments);
    };
  }

  // ----------------------------------------------------------------------
  // 2) EVENT SHOP — sane preview counts and never-blank profile bundles.
  // ----------------------------------------------------------------------
  function officialPreview510(group, theme, grades, count) {
    const db = themeDatabase || {};
    const actualGroup = Object.keys(db).find(g => key510(g) === key510(group)) || group;
    const members = db?.[actualGroup]?.members || ['MEMBER'];
    const n = Math.max(1, Math.min(Number(count) || 1, members.length || 1));
    return Array.from({length:n}, (_, i) => {
      const grade = grades[i % grades.length] || grades[0] || 'A';
      const member = members[i % members.length] || 'MEMBER';
      return { group: actualGroup, member, theme, grade, url: 'dynamic' };
    });
  }

  function eventCardTile510(card) {
    const url = cardUrl510(card);
    const accent = gradeAccent510(card.grade);
    return `<div class="v510-event-card" style="--card-accent:${accent}">
      <img src="${esc510(url)}" alt="${esc510(card.member)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <span class="v510-event-fallback" style="display:none"><b>${esc510(card.grade)}</b><small>${esc510(card.member)}</small></span>
      <small>${esc510(card.member)}</small>
    </div>`;
  }

  function rebuildEventPreviews510() {
    document.querySelectorAll('.event-sub-content[data-event-group][data-event-theme]').forEach(container => {
      const group = container.dataset.eventGroup;
      const theme = container.dataset.eventTheme;
      const groupData = Object.entries(themeDatabase || {}).find(([g]) => key510(g) === key510(group))?.[1] || {};
      const members = groupData.members || [];

      const header = container.querySelector('.event-v5-header');
      const strip = header?.querySelector('.event-v5-card-strip');
      if (strip) {
        const featured = officialPreview510(group, theme, ['R','S','A','A','R'], Math.min(5, Math.max(1, members.length || 4)));
        strip.innerHTML = featured.map(eventCardTile510).join('');
        strip.classList.add('v510-featured-strip');
      }

      const configs = [
        {type:'A_CARD', count:1, grades:['A'], cls:'a-pack'},
        {type:'R_PACK', count:3, grades:['R','A','A'], cls:'r-pack'},
        {type:'PREMIUM_10', count:5, grades:['R','S','A','S','A'], cls:'premium-pack'}
      ];
      configs.forEach(cfg => {
        const buy = container.querySelector(`[onclick*="buySpecialEventPack"][onclick*="${cfg.type}"]`);
        const card = buy?.closest('.event-pack-card');
        const media = card?.querySelector('.event-pack-media');
        if (!media) return;
        const preview = officialPreview510(group, theme, cfg.grades, cfg.count);
        media.innerHTML = `<div class="v510-pack-stage ${cfg.cls}">${preview.map(eventCardTile510).join('')}</div>`;
        card?.classList.add('v510-pack-card');
      });

      const stage = container.querySelector('.event-profile-offer [class*="profile-stage-"]');
      if (stage) initProfileStage510(stage, group, theme);
    });
  }

  function initProfileStage510(stage, group, theme) {
    if (!stage || stage.dataset.v510Ready === '1') return;
    stage.dataset.v510Ready = '1';
    stage.classList.add('v510-profile-stage');
    const imgs = [...stage.querySelectorAll('img.holo-single')];
    imgs.forEach(img => { img.style.animation = 'none'; img.classList.remove('v510-active'); });

    let index = 0;
    const valid = () => imgs.filter(img => img.complete && img.naturalWidth > 8);
    const show = (img) => {
      imgs.forEach(x => x.classList.remove('v510-active'));
      if (img) img.classList.add('v510-active');
    };

    const firstLoaded = valid()[0];
    if (firstLoaded) show(firstLoaded);
    imgs.forEach(img => img.addEventListener('load', () => {
      if (!stage.querySelector('.holo-single.v510-active')) show(img);
    }, { once:false }));

    // Catalog-based fallback: even when old remote profile URLs are dead, show
    // a real event card from the runtime catalog instead of an empty black box.
    setTimeout(() => {
      if (valid().length) return;
      const actualGroup = Object.keys(themeDatabase || {}).find(g => key510(g) === key510(group)) || group;
      const member = themeDatabase?.[actualGroup]?.members?.[0] || 'MEMBER';
      const fallback = document.createElement('img');
      fallback.className = 'v510-profile-generated';
      fallback.alt = `${member} ${theme}`;
      fallback.src = cardUrl510({group:actualGroup, member, theme, grade:'R', url:'dynamic'});
      fallback.onerror = () => {
        fallback.remove();
        if (!stage.querySelector('.v510-profile-text-fallback')) {
          stage.insertAdjacentHTML('beforeend', `<span class="v510-profile-text-fallback"><b>${esc510(group)}</b><small>${esc510(theme)} PROFILE SET</small></span>`);
        }
      };
      stage.appendChild(fallback);
    }, 1400);

    if (imgs.length > 1) {
      const timer = setInterval(() => {
        if (!document.body.contains(stage)) return clearInterval(timer);
        if (stage.offsetParent === null) return;
        const loaded = valid();
        if (!loaded.length) return;
        index = (index + 1) % loaded.length;
        show(loaded[index]);
      }, 2800);
    }
  }

  // ----------------------------------------------------------------------
  // 3) COLLECTION INSPECTOR — replaces old inline-heavy panel.
  // ----------------------------------------------------------------------
  window.renderSuperstarInspector = renderSuperstarInspector = function renderSuperstarInspectorV510() {
    const panel = $('ss-right-inspector-view');
    const card = user?.inventory?.[currentlyViewingCardIndex];
    if (!panel || !card) return;
    const le = isLE510(card);
    const url = cardUrl510(card);
    const accent = gradeAccent510(card.grade);
    const gradeBase = {R:101,S:82,A:64,B:46,C:28}[card.grade] || 10;
    const score = Math.floor(gradeBase + (card.level || 1) * 2.5);
    const themeInfo = typeof getThemeLevelInfo === 'function' ? getThemeLevelInfo(card.group) : {level:0, themeName:''};
    const themeLv = themeInfo.level > 0 && key510(themeInfo.themeName) === key510(card.theme) ? themeInfo.level : 0;
    const equipped = typeof isCardEquipped === 'function' && isCardEquipped(card);

    panel.className = 'v510-inspector anim-slide-left';
    panel.style.display = 'grid';
    panel.style.removeProperty('padding');
    panel.style.removeProperty('height');
    panel.innerHTML = `
      <header class="v510-inspector-head">
        <div><span>CARD DETAILS</span><strong>${esc510(card.group || 'COLLECTION')}</strong></div>
        <div class="v510-inspector-tools">
          <button type="button" onclick="open3DView()" title="3D inspect">3D</button>
          <button type="button" class="${card.locked ? 'active' : ''}" onclick="toggleLockAndRefresh(${currentlyViewingCardIndex})" title="${card.locked ? 'Unlock' : 'Lock'} card">${card.locked ? 'LOCKED' : 'LOCK'}</button>
          <button type="button" class="close" onclick="closeCardDetail()" title="Close">×</button>
        </div>
      </header>
      <section class="v510-inspector-main" style="--card-accent:${accent}">
        <button class="v510-inspector-art ${le ? 'limited' : ''}" type="button" onclick="open3DView()" title="Open 3D view">
          <span class="v510-inspector-glow"></span>
          <img src="${esc510(url)}" alt="${esc510(card.member || 'Card')}" onerror="this.style.opacity='.15'">
          ${le ? '<i>LIMITED THEME</i>' : ''}
        </button>
        <div class="v510-inspector-data">
          <div class="v510-name-row"><b>${esc510(card.grade || 'C')}</b><div><h2>${esc510(card.member || 'MEMBER')}</h2><p>LEVEL ${Number(card.level || 1)} · ${esc510(card.group || '')}</p></div></div>
          <div class="v510-score-card"><span>SCORE</span><strong>${score.toLocaleString()}</strong><small>Current card power</small></div>
          <div class="v510-theme-card"><span>THEME</span><strong>${esc510(card.theme || 'BASE')}</strong><small>${themeLv ? `Active set bonus · Lv ${themeLv}` : 'No active set bonus'}</small></div>
          <div class="v510-card-status"><span>${equipped ? 'EQUIPPED' : 'AVAILABLE'}</span><span>${card.locked ? 'LOCKED' : 'UNLOCKED'}</span>${le ? '<span>LIMITED</span>' : ''}</div>
        </div>
      </section>
      <footer class="v510-inspector-actions">
        <button class="primary" type="button" onclick="${equipped ? `unequipSingleCard('${String(card.group).replace(/'/g,"\\'")}', '${String(card.member).replace(/'/g,"\\'")}')` : `equipSingleCard(${currentlyViewingCardIndex})`}">${equipped ? 'UNEQUIP' : 'EQUIP'}</button>
        <button type="button" onclick="triggerUpgrade(${currentlyViewingCardIndex})">POWER UP</button>
        <button class="danger" type="button" onclick="scrapCardAndClear(${currentlyViewingCardIndex})" ${card.locked ? 'disabled title="Unlock this card before selling"' : ''}>SELL</button>
      </footer>`;
  };

  window.renderGhostInspector = renderGhostInspector = function renderGhostInspectorV510() {
    const panel = $('ss-right-inspector-view');
    const ghost = typeof currentlyViewingGhost !== 'undefined' ? currentlyViewingGhost : null;
    if (!panel || !ghost) return;
    const group = ghost.group;
    const member = ghost.member;
    const data = themeDatabase?.[group] || {};
    const themeInfo = typeof getThemeLevelInfo === 'function' ? getThemeLevelInfo(group) : {level:0,themeName:''};
    const theme = themeInfo.level > 0 ? themeInfo.themeName : ([...(data.themes || []), ...(data.le_themes || [])][0] || 'BASE');
    const url = typeof getGhostCardUrl === 'function' ? getGhostCardUrl(group, member, theme) : '';
    panel.className = 'v510-inspector v510-ghost-inspector anim-slide-left';
    panel.style.display = 'grid';
    panel.innerHTML = `
      <header class="v510-inspector-head"><div><span>EMPTY SLOT</span><strong>${esc510(group)}</strong></div><div class="v510-inspector-tools"><button class="close" type="button" onclick="closeCardDetail()">×</button></div></header>
      <section class="v510-inspector-main">
        <div class="v510-inspector-art ghost"><img src="${esc510(url)}" alt="${esc510(member)}"></div>
        <div class="v510-inspector-data"><div class="v510-name-row"><b>—</b><div><h2>${esc510(member)}</h2><p>NO CARD EQUIPPED</p></div></div><div class="v510-theme-card"><span>SUGGESTED THEME</span><strong>${esc510(theme)}</strong><small>Choose an owned card for this member.</small></div></div>
      </section>
      <footer class="v510-inspector-actions"><button class="primary" type="button" onclick="findCardsForGhost('${String(member).replace(/'/g,"\\'")}')">FIND CARDS TO EQUIP</button></footer>`;
  };

  // ----------------------------------------------------------------------
  // 4) CARD BOOK — deterministic view state and cleaner mode transitions.
  // ----------------------------------------------------------------------
  function syncCardBookMode510(mode) {
    const modal = $('cardbook-modal');
    if (!modal) return;
    modal.classList.toggle('v510-cardbook-specific', mode === 'specific');
    modal.dataset.cbMode = mode || 'main';
    const nav = $('cb-top-nav');
    if (nav) nav.style.display = mode === 'specific' ? 'none' : 'flex';
  }

  const baseSwitchCB510 = typeof switchCardBookTab === 'function' ? switchCardBookTab : null;
  if (baseSwitchCB510) {
    window.switchCardBookTab = switchCardBookTab = function switchCardBookTabV510(tabId) {
      syncCardBookMode510(tabId);
      const result = baseSwitchCB510.apply(this, arguments);
      syncCardBookMode510(tabId);
      return result;
    };
  }

  const baseOpenCB510 = typeof openCardBook === 'function' ? openCardBook : null;
  if (baseOpenCB510) {
    window.openCardBook = openCardBook = function openCardBookV510() {
      const modal = $('cardbook-modal');
      modal?.classList.add('v510-cardbook');
      const result = baseOpenCB510.apply(this, arguments);
      syncCardBookMode510('main');
      return result;
    };
  }

  const baseSpecific510 = typeof openCardBookSpecific === 'function' ? openCardBookSpecific : null;
  if (baseSpecific510) {
    window.openCardBookSpecific = openCardBookSpecific = function openCardBookSpecificV510(group) {
      syncCardBookMode510('specific');
      const result = baseSpecific510.apply(this, arguments);
      syncCardBookMode510('specific');
      return result;
    };
  }

  // ----------------------------------------------------------------------
  // 5) Defensive cleanup / initialization.
  // ----------------------------------------------------------------------
  window.__rebuildEventPreviews510 = rebuildEventPreviews510;
  function init510() {
    document.body.classList.add('shining-v510');
    $('cardbook-modal')?.classList.add('v510-cardbook');
    rebuildEventPreviews510();
    [700, 1500, 2800, 4500].forEach(ms => setTimeout(rebuildEventPreviews510, ms));
  }
  document.addEventListener('DOMContentLoaded', init510);
  if (document.readyState !== 'loading') init510();
})();


/* 5.1.0 shop refresh bridge: old tab code can rebuild its previews after a tab
   change, so re-apply the corrected 5.1 preview sizing immediately afterward. */
(() => {
  const baseSwitchShop510 = typeof switchShopTab === 'function' ? switchShopTab : null;
  if (baseSwitchShop510 && !baseSwitchShop510.__v510Wrapped) {
    const wrapped = function switchShopTabV510Bridge() {
      const result = baseSwitchShop510.apply(this, arguments);
      setTimeout(() => window.__rebuildEventPreviews510?.(), 90);
      setTimeout(() => window.__rebuildEventPreviews510?.(), 420);
      return result;
    };
    wrapped.__v510Wrapped = true;
    window.switchShopTab = switchShopTab = wrapped;
  }
  const baseSwitchEvent510 = typeof switchEventSubTab === 'function' ? switchEventSubTab : null;
  if (baseSwitchEvent510 && !baseSwitchEvent510.__v510Wrapped) {
    const wrappedEvent = function switchEventSubTabV510Bridge() {
      const result = baseSwitchEvent510.apply(this, arguments);
      setTimeout(() => window.__rebuildEventPreviews510?.(), 60);
      return result;
    };
    wrappedEvent.__v510Wrapped = true;
    window.switchEventSubTab = switchEventSubTab = wrappedEvent;
  }
})();

