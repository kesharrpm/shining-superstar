/* ========================================================================
 * SHINING SUPERSTAR 6.1.0 · IDENTITY + REVEAL + ARCADE PATCH
 * Presentation/features only. The music/rhythm PLAY engine is intentionally
 * not modified here.
 * ======================================================================== */
(() => {
  const $610 = (id) => document.getElementById(id);
  const q610 = (s, r=document) => r.querySelector(s);
  const qa610 = (s, r=document) => [...r.querySelectorAll(s)];
  const esc610 = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wait610 = (ms) => new Promise(r => setTimeout(r, ms));
  const today610 = () => new Date().toISOString().slice(0,10);

  function syncCurrency610() {
    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
    try {
      if (typeof uid !== 'undefined' && uid && typeof db !== 'undefined') {
        const payload={rp:user.rp,hp:user.hp,diamonds:user.diamonds}; if(user.starPass)payload.starPass=user.starPass; if(Array.isArray(user.inbox))payload.inbox=user.inbox; db.collection('users').doc(currentUserDocId()).update(payload).catch(()=>{});
      }
    } catch (_) {}
  }

  /* ----------------------- SHINING TOUR ----------------------- */
  function tourIcon610(type) {
    if (typeof ICON !== 'undefined') {
      if (type === 'RP') return ICON.rp;
      if (type === 'Diamonds') return ICON.diamond;
      if (type === 'LE_Pack') return ICON.pack;
      return ICON.star;
    }
    return '<span class="tour-fallback-icon">✦</span>';
  }

  window.updatePassUI = updatePassUI = function updateShiningTour610() {
    if (!user.starPass) user.starPass = { level:1, exp:0, isPremium:false, claimedFree:[], claimedPremium:[] };
    const lvl = Number(user.starPass.level || 1);
    const exp = Number(user.starPass.exp || 0);
    const req = lvl * 100;
    const lvlNode = $610('pass-current-lvl'); if (lvlNode) lvlNode.textContent = String(lvl).padStart(2,'0');
    const expNode = $610('pass-exp-text'); if (expNode) expNode.textContent = `${exp.toLocaleString()} / ${req.toLocaleString()} XP`;
    const fill = $610('pass-exp-fill'); if (fill) fill.style.width = `${Math.min(100,(exp/req)*100)}%`;
    const premium = $610('buy-premium-btn');
    if (premium) {
      premium.innerHTML = user.starPass.isPremium ? 'HEADLINER ACTIVE <b>✓</b>' : `HEADLINER ACCESS · 300 ${typeof ICON!=='undefined'?ICON.diamond:'◇'}`;
      premium.disabled = !!user.starPass.isPremium;
      premium.classList.toggle('owned',!!user.starPass.isPremium);
    }
    const list = $610('pass-tiers-container'); if (!list || typeof passRewards === 'undefined') return;
    list.innerHTML = passRewards.map(t => {
      const unlocked = lvl >= t.level;
      const fc = user.starPass.claimedFree?.includes(t.level);
      const pc = user.starPass.claimedPremium?.includes(t.level);
      const fState = fc ? 'claimed' : unlocked ? 'claimable' : 'locked';
      const pState = pc ? 'claimed' : unlocked && user.starPass.isPremium ? 'claimable' : 'locked';
      const fClick = (!fc && unlocked) ? `onclick="claimPassReward(${t.level},'free')"` : '';
      const pClick = (!pc && unlocked && user.starPass.isPremium) ? `onclick="claimPassReward(${t.level},'premium')"` : '';
      const milestone = t.level % 5 === 0 ? ' milestone' : '';
      return `<div class="tour-stop${milestone}${unlocked?' unlocked':''}">
        <button class="tour-reward ${fState}" ${fClick}>${tourIcon610(t.free.type)}<strong>${Number(t.free.amount).toLocaleString()}</strong><span>${t.free.type==='Diamonds'?'DIAMONDS':t.free.type}</span></button>
        <div class="tour-stop-node"><i></i><b>${String(t.level).padStart(2,'0')}</b></div>
        <button class="tour-reward premium ${pState}" ${pClick}>${tourIcon610(t.premium.type)}<strong>${Number(t.premium.amount).toLocaleString()}</strong><span>${t.premium.type==='LE_Pack'?'LIMITED PACK':t.premium.type}</span></button>
      </div>`;
    }).join('');
  };

  window.openStarPass = openStarPass = function openShiningTour610() {
    const modal=$610('star-pass-modal'); if(!modal) return;
    modal.classList.add('star-pass-fullscreen','shining-tour-v610');
    updatePassUI();
    modal.style.display='flex';
  };
  window.claimPassReward = claimPassReward = function claimTourReward610(level, track) {
    try { if (typeof playClickSound==='function') playClickSound(); } catch(_){}
    const tier = (typeof passRewards!=='undefined' ? passRewards : []).find(t=>Number(t.level)===Number(level)); if(!tier)return;
    const reward = track==='free' ? tier.free : tier.premium;
    if (reward.type==='RP') user.rp += Number(reward.amount||0);
    if (reward.type==='Diamonds') user.diamonds += Number(reward.amount||0);
    if (reward.type==='LE_Pack') {
      if(!Array.isArray(user.inbox))user.inbox=[];
      user.inbox.push({id:Date.now().toString(),title:`Shining Tour Lv ${level} Limited Reward`,type:'pack',packType:'le_guaranteed',grade:'R',amount:1});
      if(typeof openDynamicPack==='function')openDynamicPack('le_guaranteed',1,'R');
    } else if(typeof showToast==='function') showToast(`Claimed ${Number(reward.amount||0).toLocaleString()} ${reward.type}`);
    const key=track==='free'?'claimedFree':'claimedPremium'; if(!Array.isArray(user.starPass[key]))user.starPass[key]=[]; if(!user.starPass[key].includes(level))user.starPass[key].push(level);
    syncCurrency610(); updatePassUI();
  };


  window.buyPremiumPass = buyPremiumPass = function buyHeadliner610() {
    if (!user.starPass) user.starPass = { level:1, exp:0, isPremium:false, claimedFree:[], claimedPremium:[] };
    if (user.starPass.isPremium) return typeof showToast==='function' && showToast('Headliner Access is already active.');
    if (Number(user.diamonds||0) < 300) return typeof showToast==='function' && showToast('Not enough Diamonds.');
    user.diamonds -= 300; user.starPass.isPremium = true;
    if (typeof showToast==='function') showToast('HEADLINER ACCESS UNLOCKED');
    syncCurrency610(); updatePassUI();
  };

  /* ----------------------- PRISM PICK ----------------------- */
  const PRISM_REWARDS_610 = [
    {type:'RP',amount:5000,label:'RP',glyph:'g-rp'},
    {type:'Diamonds',amount:50,label:'DIAMONDS',glyph:'g-diamond'},
    {type:'HP',amount:15,label:'HP',glyph:'g-hp'}
  ];
  function prismStorageKey610(){ const who=(typeof uid!=='undefined'&&uid)?String(uid):'guest'; return `shining_prism_pick_${who}`; }
  function resetPrisms610() {
    qa610('#mg-grid .prism-capsule').forEach((c,i)=>{
      c.disabled=false; c.className='mg-card lucky-card prism-capsule';
      c.innerHTML=`<span class="prism-shell"><i>${String(i+1).padStart(2,'0')}</i></span>`;
    });
    const r=$610('mg-result-text'); if(r){r.style.display='none';r.innerHTML='';}
  }
  window.openMinigame = openMinigame = function openPrismPick610() {
    const modal=$610('minigame-modal'); if(!modal)return;
    window.minigamePlayedToday = localStorage.getItem(prismStorageKey610())===today610();
    resetPrisms610(); modal.classList.toggle('already-used',!!window.minigamePlayedToday); modal.style.display='flex';
    const r=$610('mg-result-text'); if(r&&window.minigamePlayedToday){r.innerHTML='<span>DAILY DROP</span><strong>COME BACK TOMORROW</strong>';r.style.display='flex';}
  };
  window.flipMinigameCard = flipMinigameCard = function prismPick610(element,index) {
    if (window.minigamePlayedToday) return typeof showToast==='function' && showToast('PRISM PICK is already used today.');
    if (!element || element.disabled) return;
    window.minigamePlayedToday=true; localStorage.setItem(prismStorageKey610(),today610());
    try { if(typeof playClickSound==='function') playClickSound(); } catch(_){}
    const rewards=[...PRISM_REWARDS_610].sort(()=>Math.random()-.5);
    const won=rewards[0];
    const cards=qa610('#mg-grid .prism-capsule'); cards.forEach(c=>c.disabled=true);
    element.classList.add('is-opening');
    setTimeout(()=>{
      element.classList.add('is-winner');
      element.innerHTML=`<span class="prism-reward"><i class="g ${won.glyph}"></i><strong>${Number(won.amount).toLocaleString()}</strong><small>${won.label}</small></span>`;
      if(won.type==='RP')user.rp+=won.amount; if(won.type==='Diamonds')user.diamonds+=won.amount; if(won.type==='HP')user.hp+=won.amount;
      syncCurrency610();
      const result=$610('mg-result-text'); if(result){result.innerHTML=`<span>PRISM ${String(index+1).padStart(2,'0')}</span><strong>${Number(won.amount).toLocaleString()} ${won.label}</strong>`;result.style.display='flex';}
    },360);
    setTimeout(()=>cards.forEach((c,i)=>{if(c===element)return;c.classList.add('is-dimmed');c.innerHTML=`<span class="prism-shell"><i>${String(i+1).padStart(2,'0')}</i></span>`;}),620);
  };

  /* ----------------------- CLEAN CARD PULL ----------------------- */
  const pull610={token:0,batch:[],cards:[],revealed:0};
  function cardUrl610(card){try{return typeof getLargeCardUrl==='function'?getLargeCardUrl(card?.url||'dynamic',card?.grade||'C',card?.member,card?.theme,card?.group):(card?.url||'');}catch(_){return card?.url||''}}
  function limited610(card){try{return typeof isLimitedTheme==='function'&&isLimitedTheme(card?.group,card?.theme)}catch(_){return false}}
  function sfx610(card){try{const a=(card?.grade==='R'||limited610(card))?sfxEpicReveal:card?.grade==='S'?sfxRareReveal:null;if(a){a.currentTime=0;a.volume=Math.min(1,Number(typeof globalSfxVolume!=='undefined'?globalSfxVolume:.55));a.play().catch(()=>{})}}catch(_){}}
  async function flipPull610(node,card,fast=false){if(!node||node.classList.contains('revealed')||node.classList.contains('flipping'))return;node.classList.add('flipping');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));node.classList.add('revealed');sfx610(card);if((card?.grade==='R'||limited610(card))&&typeof createRGradeBurst==='function'){try{createRGradeBurst(node)}catch(_){}}await wait610(fast?120:520);node.classList.remove('flipping');node.classList.add('settled');pull610.revealed++;}
  function setPullAction610(){const finish=$610('gacha-finish-btn'),next=$610('gacha-next-btn');if(next)next.style.display='none';if(!finish)return;const last=(currentGachaBatchIndex+1)*10>=fullPulledCardList.length;finish.textContent=last?'OK':'NEXT';finish.style.display='inline-flex';finish.onclick=()=>last?closeGachaStage():nextGachaBatch();}
  window.renderGachaBatch = renderGachaBatch = async function cleanPull610(){
    const overlay=$610('gacha-fullscreen-overlay'),grid=$610('draw-stage-cards'),finish=$610('gacha-finish-btn'),next=$610('gacha-next-btn');if(!overlay||!grid)return;
    const token=++pull610.token,start=currentGachaBatchIndex*10,batch=fullPulledCardList.slice(start,Math.min(start+10,fullPulledCardList.length));pull610.batch=batch;pull610.cards=[];pull610.revealed=0;
    overlay.className='v610-pull-theater';overlay.classList.toggle('small',batch.length<=3);overlay.classList.toggle('single',batch.length===1);overlay.style.display='flex';
    overlay.querySelector('.r-pack-wow-banner')?.remove(); const header=overlay.querySelector('.gacha-overlay-header');if(header){header.innerHTML='';header.setAttribute('aria-hidden','true')}
    grid.innerHTML='';if(finish)finish.style.display='none';if(next)next.style.display='none';
    batch.forEach((card,i)=>{const button=document.createElement('button');button.type='button';button.className=`v610-pull-card grade-${String(card?.grade||'c').toLowerCase()}${limited610(card)?' limited':''}`;button.innerHTML=`<span class="v610-pull-glow"></span><span class="v610-pull-rotor"><span class="v610-pull-back"><i>✦</i></span><span class="v610-pull-front"><img src="${esc610(cardUrl610(card))}" alt="Card" draggable="false"><b class="v610-img-fallback">✦</b></span></span>`;const img=button.querySelector('img');if(img)img.onerror=()=>{img.style.display='none';button.querySelector('.v610-img-fallback')?.classList.add('show')};button.onclick=()=>flipPull610(button,card);grid.appendChild(button);pull610.cards.push(button);setTimeout(()=>{if(token===pull610.token)button.classList.add('dealt')},70+i*55)});
    await wait610(Math.min(680,380+batch.length*28));
    for(let i=0;i<pull610.cards.length;i++){if(token!==pull610.token)return;await flipPull610(pull610.cards[i],batch[i]);await wait610(batch.length<=3?100:48)}
    if(token===pull610.token)setPullAction610();
  };
  const closePull610=typeof closeGachaStage==='function'?closeGachaStage:null;
  if(closePull610){window.closeGachaStage=closeGachaStage=function(){pull610.token++;return closePull610.apply(this,arguments)}}

  /* ----------------------- EVENT SHOP LAYOUT FIX ----------------------- */
  function fixEventPurchaseUI610(root=document){
    qa610('[onclick*="buySpecialEventPack"]',root).forEach(btn=>{
      const oc=btn.getAttribute('onclick')||''; if(!/buySpecialEventPack\(['\"]PROFILE['\"]/.test(oc))return;
      qa610('.ep-badge,.ep-badge-v2',btn).forEach(x=>x.remove());
      btn.classList.add('v610-profile-price');
      const offer=btn.closest('.event-profile-offer'); if(!offer)return;
      let chip=offer.querySelector('.v610-one-time-chip');
      if(!chip){chip=document.createElement('span');chip.className='v610-one-time-chip';chip.textContent='ONE-TIME';const copy=offer.querySelector('.event-offer-copy');(copy||offer).appendChild(chip)}
    });
  }
  const baseInject610=typeof injectEventPointBadges==='function'?injectEventPointBadges:null;
  if(baseInject610){window.injectEventPointBadges=injectEventPointBadges=function(){const out=baseInject610.apply(this,arguments);fixEventPurchaseUI610();return out}}
  const baseSwitchShop610=typeof switchShopTab==='function'?switchShopTab:null;
  if(baseSwitchShop610){window.switchShopTab=switchShopTab=function(){const out=baseSwitchShop610.apply(this,arguments);setTimeout(()=>fixEventPurchaseUI610($610('shop-modal')||document),20);return out}}

  /* ----------------------- ARCADE HUB ----------------------- */
  const arcade610={memory:{open:[],matched:0,moves:0,busy:false,start:0},rush:{score:0,time:15,timer:null,tick:null,running:false}};
  function ensureArcade610(){
    let modal=$610('shining-arcade-hub'); if(modal)return modal;
    modal=document.createElement('div');modal.id='shining-arcade-hub';modal.className='custom-modal-overlay v610-arcade-overlay';modal.style.display='none';
    modal.innerHTML=`<div class="v610-arcade-shell"><button class="close-btn" onclick="closeArcade610()">×</button><header class="v610-arcade-head"><div><span>SHINING // SIDE STAGE</span><h2>ARCADE</h2><p>Quick games, daily drops, and score challenges. No rhythm stage required.</p></div><div class="v610-arcade-token"><small>ARCADE RECORDS</small><strong id="v610-arcade-record">READY</strong></div></header><nav class="v610-arcade-tabs"><button class="active" data-mode="home" onclick="showArcadeMode610('home',this)">LOBBY</button><button data-mode="memory" onclick="showArcadeMode610('memory',this)">MEMORY GRID</button><button data-mode="rush" onclick="showArcadeMode610('rush',this)">LIGHT RUSH</button></nav><main id="v610-arcade-body" class="v610-arcade-body"></main></div>`;
    document.body.appendChild(modal);return modal;
  }
  function arcadeHome610(){
    const mem=Number(localStorage.getItem('shining_arcade_memory_best')||0),rush=Number(localStorage.getItem('shining_arcade_rush_best')||0);
    return `<div class="v610-arcade-cards"><button class="v610-arcade-mode prism" onclick="openMinigame();"><span>DAILY</span><strong>PRISM PICK</strong><p>Choose one prism and claim its daily drop.</p><i>OPEN →</i></button><button class="v610-arcade-mode memory" onclick="showArcadeMode610('memory')"><span>PUZZLE</span><strong>MEMORY GRID</strong><p>Match six pairs in as few moves as possible.</p><i>${mem?`BEST ${mem} MOVES`:'START →'}</i></button><button class="v610-arcade-mode rush" onclick="showArcadeMode610('rush')"><span>SCORE ATTACK</span><strong>LIGHT RUSH</strong><p>Hit the live cell before it moves. Fifteen seconds.</p><i>${rush?`BEST ${rush}`:'START →'}</i></button></div>`;
  }
  function memoryGlyphs610(){return ['✦','◇','R','S','A','★'].flatMap(x=>[x,x]).sort(()=>Math.random()-.5)}
  function renderMemory610(){const g=memoryGlyphs610();arcade610.memory={open:[],matched:0,moves:0,busy:false,start:Date.now()};return `<section class="v610-game-panel"><div class="v610-game-top"><div><span>MEMORY GRID</span><strong>Find every pair</strong></div><b id="v610-memory-moves">0 MOVES</b></div><div class="v610-memory-grid">${g.map((x,i)=>`<button data-symbol="${esc610(x)}" data-index="${i}" onclick="memoryPick610(this)"><span>✦</span><b>${esc610(x)}</b></button>`).join('')}</div><div class="v610-game-status" id="v610-memory-status">6 pairs remaining</div></section>`}
  window.memoryPick610=function(btn){const s=arcade610.memory;if(s.busy||btn.classList.contains('matched')||btn.classList.contains('open'))return;btn.classList.add('open');s.open.push(btn);if(s.open.length<2)return;s.moves++;const m=$610('v610-memory-moves');if(m)m.textContent=`${s.moves} MOVES`;const [a,b]=s.open;if(a.dataset.symbol===b.dataset.symbol){a.classList.add('matched');b.classList.add('matched');s.matched++;s.open=[];const st=$610('v610-memory-status');if(st)st.textContent=`${6-s.matched} pairs remaining`;if(s.matched===6){const best=Number(localStorage.getItem('shining_arcade_memory_best')||0);if(!best||s.moves<best)localStorage.setItem('shining_arcade_memory_best',String(s.moves));if(st)st.innerHTML=`CLEAR · <strong>${s.moves} MOVES</strong>`;}}else{s.busy=true;setTimeout(()=>{a.classList.remove('open');b.classList.remove('open');s.open=[];s.busy=false},520)}};
  function renderRush610(){arcade610.rush.score=0;arcade610.rush.time=15;return `<section class="v610-game-panel"><div class="v610-game-top"><div><span>LIGHT RUSH</span><strong>Hit the live cell</strong></div><b><span id="v610-rush-time">15</span>s · <span id="v610-rush-score">0</span> pts</b></div><div class="v610-rush-grid" id="v610-rush-grid">${Array.from({length:16},(_,i)=>`<button data-cell="${i}" onclick="rushHit610(this)"></button>`).join('')}</div><button class="v610-rush-start" id="v610-rush-start" onclick="startRush610()">START RUN</button></section>`}
  function moveRush610(){const cells=qa610('#v610-rush-grid button');cells.forEach(c=>c.classList.remove('live'));if(!cells.length)return;cells[Math.floor(Math.random()*cells.length)].classList.add('live')}
  window.startRush610=function(){const s=arcade610.rush;if(s.running)return;s.running=true;s.score=0;s.time=15;const start=$610('v610-rush-start');if(start){start.disabled=true;start.textContent='RUNNING'};moveRush610();s.tick=setInterval(moveRush610,620);s.timer=setInterval(()=>{s.time--;const t=$610('v610-rush-time');if(t)t.textContent=s.time;if(s.time<=0){clearInterval(s.tick);clearInterval(s.timer);s.running=false;qa610('#v610-rush-grid button').forEach(c=>c.classList.remove('live'));const best=Number(localStorage.getItem('shining_arcade_rush_best')||0);if(s.score>best)localStorage.setItem('shining_arcade_rush_best',String(s.score));if(start){start.disabled=false;start.textContent=`RUN COMPLETE · ${s.score}`}}},1000)};
  window.rushHit610=function(btn){const s=arcade610.rush;if(!s.running||!btn.classList.contains('live'))return;s.score++;btn.classList.remove('live');const score=$610('v610-rush-score');if(score)score.textContent=s.score;moveRush610()};
  window.showArcadeMode610=function(mode='home',tab){const modal=ensureArcade610(),body=$610('v610-arcade-body');qa610('.v610-arcade-tabs button',modal).forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));if(tab?.dataset?.mode)mode=tab.dataset.mode;if(mode==='memory')body.innerHTML=renderMemory610();else if(mode==='rush')body.innerHTML=renderRush610();else body.innerHTML=arcadeHome610()};
  window.openArcade610=function(){const modal=ensureArcade610();modal.style.display='flex';showArcadeMode610('home')};
  window.closeArcade610=function(){const s=arcade610.rush;if(s.timer)clearInterval(s.timer);if(s.tick)clearInterval(s.tick);s.running=false;const modal=$610('shining-arcade-hub');if(modal)modal.style.display='none'};

  function injectArcadeButton610(){
    const left=q610('.hud-side-panel.left');if(left&&!$610('v610-arcade-button')){const b=document.createElement('button');b.id='v610-arcade-button';b.className='hud-side-btn v610-arcade-launch';b.innerHTML='<i class="g g-star"></i> Arcade';b.onclick=()=>openArcade610();left.appendChild(b)}
    const banner=q610('.star-pass-banner');if(banner){banner.classList.add('shining-tour-banner');const text=banner.querySelector('.hud-banner-text');if(text)text.innerHTML='SHINING<br>TOUR'}
  }

  /* Card Book: consistent deck rail instead of a crooked fan. */
  function fixCardBook610(){const modal=$610('cardbook-modal');if(modal)modal.classList.add('v610-cardbook');}

  function init610(){
    document.body.classList.add('shining-v610');document.documentElement.dataset.shiningVersion='6.1.0';
    injectArcadeButton610();ensureArcade610();fixEventPurchaseUI610();fixCardBook610();
    const shop=$610('shop-tab-event');if(shop)new MutationObserver(()=>fixEventPurchaseUI610(shop)).observe(shop,{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',init610);if(document.readyState!=='loading')init610();
})();

