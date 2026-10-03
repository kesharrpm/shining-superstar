/* ========================================================================
 * SHINING SUPERSTAR 6.2.0 · ARCADE LAB + SPOTLIGHT BOARD + SHINING CIRCUIT
 * Live-service presentation/features only. Rhythm PLAY functions untouched.
 * ======================================================================== */
(() => {
  const $620 = (id) => document.getElementById(id);
  const q620 = (s, r=document) => r.querySelector(s);
  const qa620 = (s, r=document) => [...r.querySelectorAll(s)];
  const esc620 = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp620 = (v,a,b) => Math.max(a, Math.min(b, Number(v)||0));
  const shuffle620 = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const fmt620 = (n) => Number(n||0).toLocaleString();

  /* ----------------------- PERIOD / RESET HELPERS ----------------------- */
  function dateKey620(d=new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function monday620(d=new Date()) { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }
  function cycleKey620(tab,d=new Date()) {
    if(tab==='daily') return dateKey620(d);
    if(tab==='weekly') return dateKey620(monday620(d));
    if(tab==='monthly') return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return 'event';
  }
  function nextBoundary620(tab, now=new Date()) {
    if(tab==='daily') return new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0,0);
    if(tab==='weekly') { const m=monday620(now); return new Date(m.getFullYear(),m.getMonth(),m.getDate()+7,0,0,0,0); }
    if(tab==='monthly') return new Date(now.getFullYear(),now.getMonth()+1,1,0,0,0,0);
    return null;
  }
  function countdown620(tab) {
    const target=nextBoundary620(tab); if(!target) return 'LIVE';
    let ms=Math.max(0,target-Date.now()), s=Math.floor(ms/1000);
    const d=Math.floor(s/86400); s%=86400; const h=Math.floor(s/3600); s%=3600; const m=Math.floor(s/60); const sec=s%60;
    return d>0 ? `${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M` : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  function hash620(str){ let h=2166136261; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
  function cyclePick620(pool,key,count){ return [...pool].sort((a,b)=>hash620(`${key}|${a.id}`)-hash620(`${key}|${b.id}`)).slice(0,count).map(x=>({...x,reward:{...x.reward}})); }

  /* ----------------------- SPOTLIGHT BOARD ----------------------- */
  const missionPools620 = {
    daily: [
      {id:'sd_checkin',action:'login',target:1,title:'Doors Open',desc:'Check in for today’s call sheet.',kind:'CHECK-IN',reward:{type:'rp',amt:5000,icon:'✦',color:'#76e7dc'}},
      {id:'sd_soundcheck',action:'play',target:2,title:'Soundcheck',desc:'Clear 2 music stages today.',kind:'STAGE',reward:{type:'diamond',amt:15,icon:'◇',color:'#75dfff'}},
      {id:'sd_freshsleeve',action:'pull',target:2,title:'Fresh Sleeves',desc:'Obtain 2 cards from packs.',kind:'COLLECT',reward:{type:'rp',amt:7000,icon:'✦',color:'#ff7fa3'}},
      {id:'sd_cardlab',action:'powerup',target:1,title:'Card Lab',desc:'Attempt a card Power Up.',kind:'TRAIN',reward:{type:'rp',amt:8000,icon:'✦',color:'#f5d36c'}},
      {id:'sd_sidestage',action:'arcade',target:1,title:'Side Stage Visit',desc:'Finish any Arcade game.',kind:'ARCADE',reward:{type:'diamond',amt:10,icon:'◇',color:'#aa91ff'}},
      {id:'sd_signal',action:'card_quiz_correct',target:3,title:'Face Check',desc:'Get 3 CARD SIGNAL answers correct.',kind:'ARCADE',reward:{type:'rp',amt:6000,icon:'✦',color:'#aa91ff'}},
      {id:'sd_grid',action:'memory_clear',target:1,title:'Perfect Recall',desc:'Clear MEMORY GRID once.',kind:'ARCADE',reward:{type:'diamond',amt:12,icon:'◇',color:'#69ece6'}},
      {id:'sd_prism',action:'prism_pick',target:1,title:'Prism Appointment',desc:'Open today’s PRISM PICK.',kind:'ARCADE',reward:{type:'rp',amt:5000,icon:'✦',color:'#69ece6'}},
      {id:'sd_track',action:'track_quiz_correct',target:3,title:'Track Check',desc:'Get 3 TRACK CODE answers correct.',kind:'ARCADE',reward:{type:'rp',amt:6000,icon:'✦',color:'#ff91d2'}}
    ],
    weekly: [
      {id:'sw_set',action:'play',target:15,title:'Full Set',desc:'Clear 15 music stages this week.',kind:'STAGE',reward:{type:'diamond',amt:120,icon:'◇',color:'#75dfff'}},
      {id:'sw_scout',action:'pull',target:20,title:'Casting Week',desc:'Obtain 20 cards from packs.',kind:'COLLECT',reward:{type:'pack',amt:1,packType:'premium',icon:'▣',color:'#aa91ff'}},
      {id:'sw_training',action:'powerup',target:8,title:'Training Block',desc:'Attempt 8 card Power Ups.',kind:'TRAIN',reward:{type:'diamond',amt:80,icon:'◇',color:'#f5d36c'}},
      {id:'sw_arcade',action:'arcade',target:7,title:'Arcade Regular',desc:'Finish 7 Arcade runs.',kind:'ARCADE',reward:{type:'diamond',amt:70,icon:'◇',color:'#aa91ff'}},
      {id:'sw_signal',action:'card_quiz_correct',target:20,title:'Roster Memory',desc:'Get 20 CARD SIGNAL answers correct.',kind:'ARCADE',reward:{type:'rp',amt:40000,icon:'✦',color:'#69ece6'}},
      {id:'sw_theme',action:'theme_break_correct',target:12,title:'Theme Director',desc:'Find 12 odd cards in THEME BREAK.',kind:'ARCADE',reward:{type:'diamond',amt:65,icon:'◇',color:'#ff91d2'}},
      {id:'sw_track',action:'track_quiz_correct',target:15,title:'Music Desk',desc:'Get 15 TRACK CODE answers correct.',kind:'ARCADE',reward:{type:'rp',amt:35000,icon:'✦',color:'#75dfff'}},
      {id:'sw_memory',action:'memory_clear',target:3,title:'Memory Run',desc:'Clear MEMORY GRID 3 times.',kind:'ARCADE',reward:{type:'rp',amt:30000,icon:'✦',color:'#69ece6'}},
      {id:'sw_rush',action:'light_rush_clear',target:3,title:'Reaction Block',desc:'Finish LIGHT RUSH 3 times.',kind:'ARCADE',reward:{type:'diamond',amt:55,icon:'◇',color:'#ff7fa3'}}
    ],
    monthly: [
      {id:'sm_headliner',action:'play',target:60,title:'Headliner Month',desc:'Clear 60 music stages this month.',kind:'STAGE',reward:{type:'diamond',amt:600,icon:'◇',color:'#75dfff'}},
      {id:'sm_archive',action:'pull',target:75,title:'Archive Expansion',desc:'Obtain 75 cards from packs.',kind:'COLLECT',reward:{type:'pack',amt:3,packType:'premium',icon:'▣',color:'#aa91ff'}},
      {id:'sm_workshop',action:'powerup',target:30,title:'Card Workshop',desc:'Attempt 30 card Power Ups.',kind:'TRAIN',reward:{type:'diamond',amt:350,icon:'◇',color:'#f5d36c'}},
      {id:'sm_arcade',action:'arcade',target:25,title:'Side Stage Resident',desc:'Finish 25 Arcade runs.',kind:'ARCADE',reward:{type:'diamond',amt:300,icon:'◇',color:'#aa91ff'}},
      {id:'sm_signal',action:'card_quiz_correct',target:60,title:'Roster Specialist',desc:'Get 60 CARD SIGNAL answers correct.',kind:'ARCADE',reward:{type:'rp',amt:150000,icon:'✦',color:'#69ece6'}},
      {id:'sm_theme',action:'theme_break_correct',target:40,title:'Theme Curator',desc:'Find 40 odd cards in THEME BREAK.',kind:'ARCADE',reward:{type:'diamond',amt:250,icon:'◇',color:'#ff91d2'}},
      {id:'sm_track',action:'track_quiz_correct',target:50,title:'Track Archivist',desc:'Get 50 TRACK CODE answers correct.',kind:'ARCADE',reward:{type:'rp',amt:120000,icon:'✦',color:'#75dfff'}},
      {id:'sm_memory',action:'memory_clear',target:10,title:'Memory Season',desc:'Clear MEMORY GRID 10 times.',kind:'ARCADE',reward:{type:'diamond',amt:220,icon:'◇',color:'#69ece6'}}
    ]
  };
  const missionCounts620={daily:5,weekly:5,monthly:4};
  const periodNames620={daily:'DAILY CALLS',weekly:'WEEKLY SETLIST',monthly:'MONTHLY HEADLINER'};

  function saveMissionState620(){
    try {
      if(typeof uid!=='undefined'&&uid&&typeof db!=='undefined') db.collection('users').doc(currentUserDocId()).update({missionProgress:user.missionProgress||{},missionClaimed:user.missionClaimed||{},missionCycles:user.missionCycles||{}}).catch(()=>{});
    } catch(_){}
  }
  function installMissionSet620(tab){
    if(typeof missionDB==='undefined'||!missionPools620[tab]) return;
    missionDB[tab]=cyclePick620(missionPools620[tab],cycleKey620(tab),missionCounts620[tab]);
  }
  function resetMissionPool620(tab){
    if(!user.missionProgress)user.missionProgress={}; if(!user.missionClaimed)user.missionClaimed={};
    (missionPools620[tab]||[]).forEach(m=>{delete user.missionProgress[m.id];delete user.missionClaimed[m.id];});
  }
  function ensureMissionRefresh620(){
    if(typeof user==='undefined'||typeof missionDB==='undefined')return false;
    if(!user.missionProgress)user.missionProgress={}; if(!user.missionClaimed)user.missionClaimed={}; if(!user.missionCycles)user.missionCycles={};
    let changed=false;
    ['daily','weekly','monthly'].forEach(tab=>{
      const key=cycleKey620(tab),old=user.missionCycles[tab];
      if(old&&old!==key){resetMissionPool620(tab);changed=true;}
      if(old!==key){user.missionCycles[tab]=key;changed=true;}
      installMissionSet620(tab);
    });
    // A login mission in the active daily sheet should credit today's login automatically.
    const login=(missionDB.daily||[]).find(m=>m.action==='login');
    if(login&&!user.missionClaimed[login.id]&&Number(user.missionProgress[login.id]||0)<1){user.missionProgress[login.id]=1;changed=true;}
    if(changed)saveMissionState620();
    return changed;
  }
  function rewardLabel620(r={}){
    if(r.type==='diamond')return `${fmt620(r.amt)} DIAMONDS`;
    if(r.type==='rp')return `${fmt620(r.amt)} RP`;
    if(r.type==='pack')return `${fmt620(r.amt)} PREMIUM PACK${Number(r.amt)===1?'':'S'}`;
    return `${fmt620(r.amt)} ${String(r.type||'REWARD').toUpperCase()}`;
  }
  function missionStats620(tab){
    const rows=missionDB?.[tab]||[],p=user.missionProgress||{},c=user.missionClaimed||{};
    const ready=rows.filter(m=>Number(p[m.id]||0)>=Number(m.target||1)&&!c[m.id]).length;
    const done=rows.filter(m=>c[m.id]).length;
    return {rows,ready,done,pct:rows.length?Math.round(done/rows.length*100):0};
  }
  function renderSpotlight620(tab){
    ensureMissionRefresh620();
    const list=$620('mission-list-container'); if(!list)return;
    q620('#v600-mission-summary')?.remove();
    const s=missionStats620(tab),key=cycleKey620(tab);
    list.innerHTML=`
      <section class="v620-spotlight-overview">
        <div class="v620-spotlight-period"><span>${periodNames620[tab]}</span><strong>${s.done}/${s.rows.length} CLEARED</strong><small>CYCLE ${esc620(key)}</small></div>
        <div class="v620-spotlight-progress"><i style="width:${s.pct}%"></i></div>
        <div class="v620-spotlight-reset"><span>REFRESH IN</span><strong data-mission-countdown="${tab}">${countdown620(tab)}</strong>${s.ready?`<button onclick="v620ClaimReady('${tab}')">CLAIM ${s.ready} READY</button>`:''}</div>
      </section>
      <div class="v620-mission-stack">${s.rows.map((m,i)=>{
        const progress=Math.min(Number(m.target||1),Number(user.missionProgress?.[m.id]||0)),ready=progress>=m.target,claimed=!!user.missionClaimed?.[m.id],pct=clamp620(progress/m.target*100,0,100);
        return `<article class="v620-mission-card ${claimed?'claimed':ready?'ready':''}">
          <div class="v620-mission-index">${String(i+1).padStart(2,'0')}</div>
          <div class="v620-mission-main"><div class="v620-mission-topline"><span>${esc620(m.kind||'TASK')}</span>${claimed?'<b>CLEARED</b>':ready?'<b>READY</b>':''}</div><h3>${esc620(m.title)}</h3><p>${esc620(m.desc)}</p><div class="v620-mission-meter"><i style="width:${pct}%"></i><span>${fmt620(progress)} / ${fmt620(m.target)}</span></div></div>
          <div class="v620-mission-reward" style="--reward:${esc620(m.reward?.color||'#9aa4b7')}"><span>${m.reward?.icon||'✦'}</span><small>REWARD</small><strong>${esc620(rewardLabel620(m.reward))}</strong>${claimed?'<button disabled>CLAIMED</button>':ready?`<button onclick="executeClaimMission('${tab}','${m.id}')">CLAIM</button>`:'<button disabled>IN PROGRESS</button>'}</div>
        </article>`;
      }).join('')}</div>`;
  }
  window.v620ClaimReady=function(tab){
    ensureMissionRefresh620();
    const next=(missionDB?.[tab]||[]).find(m=>Number(user.missionProgress?.[m.id]||0)>=Number(m.target||1)&&!user.missionClaimed?.[m.id]);
    if(next&&typeof executeClaimMission==='function')executeClaimMission(tab,next.id); else if(typeof showToast==='function')showToast('No Spotlight rewards are ready.');
  };

  const prevTrack620=typeof trackMissionProgress==='function'?trackMissionProgress:null;
  if(prevTrack620){window.trackMissionProgress=trackMissionProgress=function(action,amount=1,context={}){ensureMissionRefresh620();return prevTrack620.call(this,action,amount,context);};}
  const prevClaim620=typeof executeClaimMission==='function'?executeClaimMission:null;
  if(prevClaim620){window.executeClaimMission=executeClaimMission=function(tab,id){const out=prevClaim620.call(this,tab,id);saveMissionState620();setTimeout(()=>{if(['daily','weekly','monthly'].includes(tab))renderSpotlight620(tab);},0);return out;};}
  const prevSwitch620=typeof switchMissionTab==='function'?switchMissionTab:null;
  if(prevSwitch620){window.switchMissionTab=switchMissionTab=function(tab){ensureMissionRefresh620();currentMissionTab=tab;qa620('.m-tab').forEach(t=>t.classList.toggle('active',(t.getAttribute('onclick')||'').includes(`'${tab}'`)));if(['daily','weekly','monthly'].includes(tab)){renderSpotlight620(tab);return;}return prevSwitch620.call(this,tab);};}
  const prevOpenMissions620=typeof openMissionsModal==='function'?openMissionsModal:null;
  if(prevOpenMissions620){window.openMissionsModal=openMissionsModal=function(){ensureMissionRefresh620();const out=prevOpenMissions620.apply(this,arguments);setTimeout(()=>switchMissionTab(typeof currentMissionTab!=='undefined'?currentMissionTab:'daily'),0);return out;};}

  /* ----------------------- ARCADE DATA GAMES ----------------------- */
  function realCards620(){return (user?.inventory||[]).filter(c=>c&&c.type!=='material'&&c.group&&c.member&&c.theme);}
  function cardUrl620(card){try{return typeof getLargeCardUrl==='function'?getLargeCardUrl(card?.url||'dynamic',card?.grade||'C',card?.member,card?.theme,card?.group):(card?.url||'');}catch(_){return card?.url||'';}}
  function record620(key){return Number(localStorage.getItem(`shining_arcade_${key}_best`)||0);}
  function saveRecord620(key,score,higher=true){const old=record620(key);if((higher&&score>old)||(!higher&&(!old||score<old)))localStorage.setItem(`shining_arcade_${key}_best`,String(score));}
  function logArcade620(action,correct=0){try{if(typeof trackMissionProgress==='function'){trackMissionProgress('arcade',1);if(action&&correct>0)trackMissionProgress(action,correct);}}catch(_){} }
  const game620={signal:null,theme:null,track:null};
  function arcadeBody620(){return $620('v610-arcade-body');}
  function setArcadeTabs620(mode){const nav=q620('#shining-arcade-hub .v610-arcade-tabs');if(!nav)return;nav.innerHTML=`<button data-mode="home" onclick="showArcadeMode610('home',this)">LOBBY</button><button data-mode="signal" onclick="showArcadeMode610('signal',this)">CARD SIGNAL</button><button data-mode="theme" onclick="showArcadeMode610('theme',this)">THEME BREAK</button><button data-mode="track" onclick="showArcadeMode610('track',this)">TRACK CODE</button><button data-mode="memory" onclick="showArcadeMode610('memory',this)">MEMORY GRID</button><button data-mode="rush" onclick="showArcadeMode610('rush',this)">LIGHT RUSH</button>`;qa620('button',nav).forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));}
  function upgradeArcadeShell620(){const modal=$620('shining-arcade-hub');if(!modal)return;modal.classList.add('v620-arcade');const head=q620('.v610-arcade-head',modal);if(head){const kicker=q620('div:first-child > span',head);if(kicker)kicker.textContent='SHINING // ARCADE LAB';const p=q620('div:first-child > p',head);if(p)p.textContent='Collection-driven games, music quizzes, daily drops, and score attacks.';} }
  function arcadeHome620(){
    const body=arcadeBody620();if(!body)return;
    const who=(typeof uid!=='undefined'&&uid)?String(uid):'guest'; const prismUsed=localStorage.getItem(`shining_prism_pick_${who}`)===dateKey620();
    body.innerHTML=`<div class="v620-arcade-grid">
      <button class="v620-game-card prism" onclick="openMinigame()"><span>DAILY DROP</span><strong>PRISM PICK</strong><p>Choose one prism. One claim every day.</p><i>${prismUsed?'USED TODAY':'OPEN DROP →'}</i></button>
      <button class="v620-game-card signal" onclick="showArcadeMode610('signal')"><span>YOUR COLLECTION</span><strong>CARD SIGNAL</strong><p>Identify members from cards you actually own.</p><i>${record620('signal')?`BEST ${fmt620(record620('signal'))}`:'START QUIZ →'}</i></button>
      <button class="v620-game-card theme" onclick="showArcadeMode610('theme')"><span>THEME PUZZLE</span><strong>THEME BREAK</strong><p>Three cards match. Find the one that breaks the set.</p><i>${record620('theme')?`BEST ${fmt620(record620('theme'))}`:'START PUZZLE →'}</i></button>
      <button class="v620-game-card track" onclick="showArcadeMode610('track')"><span>MUSIC DATABASE</span><strong>TRACK CODE</strong><p>Match song titles to the correct artist or group.</p><i>${record620('track')?`BEST ${fmt620(record620('track'))}`:'START QUIZ →'}</i></button>
      <button class="v620-game-card memory" onclick="showArcadeMode610('memory')"><span>PUZZLE</span><strong>MEMORY GRID</strong><p>Clear all pairs in the fewest moves.</p><i>${record620('memory')?`BEST ${fmt620(record620('memory'))} MOVES`:'START GRID →'}</i></button>
      <button class="v620-game-card rush" onclick="showArcadeMode610('rush')"><span>SCORE ATTACK</span><strong>LIGHT RUSH</strong><p>Hit the live cell before the signal moves.</p><i>${record620('rush')?`BEST ${fmt620(record620('rush'))}`:'START RUN →'}</i></button>
    </div>`;
  }

  function uniqueChoices620(values,target,count=4){const clean=[...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))].filter(x=>x!==target);return shuffle620(clean).slice(0,count-1).concat([target]).sort(()=>Math.random()-.5);}
  function renderNoData620(title,msg){const body=arcadeBody620();if(body)body.innerHTML=`<section class="v620-no-data"><span>ARCADE LAB</span><h3>${esc620(title)}</h3><p>${esc620(msg)}</p><button onclick="showArcadeMode610('home')">BACK TO LOBBY</button></section>`;}

  function startSignal620(){
    const pool=realCards620(),members=[...new Set(pool.map(c=>c.member))];
    if(pool.length<4||members.length<4)return renderNoData620('CARD SIGNAL LOCKED','Collect cards from at least four different members to play this mode.');
    game620.signal={round:0,total:8,score:0,correct:0,pool,locked:false,start:0};renderSignalRound620();
  }
  function renderSignalRound620(){
    const s=game620.signal;if(!s)return startSignal620(); if(s.round>=s.total)return finishSignal620();
    const target=s.pool[Math.floor(Math.random()*s.pool.length)],options=uniqueChoices620(s.pool.map(c=>c.member),String(target.member),4);s.target=target;s.options=options;s.locked=false;s.start=performance.now();
    const body=arcadeBody620();body.innerHTML=`<section class="v620-quiz-panel"><div class="v620-gamebar"><div><span>CARD SIGNAL</span><strong>WHO IS ON THE CARD?</strong></div><b>ROUND ${s.round+1}/${s.total} · ${fmt620(s.score)} PTS</b></div><div class="v620-signal-stage"><div class="v620-signal-card" id="v620-signal-card"><img src="${esc620(cardUrl620(target))}" alt="Mystery card"><i></i></div><div class="v620-choice-grid">${options.map((x,i)=>`<button onclick="answerSignal620(${i},this)">${esc620(x)}</button>`).join('')}</div></div><div class="v620-quiz-foot">Card drawn from your current inventory.</div></section>`;
  }
  window.answerSignal620=function(i,btn){const s=game620.signal;if(!s||s.locked)return;s.locked=true;const answer=s.options[i],ok=answer===String(s.target.member),elapsed=performance.now()-s.start;if(ok){s.correct++;s.score+=1000+Math.max(0,Math.round(1200-elapsed*.35));btn.classList.add('correct');}else{btn.classList.add('wrong');qa620('.v620-choice-grid button').forEach((b,idx)=>{if(s.options[idx]===String(s.target.member))b.classList.add('correct');});} $620('v620-signal-card')?.classList.add('revealed');setTimeout(()=>{s.round++;renderSignalRound620();},650);};
  function finishSignal620(){const s=game620.signal;saveRecord620('signal',s.score,true);logArcade620('card_quiz_correct',s.correct);arcadeBody620().innerHTML=`<section class="v620-finish"><span>CARD SIGNAL COMPLETE</span><strong>${fmt620(s.score)}</strong><p>${s.correct} / ${s.total} correct · Best ${fmt620(record620('signal'))}</p><div><button onclick="startSignal620()">PLAY AGAIN</button><button onclick="showArcadeMode610('home')">ARCADE LOBBY</button></div></section>`;}
  window.startSignal620=startSignal620;

  function buildThemePuzzle620(){
    const pool=realCards620(),map=new Map();pool.forEach(c=>{const k=`${c.group}|||${c.theme}`;if(!map.has(k))map.set(k,[]);map.get(k).push(c);});
    const valid=[...map.entries()].filter(([,cards])=>cards.length>=3);if(!valid.length)return null;
    const [key,set]=valid[Math.floor(Math.random()*valid.length)], [group,theme]=key.split('|||');let outsider=pool.filter(c=>String(c.theme)!==theme&&String(c.group)===group);if(!outsider.length)outsider=pool.filter(c=>String(c.theme)!==theme);if(!outsider.length)return null;
    const trio=shuffle620(set).slice(0,3).map(c=>({card:c,odd:false}));const odd={card:outsider[Math.floor(Math.random()*outsider.length)],odd:true};const cards=shuffle620([...trio,odd]);return {cards,oddIndex:cards.findIndex(x=>x.odd),group,theme};
  }
  function startTheme620(){const first=buildThemePuzzle620();if(!first)return renderNoData620('THEME BREAK LOCKED','You need at least three cards from one theme plus a card from another theme.');game620.theme={round:0,total:6,score:0,correct:0,locked:false,puzzle:first,start:0};renderThemeRound620(true);}
  function renderThemeRound620(useExisting=false){const s=game620.theme;if(!s)return startTheme620();if(s.round>=s.total)return finishTheme620();if(!useExisting)s.puzzle=buildThemePuzzle620();if(!s.puzzle)return finishTheme620();s.locked=false;s.start=performance.now();const body=arcadeBody620();body.innerHTML=`<section class="v620-quiz-panel"><div class="v620-gamebar"><div><span>THEME BREAK</span><strong>FIND THE CARD THAT BREAKS THE SET</strong></div><b>ROUND ${s.round+1}/${s.total} · ${fmt620(s.score)} PTS</b></div><div class="v620-theme-grid">${s.puzzle.cards.map((x,i)=>`<button onclick="answerTheme620(${i},this)"><img src="${esc620(cardUrl620(x.card))}" alt="Card ${i+1}"><span>${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div><div class="v620-quiz-foot">Three cards share one theme. One does not.</div></section>`;}
  window.answerTheme620=function(i,btn){const s=game620.theme;if(!s||s.locked)return;s.locked=true;const ok=i===s.puzzle.oddIndex,elapsed=performance.now()-s.start;if(ok){s.correct++;s.score+=1200+Math.max(0,Math.round(1300-elapsed*.30));btn.classList.add('correct');}else{btn.classList.add('wrong');qa620('.v620-theme-grid button')[s.puzzle.oddIndex]?.classList.add('correct');}setTimeout(()=>{s.round++;renderThemeRound620();},700);};
  function finishTheme620(){const s=game620.theme;saveRecord620('theme',s.score,true);logArcade620('theme_break_correct',s.correct);arcadeBody620().innerHTML=`<section class="v620-finish"><span>THEME BREAK COMPLETE</span><strong>${fmt620(s.score)}</strong><p>${s.correct} / ${s.total} correct · Best ${fmt620(record620('theme'))}</p><div><button onclick="startTheme620()">PLAY AGAIN</button><button onclick="showArcadeMode610('home')">ARCADE LOBBY</button></div></section>`;}
  window.startTheme620=startTheme620;

  function songs620(){try{return Array.isArray(arcadeSongs)?arcadeSongs.filter(s=>s&&s.title&&(s.group||s.artist)):[];}catch(_){return[];}}
  function startTrack620(){const pool=songs620(),groups=[...new Set(pool.map(s=>String(s.group||s.artist)))];if(pool.length<4||groups.length<4)return renderNoData620('TRACK CODE LOCKED','The song database needs at least four different artists.');game620.track={round:0,total:10,score:0,correct:0,pool,locked:false,start:0};renderTrackRound620();}
  function renderTrackRound620(){const s=game620.track;if(!s)return startTrack620();if(s.round>=s.total)return finishTrack620();const target=s.pool[Math.floor(Math.random()*s.pool.length)],answer=String(target.group||target.artist),options=uniqueChoices620(s.pool.map(x=>String(x.group||x.artist)),answer,4);s.target=target;s.options=options;s.locked=false;s.start=performance.now();arcadeBody620().innerHTML=`<section class="v620-quiz-panel"><div class="v620-gamebar"><div><span>TRACK CODE</span><strong>WHO OWNS THIS TRACK?</strong></div><b>ROUND ${s.round+1}/${s.total} · ${fmt620(s.score)} PTS</b></div><div class="v620-track-prompt"><div class="v620-track-art"><img src="${esc620(target.cover||'')}" alt="Track art"></div><span>TRACK FILE</span><h3>${esc620(target.title)}</h3><small>${target.bpm?`${esc620(target.bpm)} BPM · `:''}MATCH THE ARTIST</small></div><div class="v620-choice-grid track">${options.map((x,i)=>`<button onclick="answerTrack620(${i},this)">${esc620(x)}</button>`).join('')}</div></section>`;}
  window.answerTrack620=function(i,btn){const s=game620.track;if(!s||s.locked)return;s.locked=true;const answer=s.options[i],correct=String(s.target.group||s.target.artist),ok=answer===correct,elapsed=performance.now()-s.start;if(ok){s.correct++;s.score+=900+Math.max(0,Math.round(1000-elapsed*.28));btn.classList.add('correct');}else{btn.classList.add('wrong');qa620('.v620-choice-grid button').forEach((b,idx)=>{if(s.options[idx]===correct)b.classList.add('correct');});}setTimeout(()=>{s.round++;renderTrackRound620();},600);};
  function finishTrack620(){const s=game620.track;saveRecord620('track',s.score,true);logArcade620('track_quiz_correct',s.correct);arcadeBody620().innerHTML=`<section class="v620-finish"><span>TRACK CODE COMPLETE</span><strong>${fmt620(s.score)}</strong><p>${s.correct} / ${s.total} correct · Best ${fmt620(record620('track'))}</p><div><button onclick="startTrack620()">PLAY AGAIN</button><button onclick="showArcadeMode610('home')">ARCADE LOBBY</button></div></section>`;}
  window.startTrack620=startTrack620;

  const prevShowArcade620=typeof window.showArcadeMode610==='function'?window.showArcadeMode610:null;
  if(prevShowArcade620){window.showArcadeMode610=function(mode='home',tab){if(tab?.dataset?.mode)mode=tab.dataset.mode;upgradeArcadeShell620();setArcadeTabs620(mode);if(mode==='home')arcadeHome620();else if(mode==='signal')startSignal620();else if(mode==='theme')startTheme620();else if(mode==='track')startTrack620();else prevShowArcade620(mode,tab);setArcadeTabs620(mode);};}
  const prevOpenArcade620=typeof window.openArcade610==='function'?window.openArcade610:null;
  if(prevOpenArcade620){window.openArcade610=function(){const out=prevOpenArcade620.apply(this,arguments);upgradeArcadeShell620();setArcadeTabs620('home');arcadeHome620();return out;};}

  // Existing 6.1 games now feed Spotlight missions too.
  const prevPrism620=typeof window.flipMinigameCard==='function'?window.flipMinigameCard:null;
  if(prevPrism620){window.flipMinigameCard=function(el,index){const was=!!window.minigamePlayedToday;const out=prevPrism620.apply(this,arguments);if(!was&&window.minigamePlayedToday){try{trackMissionProgress('arcade',1);trackMissionProgress('prism_pick',1);}catch(_){}}return out;};try{flipMinigameCard=window.flipMinigameCard}catch(_){}}
  const prevMemory620=typeof window.memoryPick610==='function'?window.memoryPick610:null;
  if(prevMemory620){window.memoryPick610=function(btn){const out=prevMemory620.apply(this,arguments);setTimeout(()=>{const status=$620('v610-memory-status'),panel=status?.closest('.v610-game-panel');if(status&&/CLEAR/i.test(status.textContent||'')&&panel&&!panel.dataset.spotlightLogged){panel.dataset.spotlightLogged='1';try{trackMissionProgress('arcade',1);trackMissionProgress('memory_clear',1);}catch(_){}}},20);return out;};}
  const prevRush620=typeof window.startRush610==='function'?window.startRush610:null;
  if(prevRush620){window.startRush610=function(){const panel=$620('v610-rush-start')?.closest('.v610-game-panel');if(panel)panel.dataset.spotlightLogged='';const out=prevRush620.apply(this,arguments);setTimeout(()=>{const start=$620('v610-rush-start'),p=start?.closest('.v610-game-panel');if(start&&/RUN COMPLETE/i.test(start.textContent||'')&&p&&!p.dataset.spotlightLogged){p.dataset.spotlightLogged='1';try{trackMissionProgress('arcade',1);trackMissionProgress('light_rush_clear',1);}catch(_){}}},15600);return out;};}

  /* ----------------------- SHINING CIRCUIT ----------------------- */
  function circuitDivision620(score){
    const s=Number(score||0); if(s>=60000000)return ['HEADLINER','I']; if(s>=45000000)return ['NOVA','I']; if(s>=35000000)return ['NOVA','II']; if(s>=26000000)return ['PRISM','I']; if(s>=18000000)return ['PRISM','II']; if(s>=11000000)return ['SIGNAL','I']; if(s>=6000000)return ['SIGNAL','II']; if(s>=2500000)return ['SPARK','I']; return ['SPARK','II'];
  }
  function decorateCircuit620(){
    const modal=$620('cyber-league-modal');if(!modal)return;modal.classList.add('v620-circuit');
    const score=Number(String($620('arena-my-score')?.textContent||'0').replace(/[^0-9]/g,''))||Number(user?.leagueScore||0),[div,sub]=circuitDivision620(score);
    const tier=q620('.tier-name',modal);if(tier)tier.textContent=`${div} ${sub}`;
    const icon=q620('.tier-icon-wrapper',modal);if(icon)icon.innerHTML=`<div class="v620-circuit-emblem"><span>SC</span><b>${esc620(div.slice(0,3))}</b></div>`;
    const status=q620('.score-status',modal);
    const scores=[...qa620('.podium-score',modal),...qa620('.a-score',modal)].map(x=>Number(String(x.textContent).replace(/[^0-9]/g,''))).filter(Number.isFinite).sort((a,b)=>b-a);
    const rank=1+scores.filter(x=>x>score).length,players=Math.max(scores.length,1),next=scores.filter(x=>x>score).sort((a,b)=>a-b)[0],gap=next?Math.max(0,next-score):0;
    const zone=rank<=5?'promote':rank>=16?'demote':'hold';if(status){status.className=`score-status v620-${zone}`;status.textContent=zone==='promote'?'▲ MOVE-UP ZONE':zone==='demote'?'▼ DROP ZONE':'◆ HOLD ZONE';}
    let summary=$620('v620-circuit-summary');if(!summary){summary=document.createElement('div');summary.id='v620-circuit-summary';summary.className='v620-circuit-summary';q620('.player-score-card',modal)?.after(summary);}summary.innerHTML=`<div><span>SERVER RANK</span><strong>#${rank}</strong></div><div><span>NEXT RIVAL</span><strong>${gap?`+${fmt620(gap)}`:'YOU LEAD'}</strong></div><div><span>FIELD</span><strong>${players}</strong></div><div><span>DIVISION</span><strong>${esc620(div)} ${sub}</strong></div>`;
    qa620('.arena-row',modal).forEach(row=>{const r=Number(q620('.a-rank',row)?.textContent||99);row.dataset.circuitZone=r<=5?'promote':r>=16?'demote':'hold';});
    qa620('#arena-list > div',modal).forEach(el=>{if(el.classList.contains('arena-row'))return;const t=el.textContent||'';if(/PROMOTION/i.test(t))el.innerHTML='<span class="v620-zone-line promote">▲ MOVE-UP CUT</span>';if(/DEMOTION/i.test(t))el.innerHTML='<span class="v620-zone-line demote">▼ DROP CUT</span>';});
    updateCircuitTimer620();
  }
  function updateCircuitTimer620(){const el=$620('circuit-season-timer');if(!el)return;el.textContent=countdown620('weekly');}
  const prevLeague620=typeof openLeaderboard==='function'?openLeaderboard:null;
  if(prevLeague620){window.openLeaderboard=openLeaderboard=async function(){const out=await prevLeague620.apply(this,arguments);decorateCircuit620();return out;};}

  function tick620(){
    qa620('[data-mission-countdown]').forEach(el=>{el.textContent=countdown620(el.dataset.missionCountdown);});updateCircuitTimer620();
    try{const tabs=['daily','weekly','monthly'];const rollover=tabs.some(t=>user?.missionCycles?.[t]&&user.missionCycles[t]!==cycleKey620(t));if(rollover){ensureMissionRefresh620();const modal=$620('missions-modal');if(modal&&getComputedStyle(modal).display!=='none'&&tabs.includes(currentMissionTab))renderSpotlight620(currentMissionTab);}}catch(_){}
  }
  function init620(){
    document.body.classList.add('shining-v620');document.documentElement.dataset.shiningVersion='6.2.0';ensureMissionRefresh620();
    const title=$620('mission-hub-title');if(title)title.textContent='SPOTLIGHT BOARD';const sub=$620('mission-hub-subtitle');if(sub)sub.textContent='ROTATING CALLS · SETLISTS · HEADLINER GOALS';
    setInterval(tick620,1000);
  }
  document.addEventListener('DOMContentLoaded',init620);if(document.readyState!=='loading')init620();
})();
