/* ========================================================================
   SHINING SUPERSTAR 6.0.0 — PRESENTATION SUITE
   IMPORTANT: gameplay / launch3DStage / hit logic intentionally untouched.
   ======================================================================== */
(() => {
  const $600 = (id) => document.getElementById(id);
  const qa600 = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp600 = (n, a, b) => Math.max(a, Math.min(b, n));
  const n600 = (v) => Number(v || 0);
  const fmt600 = (v) => n600(v).toLocaleString();
  const key600 = (v) => String(v || '').trim().toLowerCase();

  const GROUP_ACCENTS_600 = {
    aespa:['#72e3ea','114,227,234'], itzy:['#ff4f79','255,79,121'], ive:['#eed99f','238,217,159'],
    loona:['#b78cff','183,140,255'], 'red velvet':['#ff5b72','255,91,114'], nmixx:['#7ce7c4','124,231,196'],
    idle:['#d98cff','217,140,255'], '(g)i-dle':['#d98cff','217,140,255'], artms:['#9ac7ff','154,199,255'],
    twice:['#ff8eaf','255,142,175'], stayc:['#8fe7ff','143,231,255'], kissOfLife:['#f2bf77','242,191,119']
  };

  function accentFor600(name) {
    const k = key600(name);
    for (const [group, pair] of Object.entries(GROUP_ACCENTS_600)) if (k.includes(key600(group))) return pair;
    let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const color = `hsl(${h} 78% 67%)`;
    return [color, '255,79,121'];
  }
  function applyAccent600(group) {
    const [color, rgb] = accentFor600(group || user?.favoriteCard?.group || 'shining');
    document.body.style.setProperty('--v600-accent', color);
    document.body.style.setProperty('--v600-accent-rgb', rgb);
  }

  function missionStats600(tab = (typeof currentMissionTab !== 'undefined' ? currentMissionTab : 'daily')) {
    const rows = (typeof missionDB !== 'undefined' && Array.isArray(missionDB?.[tab])) ? missionDB[tab].filter(m => m && !m.isHeader) : [];
    const progress = user?.missionProgress || {};
    const claimed = user?.missionClaimed || {};
    const completed = rows.filter(m => n600(progress[m.id]) >= n600(m.target)).length;
    const ready = rows.filter(m => n600(progress[m.id]) >= n600(m.target) && !claimed[m.id]).length;
    return { rows, completed, ready, pct: rows.length ? Math.round((completed / rows.length) * 100) : 0 };
  }

  function inventoryStats600() {
    const inv = (user?.inventory || []).filter(Boolean);
    const cards = inv.filter(c => c.type !== 'material');
    let cap = 300;
    try { if (typeof getMaxInventorySlots === 'function') cap = getMaxInventorySlots(); } catch (_) {}
    return { cards, cap, r: cards.filter(c => c.grade === 'R').length, limited: cards.filter(c => {
      try { return typeof isLimitedTheme === 'function' && isLimitedTheme(c.group, c.theme); } catch (_) { return false; }
    }).length };
  }

  function prepareLobby600() {
    const root = $600('game-hud-wrapper');
    if (!root) return;
    if (!$600('v600-season-mark')) root.insertAdjacentHTML('beforeend', `<div id="v600-season-mark" class="v600-season-mark"><i></i><span>LIVE SERVICE · COLLECTION SEASON</span></div>`);
    if (!$600('v600-lobby-status')) root.insertAdjacentHTML('beforeend', `
      <section id="v600-lobby-status" class="v600-lobby-status" aria-label="Player quick status">
        <div class="v600-lobby-metric" data-metric="missions"><span>Daily Missions</span><strong>0 / 0</strong><em><i></i></em></div>
        <div class="v600-lobby-metric" data-metric="inventory"><span>Inventory</span><strong>0 / 300</strong><em><i></i></em></div>
        <div class="v600-lobby-metric" data-metric="collection"><span>R / Limited</span><strong>0 / 0</strong><em><i></i></em></div>
        <div class="v600-lobby-metric" data-metric="league"><span>Weekly Score</span><strong>0</strong><em><i></i></em></div>
      </section>`);
    refreshLobby600();
  }

  function setMetric600(name, value, pct = 0) {
    const box = document.querySelector(`#v600-lobby-status [data-metric="${name}"]`);
    if (!box) return;
    const strong = box.querySelector('strong'); if (strong) strong.textContent = value;
    const bar = box.querySelector('em i'); if (bar) bar.style.setProperty('--p', `${clamp600(pct,0,100)}%`);
  }

  function ensureNavBadge600(index, count, warn = false) {
    const nav = qa600('.hud-nav-container .hud-nav-btn')[index];
    if (!nav) return;
    let badge = nav.querySelector('.v600-nav-badge');
    if (!count) { badge?.remove(); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'v600-nav-badge'; nav.appendChild(badge); }
    badge.classList.toggle('warn', warn); badge.textContent = count > 9 ? '9+' : String(count);
  }

  function refreshLobby600() {
    prepareLobbyShellOnly600();
    const daily = missionStats600('daily');
    const inv = inventoryStats600();
    setMetric600('missions', `${daily.completed} / ${daily.rows.length}`, daily.pct);
    setMetric600('inventory', `${inv.cards.length} / ${inv.cap}`, inv.cap ? inv.cards.length / inv.cap * 100 : 0);
    const total = Math.max(1, inv.cards.length); setMetric600('collection', `${inv.r} / ${inv.limited}`, Math.min(100, inv.r / total * 100));
    setMetric600('league', fmt600(user?.leagueScore), Math.min(100, n600(user?.leagueScore) / 10000000 * 100));
    ensureNavBadge600(2, inv.cards.length >= inv.cap * .9 ? 1 : 0, true);
    ensureNavBadge600(3, daily.ready, false);
    const favGroup = user?.profile?.favThemeSet?.split('||')?.[0] || user?.favoriteCard?.group;
    if (favGroup) applyAccent600(favGroup);
  }
  function prepareLobbyShellOnly600(){
    const root = $600('game-hud-wrapper'); if (!root) return;
    if (!$600('v600-season-mark')) root.insertAdjacentHTML('beforeend', `<div id="v600-season-mark" class="v600-season-mark"><i></i><span>LIVE SERVICE · COLLECTION SEASON</span></div>`);
    if (!$600('v600-lobby-status')) root.insertAdjacentHTML('beforeend', `<section id="v600-lobby-status" class="v600-lobby-status" aria-label="Player quick status"><div class="v600-lobby-metric" data-metric="missions"><span>Daily Missions</span><strong>0 / 0</strong><em><i></i></em></div><div class="v600-lobby-metric" data-metric="inventory"><span>Inventory</span><strong>0 / 300</strong><em><i></i></em></div><div class="v600-lobby-metric" data-metric="collection"><span>R / Limited</span><strong>0 / 0</strong><em><i></i></em></div><div class="v600-lobby-metric" data-metric="league"><span>Weekly Score</span><strong>0</strong><em><i></i></em></div></section>`);
  }

  /* MISSIONS */
  function decorateMissions600(tab = (typeof currentMissionTab !== 'undefined' ? currentMissionTab : 'daily')) {
    const list = $600('mission-list-container'); if (!list) return;
    let summary = $600('v600-mission-summary');
    if (!summary) {
      summary = document.createElement('div'); summary.id = 'v600-mission-summary'; summary.className = 'v600-mission-summary';
      list.parentNode.insertBefore(summary, list);
    }
    if (tab === 'event') { summary.style.display = 'none'; return; }
    summary.style.display = 'grid';
    const s = missionStats600(tab);
    summary.innerHTML = `<div class="v600-mission-ring" style="--pct:${s.pct * 3.6}deg"><b>${s.pct}%</b></div><div class="v600-mission-copy"><span>${String(tab).toUpperCase()} PROGRESS</span><strong>${s.completed} of ${s.rows.length} missions complete</strong><small>${s.ready ? `${s.ready} reward${s.ready === 1 ? '' : 's'} ready to claim.` : 'Keep progressing to unlock the next reward.'}</small></div><button class="v600-claim-next" onclick="v600ClaimNextMission()" ${s.ready ? '' : 'disabled'}>CLAIM NEXT</button>`;
  }
  window.v600ClaimNextMission = function () {
    const tab = typeof currentMissionTab !== 'undefined' ? currentMissionTab : 'daily';
    const s = missionStats600(tab);
    const next = s.rows.find(m => n600(user?.missionProgress?.[m.id]) >= n600(m.target) && !user?.missionClaimed?.[m.id]);
    if (!next) return showToast?.('No mission rewards are ready yet.');
    if (typeof executeClaimMission === 'function') executeClaimMission(tab, next.id);
    setTimeout(() => decorateMissions600(tab), 80);
  };

  /* SONG SELECT — presentation only */
  function storedSongRecord600(song) {
    const records = user?.songRecords || user?.records || {};
    const keys = [song?.id, `${song?.group}::${song?.title}`, song?.title].filter(Boolean);
    for (const k of keys) {
      const r = records[k]; if (r == null) continue;
      if (typeof r === 'number') return r;
      if (typeof r === 'object') return n600(r.highScore ?? r.score ?? r.best);
    }
    return 0;
  }
  function decorateTracklist600() {
    const list = $600('arcade-tracklist-container');
    if (!list || typeof arcadeSongs === 'undefined') return;
    list.innerHTML = arcadeSongs.map((song, i) => `<div class="arcade-track-item ${i === selectedArcadeSongIndex ? 'active' : ''}" onclick="selectArcadeTrack(${i})"><div class="v600-track-no">${String(i+1).padStart(2,'0')}</div><img src="${song.cover}" alt=""><div class="v600-track-meta"><strong>${String(song.title || 'TRACK')}</strong><span>${String(song.artist || song.group || 'ARTIST')} · ${n600(song.bpm) || '--'} BPM</span></div><div class="v600-track-badge">${String(song.group || 'MUSIC')}</div></div>`).join('');
  }
  function decorateSongSelect600() {
    const screen = $600('arcade-song-select'); if (!screen || typeof arcadeSongs === 'undefined') return;
    decorateTracklist600();
    let deck = $600('v600-deck-preview');
    const panel = screen.querySelector('.arcade-right');
    if (!deck && panel) { deck = document.createElement('section'); deck.id='v600-deck-preview'; deck.className='v600-deck-preview'; const diff = panel.querySelector('.arcade-diff-panel'); panel.insertBefore(deck, diff || null); }
    refreshSongDeck600();
  }
  function refreshSongDeck600() {
    if (typeof arcadeSongs === 'undefined') return;
    const song = arcadeSongs[selectedArcadeSongIndex]; if (!song) return;
    applyAccent600(song.group || song.artist);
    const deckRoot = $600('v600-deck-preview'); if (!deckRoot) return;
    const group = song.group;
    const groupKey = Object.keys(user?.deck || {}).find(k => key600(k) === key600(group));
    const deck = groupKey ? (user.deck[groupKey] || {}) : {};
    const members = (typeof themeDatabase !== 'undefined' && themeDatabase?.[group]?.members) || Object.keys(deck);
    const equipped = members.filter(m => Object.keys(deck).some(k => key600(k) === key600(m))).length;
    const themes = Object.values(deck).filter(Boolean).map(c => c.theme).filter(Boolean);
    const counts = {}; themes.forEach(t => counts[t] = (counts[t] || 0) + 1);
    const dominant = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Mixed / no theme';
    const cards = members.slice(0,7).map(member => {
      const mk = Object.keys(deck).find(k => key600(k) === key600(member)); const card = mk ? deck[mk] : null;
      if (!card) return `<div class="v600-mini-card empty">+</div>`;
      let src = card.url || ''; try { if (typeof getSmallCardUrl === 'function') src = getSmallCardUrl(card.url, card.grade, card.member, card.theme, card.group); } catch (_) {}
      return `<div class="v600-mini-card" title="${String(card.member || '')} · ${String(card.theme || '')}"><img src="${src}" alt=""></div>`;
    }).join('');
    deckRoot.innerHTML = `<div class="v600-deck-head"><div><span>ACTIVE DECK</span><strong>${String(group || 'GROUP')} · ${String(dominant)}</strong></div><b>${equipped} / ${members.length || equipped} EQUIPPED</b></div><div class="v600-deck-strip">${cards || '<div class="v600-mini-card empty">+</div>'}</div>`;
    const hs = $600('arcade-high-score'); if (hs) hs.textContent = storedSongRecord600(song).toLocaleString();
  }

  /* COLLECTION */
  function decorateCollection600() {
    const bar = $600('ss-right-header-bar'); if (!bar) return;
    if (!$600('v600-collection-actions')) {
      const actions = document.createElement('div'); actions.id='v600-collection-actions'; actions.className='v600-collection-actions';
      actions.innerHTML = `<button class="v600-collection-action primary" type="button" onclick="autoEquipSuperstar()">AUTO EQUIP BEST</button><button class="v600-collection-action" type="button" onclick="openThemeSelectorModal()">THEME SETS</button>`;
      bar.appendChild(actions);
    }
    let health = $600('v600-deck-health');
    if (!health) { health=document.createElement('div'); health.id='v600-deck-health'; health.className='v600-deck-health'; bar.appendChild(health); }
    const group = $600('ss-current-group-name')?.textContent?.trim();
    if (group && key600(group) !== 'group') applyAccent600(group);
    const groupKey = Object.keys(user?.deck || {}).find(k => key600(k) === key600(group));
    const deck = groupKey ? (user.deck[groupKey] || {}) : {};
    const members = (typeof themeDatabase !== 'undefined' && themeDatabase?.[group]?.members) || [];
    const eq = Object.values(deck).filter(Boolean).length;
    health.innerHTML = `<span>DECK READY</span><b>${eq}/${members.length || eq}</b>`;
  }

  /* SHOP */
  const SHOP_COPY_600 = {
    home:['STORE HOME','Featured packages and quick access to every shop category.'],event:['EVENT SHOP','Limited-time themes, profiles, and step-up packages.'],premium:['PREMIUM','High-grade packs and premium currency offers.'],wallpaper:['WALLPAPER','Lobby backgrounds and collectible visual skins.'],blackmarket:['BLACK MARKET','Rotating specialist offers and rare inventory.']
  };
  function decorateShop600(tab='home') {
    const modal = $600('shop-modal'); if (!modal) return;
    modal.dataset.v600Tab = tab;
    const shell = modal.querySelector('.shop-modal-v5') || modal.querySelector('.custom-modal'); if (!shell) return;
    let ctx = $600('v600-shop-context');
    if (!ctx) { ctx=document.createElement('div'); ctx.id='v600-shop-context'; ctx.className='v600-shop-context'; const tabs=shell.querySelector('.shop-tabs-v5') || shell.querySelector('.shop-tabs'); tabs?.insertAdjacentElement('afterend',ctx); }
    if (ctx) { const copy=SHOP_COPY_600[tab] || SHOP_COPY_600.home; const inv=inventoryStats600(); ctx.innerHTML=`<div><span>SHINING MARKET</span><strong>${copy[0]}</strong></div><p>${copy[1]}<br>Inventory ${inv.cards.length}/${inv.cap}</p>`; }
  }

  /* PROFILE */
  function decorateProfile600() {
    const shell = document.querySelector('#profile-modal .my-info-shell') || document.querySelector('#profile-modal .mi-shell'); if (!shell) return;
    let stats = $600('v600-profile-achievements'); if (!stats) { stats=document.createElement('section'); stats.id='v600-profile-achievements'; stats.className='v600-profile-achievements'; const grid=shell.querySelector('.my-info-grid'); shell.insertBefore(stats, grid || shell.firstChild?.nextSibling || null); }
    const inv=inventoryStats600(); const deckCount=Object.values(user?.deck || {}).reduce((sum,d)=>sum+Object.values(d||{}).filter(Boolean).length,0);
    stats.innerHTML=`<div><span>OWNED CARDS</span><strong>${fmt600(inv.cards.length)}</strong></div><div><span>R GRADE</span><strong>${fmt600(inv.r)}</strong></div><div><span>LIMITED</span><strong>${fmt600(inv.limited)}</strong></div><div><span>EQUIPPED</span><strong>${fmt600(deckCount)}</strong></div>`;
  }

  /* LEAGUE */
  function decorateLeague600() {
    const left=document.querySelector('#cyber-league-modal .league-left-panel'); if (!left) return;
    const allNames=[...qa600('.podium-name'),...qa600('.a-name')];
    const myName=String(typeof uid !== 'undefined' ? uid : 'GUEST');
    let rank=allNames.findIndex(el=>key600(el.textContent)===key600(myName))+1;
    if (!rank) rank='—';
    const scores=[...qa600('.podium-score'),...qa600('.a-score')].map(el=>n600(String(el.textContent).replace(/,/g,''))).filter(Number.isFinite);
    const myScore=n600(user?.leagueScore); const higher=scores.filter(s=>s>myScore).sort((a,b)=>a-b)[0]; const gap=higher ? Math.max(0,higher-myScore) : 0;
    const zone = typeof rank === 'number' ? (rank <= 6 ? 'PROMOTION' : rank >= 16 ? 'DEMOTION' : 'STAY') : 'UNRANKED';
    let root=$600('v600-league-summary'); if(!root){root=document.createElement('div');root.id='v600-league-summary';root.className='v600-league-summary';left.appendChild(root)}
    root.innerHTML=`<div class="${zone==='PROMOTION'?'promote':zone==='DEMOTION'?'demote':'stay'}"><span>CURRENT RANK</span><strong>#${rank}</strong></div><div><span>ZONE</span><strong>${zone}</strong></div><div><span>NEXT RIVAL GAP</span><strong>${gap?`+${fmt600(gap)}`:'TOP POSITION'}</strong></div><div><span>PLAYERS</span><strong>${allNames.length || '—'}</strong></div>`;
    const status=document.querySelector('.score-status'); if(status){status.textContent=zone==='PROMOTION'?'▲ PROMOTION ZONE':zone==='DEMOTION'?'▼ DEMOTION ZONE':'◆ SAFE ZONE';status.className=`score-status ${zone==='PROMOTION'?'status-promote':zone==='DEMOTION'?'status-demote':''}`}
  }

  /* SETTINGS */
  function applyUiPrefs600(){
    document.body.classList.toggle('v600-low-power',localStorage.getItem('shining_low_power')==='1');
    document.body.classList.toggle('v600-compact-ui',localStorage.getItem('shining_compact_ui')==='1');
  }
  window.v600SetUiMode=function(type,value){
    if(type==='power') localStorage.setItem('shining_low_power',value==='low'?'1':'0');
    if(type==='density') localStorage.setItem('shining_compact_ui',value==='compact'?'1':'0');
    applyUiPrefs600(); decorateSettings600(); showToast?.('Interface preference updated.');
  };
  function decorateSettings600(){
    const modal=$600('settings-modal')?.querySelector('.custom-modal'); if(!modal) return;
    let block=$600('v600-settings-extra'); if(!block){block=document.createElement('div');block.id='v600-settings-extra'; const logout=modal.querySelector('.btn-danger');modal.insertBefore(block,logout||null)}
    const low=document.body.classList.contains('v600-low-power'); const compact=document.body.classList.contains('v600-compact-ui');
    block.innerHTML=`<div class="v600-setting-row"><div><strong>RENDER MODE</strong><span>Reduce decorative blur and ambient effects on slower devices.</span></div><div class="v600-segment"><button class="${low?'':'active'}" onclick="v600SetUiMode('power','full')">FULL</button><button class="${low?'active':''}" onclick="v600SetUiMode('power','low')">LOW</button></div></div><div class="v600-setting-row"><div><strong>UI DENSITY</strong><span>Compact mode gives large inventories and menus more room.</span></div><div class="v600-segment"><button class="${compact?'':'active'}" onclick="v600SetUiMode('density','normal')">NORMAL</button><button class="${compact?'active':''}" onclick="v600SetUiMode('density','compact')">COMPACT</button></div></div>`;
  }

  /* WRAPPERS — only presentation surfaces. */
  const baseUpdateUI600 = typeof updateUI === 'function' ? updateUI : null;
  if (baseUpdateUI600) {
    const wrapped = function updateUIV600(){ const out=baseUpdateUI600.apply(this,arguments); try{refreshLobby600();decorateProfile600();decorateCollection600()}catch(e){console.debug('v600 ui refresh',e)} return out; };
    window.updateUI=wrapped; try{updateUI=wrapped}catch(_){}
  }
  const baseOpenMissions600 = typeof openMissionsModal === 'function' ? openMissionsModal : null;
  if(baseOpenMissions600){const wrapped=function(){const out=baseOpenMissions600.apply(this,arguments);setTimeout(()=>decorateMissions600(),0);return out};window.openMissionsModal=wrapped;try{openMissionsModal=wrapped}catch(_){}}
  const baseSwitchMissions600 = typeof switchMissionTab === 'function' ? switchMissionTab : null;
  if(baseSwitchMissions600){const wrapped=function(tab){const out=baseSwitchMissions600.apply(this,arguments);setTimeout(()=>decorateMissions600(tab),0);return out};window.switchMissionTab=wrapped;try{switchMissionTab=wrapped}catch(_){}}
  const baseOpenSong600 = typeof openSongSelect === 'function' ? openSongSelect : null;
  if(baseOpenSong600){const wrapped=function(){const out=baseOpenSong600.apply(this,arguments);setTimeout(decorateSongSelect600,0);return out};window.openSongSelect=wrapped;try{openSongSelect=wrapped}catch(_){}}
  const baseSelectSong600 = typeof selectArcadeTrack === 'function' ? selectArcadeTrack : null;
  if(baseSelectSong600){const wrapped=function(){const out=baseSelectSong600.apply(this,arguments);setTimeout(()=>{decorateTracklist600();refreshSongDeck600()},0);return out};window.selectArcadeTrack=wrapped;try{selectArcadeTrack=wrapped}catch(_){}}
  const baseRenderSongs600 = typeof renderArcadeTracklist === 'function' ? renderArcadeTracklist : null;
  if(baseRenderSongs600){const wrapped=function(){const out=baseRenderSongs600.apply(this,arguments);decorateTracklist600();return out};window.renderArcadeTracklist=wrapped;try{renderArcadeTracklist=wrapped}catch(_){}}
  const baseRenderCollection600 = typeof renderSuperstarUI === 'function' ? renderSuperstarUI : null;
  if(baseRenderCollection600){const wrapped=function(){const out=baseRenderCollection600.apply(this,arguments);setTimeout(decorateCollection600,0);return out};window.renderSuperstarUI=wrapped;try{renderSuperstarUI=wrapped}catch(_){}}
  const baseOpenShop600=typeof openShopModal==='function'?openShopModal:null;
  if(baseOpenShop600){const wrapped=function(){const out=baseOpenShop600.apply(this,arguments);setTimeout(()=>decorateShop600('home'),0);return out};window.openShopModal=wrapped;try{openShopModal=wrapped}catch(_){}}
  const baseSwitchShop600=typeof switchShopTab==='function'?switchShopTab:null;
  if(baseSwitchShop600){const wrapped=function(tab){const out=baseSwitchShop600.apply(this,arguments);setTimeout(()=>decorateShop600(tab),0);return out};window.switchShopTab=wrapped;try{switchShopTab=wrapped}catch(_){}}
  const baseOpenProfile600=typeof openProfileModal==='function'?openProfileModal:null;
  if(baseOpenProfile600){const wrapped=function(){const out=baseOpenProfile600.apply(this,arguments);setTimeout(decorateProfile600,0);return out};window.openProfileModal=wrapped;try{openProfileModal=wrapped}catch(_){}}
  const baseOpenLeague600=typeof openLeaderboard==='function'?openLeaderboard:null;
  if(baseOpenLeague600){const wrapped=async function(){const out=await baseOpenLeague600.apply(this,arguments);decorateLeague600();return out};window.openLeaderboard=wrapped;try{openLeaderboard=wrapped}catch(_){}}
  const baseOpenSettings600=typeof openSettings==='function'?openSettings:null;
  if(baseOpenSettings600){const wrapped=function(){const out=baseOpenSettings600.apply(this,arguments);setTimeout(decorateSettings600,0);return out};window.openSettings=wrapped;try{openSettings=wrapped}catch(_){}}

  function init600(){
    document.body.classList.add('shining-v600');
    applyUiPrefs600(); prepareLobby600(); decorateShop600('home'); decorateCollection600(); decorateSettings600();
    document.documentElement.dataset.shiningVersion='6.0.0';
  }
  document.addEventListener('DOMContentLoaded',init600);
  if(document.readyState!=='loading') init600();
})();


