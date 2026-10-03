const WORKER_BASE = "https://shining-superstar.matchuchacho.workers.dev";
const INDEX_URL = "https://raw.githubusercontent.com/kesharrpm/shining-superstar/catalog-assets/catalog_index.json";
const STUDIO_DRAFT_KEY = "shining.catalog.studio.draft.v3";
const GITHUB_REPO = "kesharrpm/shining-superstar";
const GITHUB_BRANCH = "main";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const STUDIO_DB_NAME = "shining-catalog-studio";
const STUDIO_DB_VERSION = 1;
const state={themeData:{},wallpaperData:[],manifest:{},assets:[],staged:new Map(),edits:{theme:false,wallpaper:false},index:null,outputNonce:randomHex(32),draft:loadLocalDraft(),githubSync:{working:false}};
const $=id=>document.getElementById(id),els={};
document.addEventListener("DOMContentLoaded",()=>{["viewTitle","sourceStatus","statGroups","statThemes","statBundles","statWallpapers","groupSelect","themeSelect","bundleKind","editionSelect","manifestKeyPreview","bundleFilePreview","assetDrop","assetFiles","assetRows","clearAssetsBtn","bundlePassword","togglePassword","buildFiles","buildAction","buildBundleBtn","buildProgress","buildProgressText","buildProgressPct","buildProgressBar","stagedCount","stagedList","exportKitBtn","refreshProjectBtn","githubToken","toggleGithubToken","githubSyncBtn","githubSyncStatus","githubSyncOutput","cloudScopeLabel","cloudScopeTitle","cloudOutputCount","cloudMemberPreview","cloudThemeText","cloudCloudName","cloudEmblemId","cloudCropPrefix","cloudImagePrefix","cloudPresetBtn","cloudGenerateBtn","cloudGenOutput","cloudGenModeHint","cloudGradeCard","cloudSizeCard","cloudLarge","cloudSmall","cloudAdvanced","metaGroup","metaTheme","metaType","metaPool","metaLE","metaMembers","applyThemeBtn","wpId","wpGroup","wpName","wpType","wpCost","wpCurrency","wpUrl","applyWallpaperBtn","metadataLog","clearDraftBtn","loadIndexBtn","indexSearch","indexCategory","indexMeta","bindingList","adminToken","toggleAdminToken","cloudStatusBtn","cloudMetaBtn","cloudPublishedBtn","cloudOutput","groupNames","toast"].forEach(id=>els[id]=$(id));bindNavigation();bindForge();bindMetadata();bindExplorer();bindPublish();bindCopyButtons();loadProject().catch(error=>{console.error(error);setSourceStatus("error","Studio startup failed");toast(error.message||"Studio startup failed.","bad")})});
function bindNavigation(){document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===`view-${btn.dataset.view}`));els.viewTitle.textContent={forge:"Asset Upload",metadata:"Metadata",explorer:"Index Explorer",publish:"Publish Center"}[btn.dataset.view]||"Catalog Studio"}))}
function bindForge(){[els.groupSelect,els.themeSelect,els.bundleKind,els.editionSelect].forEach(x=>x.addEventListener("change",()=>{if(x===els.groupSelect)refreshThemes();if(x===els.bundleKind)normalizeEdition();state.outputNonce=randomHex(32);updateIdentity();refreshCloudinaryControls();renderAssetRows();rememberSelection()}));els.assetFiles.addEventListener("change",e=>addFiles([...e.target.files]));["dragenter","dragover"].forEach(type=>els.assetDrop.addEventListener(type,e=>{e.preventDefault();els.assetDrop.classList.add("drag")}));["dragleave","drop"].forEach(type=>els.assetDrop.addEventListener(type,e=>{e.preventDefault();els.assetDrop.classList.remove("drag")}));els.assetDrop.addEventListener("drop",e=>addFiles([...e.dataTransfer.files].filter(f=>f.type==="image/png"||/\.png$/i.test(f.name))));els.clearAssetsBtn.addEventListener("click",()=>{state.assets.forEach(revokeAssetPreview);state.assets=[];renderAssetRows()});els.togglePassword.addEventListener("click",()=>toggleSecret(els.bundlePassword,els.togglePassword));els.buildBundleBtn.addEventListener("click",buildBundle);els.exportKitBtn.addEventListener("click",exportKit);els.refreshProjectBtn.addEventListener("click",()=>loadProject(true));els.toggleGithubToken?.addEventListener("click",()=>toggleSecret(els.githubToken,els.toggleGithubToken));els.githubSyncBtn?.addEventListener("click",()=>syncMetadataToGitHub({interactive:true}));els.cloudPresetBtn.addEventListener("click",()=>refreshCloudinaryControls(true));els.cloudGenerateBtn.addEventListener("click",generateCloudinaryAssets);document.querySelectorAll(".cloud-grade").forEach(cb=>cb.addEventListener("change",updateAutopilotSummary));[els.cloudLarge,els.cloudSmall].forEach(cb=>cb.addEventListener("change",updateAutopilotSummary))}
function bindMetadata(){els.metaGroup.addEventListener("change",hydrateMetaGroup);els.metaGroup.addEventListener("input",hydrateMetaGroup);els.applyThemeBtn.addEventListener("click",applyThemeData);els.applyWallpaperBtn.addEventListener("click",applyWallpaper);els.clearDraftBtn?.addEventListener("click",clearLocalDraft)}
function bindExplorer(){els.loadIndexBtn.addEventListener("click",loadIndex);els.indexSearch.addEventListener("input",renderBindings);els.indexCategory.addEventListener("change",renderBindings)}
function bindPublish(){els.toggleAdminToken.addEventListener("click",()=>toggleSecret(els.adminToken,els.toggleAdminToken));els.cloudStatusBtn.addEventListener("click",()=>cloudCall("/admin/status","GET"));els.cloudMetaBtn.addEventListener("click",()=>cloudCall("/admin/sync","POST"));els.cloudPublishedBtn.addEventListener("click",()=>cloudCall("/admin/sync-published","POST"))}
function bindCopyButtons(){document.addEventListener("click",async e=>{const btn=e.target.closest("[data-copy-target]");if(!btn)return;const target=$(btn.dataset.copyTarget);if(!target)return;await navigator.clipboard.writeText(target.textContent);toast("Copied to clipboard.")})}
async function loadProject(forceRemote=false){
  setSourceStatus("loading","Loading catalog…");
  const localBase=(location.protocol==="http:"||location.protocol==="https:")?location.origin:null;
  const urls=path=>[
    localBase?`${localBase}${path}`:null,
    `https://kesharrpm.github.io/shining-superstar${path}`,
    `https://raw.githubusercontent.com/kesharrpm/shining-superstar/main${path}`
  ].filter(Boolean);
  const [themeResult,wallpaperResult,manifestResult,indexResult]=await Promise.all([
    fetchJsonFirst([...urls("/qa/themeData.json"),`${WORKER_BASE}/api/theme-data`]).catch(error=>({__error:error})),
    fetchJsonFirst([...urls("/qa/wallpaperData.json"),`${WORKER_BASE}/api/wallpapers`]).catch(error=>({__error:error})),
    fetchJsonFirst(urls("/dev/2.0.0/manifest_hashes")).catch(error=>({__error:error})),
    fetchJsonFirst([INDEX_URL]).catch(()=>null)
  ]);
  const remoteTheme=themeResult?.themeData||(!themeResult?.__error?themeResult:{});
  const remoteWallpapers=wallpaperResult?.wallpapers||(!wallpaperResult?.__error?wallpaperResult:[]);
  const remoteManifest=!manifestResult?.__error?manifestResult:{};
  state.themeData=remoteTheme&&typeof remoteTheme==="object"&&!Array.isArray(remoteTheme)?structuredClone(remoteTheme):{};
  state.wallpaperData=Array.isArray(remoteWallpapers)?remoteWallpapers.map(normalizeWallpaperRecord):[];
  state.manifest=remoteManifest&&typeof remoteManifest==="object"&&!Array.isArray(remoteManifest)?structuredClone(remoteManifest):{};
  state.index=indexResult||state.index;
  applyLocalDraft();
  const sel=state.draft.selection||{};
  refreshProjectUI(sel.group||"",sel.theme||"");
  if(sel.kind&&[...els.bundleKind.options].some(o=>o.value===sel.kind))els.bundleKind.value=sel.kind;
  normalizeEdition();
  if(sel.edition&&[...els.editionSelect.options].some(o=>o.value===sel.edition)&&!els.editionSelect.disabled)els.editionSelect.value=sel.edition;
  updateIdentity();
  refreshCloudinaryControls(true);
  await restoreStagedBundles();
  if(metadataDraftPresent())await refreshMetadataDirtyState();
  renderStaging();
  renderGitHubSyncStatus();
  const errors=[themeResult?.__error&&"themeData",wallpaperResult?.__error&&"wallpaperData",manifestResult?.__error&&"manifest"].filter(Boolean);
  const draftCount=Object.keys(state.draft.themeGroups||{}).length+Object.keys(state.draft.wallpapers||{}).length+Object.keys(state.draft.manifest||{}).length;
  if(Object.keys(state.themeData).length){
    setSourceStatus("ready",`Ready · ${Object.keys(state.themeData).length} groups${draftCount?` · ${draftCount} local draft edit${draftCount===1?"":"s"}`:""}`);
    if(errors.length)els.cloudGenOutput.textContent=`Catalog ready. Optional source warning: ${errors.join(", ")} could not load, but usable fallbacks were found.`;
  }else{
    setSourceStatus("error","No group metadata available");
    els.cloudGenOutput.textContent="No theme/member data could be loaded. Add a group in Metadata; it will now autosave locally.";
  }
}
async function fetchJsonFirst(urls){
  let lastError;
  for(const url of urls){
    try{
      const r=await fetch(`${url}${url.includes("?")?"&":"?"}v=${Date.now()}`,{cache:"no-store"});
      if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
      const data=await r.json();
      return data;
    }catch(error){lastError=error;}
  }
  throw lastError||new Error("No data source available");
}
async function fetchJson(url){return fetchJsonFirst([url])}
function normalizeWallpaperRecord(w){
  if(!w||typeof w!=="object")return w;
  if("legacy_url" in w&&!"url" in w)return {id:w.id,group:w.group_name||"",type:w.type||"BASIC",name:w.name||w.id,url:w.legacy_url||"",cost:Number(w.cost||0),currency:w.currency||"free"};
  return w;
}
function loadLocalDraft(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STUDIO_DRAFT_KEY)||"null");
    return parsed&&typeof parsed==="object"?parsed:{version:4,themeGroups:{},wallpapers:{},manifest:{},selection:{},metadataSync:{}};
  }catch{return {version:4,themeGroups:{},wallpapers:{},manifest:{},selection:{},metadataSync:{}};}
}
function persistLocalDraft(){
  try{localStorage.setItem(STUDIO_DRAFT_KEY,JSON.stringify(state.draft));}catch(error){console.warn("Could not save Studio draft",error);}
}
function applyLocalDraft(){
  state.draft.themeGroups||={};state.draft.wallpapers||={};state.draft.manifest||={};state.draft.selection||={};state.draft.metadataSync||={};
  for(const [group,info] of Object.entries(state.draft.themeGroups))state.themeData[group]=structuredClone(info);
  const byId=new Map(state.wallpaperData.map(w=>[String(w.id),w]));
  for(const [id,w] of Object.entries(state.draft.wallpapers))byId.set(String(id),structuredClone(w));
  state.wallpaperData=[...byId.values()];
  for(const [key,info] of Object.entries(state.draft.manifest))state.manifest[key]=structuredClone(info);
}
function rememberSelection(){
  state.draft.selection={group:els.groupSelect.value,theme:els.themeSelect.value,kind:els.bundleKind.value,edition:els.editionSelect.value};
  persistLocalDraft();
}
async function clearLocalDraft(){
  if(!confirm("Clear locally autosaved groups, themes, wallpapers, and staged bundles from this browser? Published/source data will not be deleted."))return;
  try{localStorage.removeItem(STUDIO_DRAFT_KEY);}catch{}
  state.draft={version:3,themeGroups:{},wallpapers:{},manifest:{},selection:{}};
  await clearStagedBundleStore();
  state.staged.clear();
  state.assets=[];
  toast("Local Studio draft cleared.");
  await loadProject(true);
}
function openStudioDb(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window))return resolve(null);
    const req=indexedDB.open(STUDIO_DB_NAME,STUDIO_DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("stagedBundles"))db.createObjectStore("stagedBundles",{keyPath:"key"});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function saveStagedBundle(item){
  try{const db=await openStudioDb();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction("stagedBundles","readwrite");tx.objectStore("stagedBundles").put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch(error){console.warn("Could not persist staged bundle",error);}
}
async function restoreStagedBundles(){
  try{const db=await openStudioDb();if(!db)return;const items=await new Promise((resolve,reject)=>{const tx=db.transaction("stagedBundles","readonly");const req=tx.objectStore("stagedBundles").getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});db.close();for(const item of items){if(item?.key&&item?.blob)state.staged.set(item.key,item);}}catch(error){console.warn("Could not restore staged bundles",error);}
}
async function clearStagedBundleStore(){
  try{const db=await openStudioDb();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction("stagedBundles","readwrite");tx.objectStore("stagedBundles").clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch(error){console.warn(error);}
}
function refreshProjectUI(preferredGroup="",preferredTheme=""){const groups=Object.keys(state.themeData),previous=preferredGroup||els.groupSelect.value||els.metaGroup.value;els.groupSelect.innerHTML=groups.map(g=>`<option value="${attr(g)}">${esc(g)}</option>`).join("");els.groupNames.innerHTML=groups.map(g=>`<option value="${attr(g)}"></option>`).join("");if(groups.length)els.groupSelect.value=groups.includes(previous)?previous:groups[0];refreshThemes(preferredTheme);refreshCloudinaryControls();updateStats();updateIdentity();hydrateMetaGroup()}
function refreshThemes(preferredTheme=""){const info=state.themeData[els.groupSelect.value]||{},themes=[...(info.themes||[]),...(info.le_themes||[])],old=preferredTheme||els.themeSelect.value;els.themeSelect.innerHTML=themes.map(t=>`<option value="${attr(t)}">${esc(t)}</option>`).join("");if(themes.includes(old))els.themeSelect.value=old;else if(themes.length)els.themeSelect.value=themes[0];const le=new Set(info.le_themes||[]);els.editionSelect.value=le.has(els.themeSelect.value)?"le":"normal";updateIdentity();refreshCloudinaryControls()}
function normalizeEdition(){if(els.bundleKind.value==="empty_cards"||els.bundleKind.value==="bg"){els.editionSelect.value="normal";els.editionSelect.disabled=true}else els.editionSelect.disabled=false;refreshCloudinaryControls()}
function inferMembersFromIndex(group,theme){
  if(!state.index?.bindings)return[];
  const gs=slug(group),ts=slug(theme),found=new Set();
  for(const key of Object.keys(state.index.bindings)){
    const parts=key.split(":");
    if(parts.length<4)continue;
    const [kind,g,t,member]=parts;
    if(!["card","profile","ghost"].includes(kind)||g!==gs||t!==ts||!member)continue;
    found.add(member);
  }
  return [...found].map(member=>member.replace(/_/g," ").toUpperCase());
}
function resolvedMembers(){
  const group=els.groupSelect.value;
  const direct=state.themeData[group]?.members||[];
  if(direct.length)return [...direct];
  const draft=state.draft.themeGroups?.[group]?.members||[];
  if(draft.length)return [...draft];
  if(els.metaGroup?.value?.trim()&&slug(els.metaGroup.value.trim())===slug(group)){
    const typed=els.metaMembers.value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
    if(typed.length)return [...new Set(typed)];
  }
  return inferMembersFromIndex(group,els.themeSelect.value);
}
function refreshCloudinaryControls(forceDefaults=false){
  const kind=els.bundleKind.value;
  const members=resolvedMembers();
  const group=els.groupSelect.value||"—",theme=els.themeSelect.value||"—";
  if(forceDefaults||!els.cloudThemeText.value)els.cloudThemeText.value=theme==="—"?"":theme;
  if(forceDefaults||!els.cloudCloudName.value)els.cloudCloudName.value="shining-superstar";
  if(forceDefaults||!els.cloudCropPrefix.value)els.cloudCropPrefix.value="u_c_l";
  if(forceDefaults||!els.cloudImagePrefix.value)els.cloudImagePrefix.value="c_l";
  if(forceDefaults||!els.cloudEmblemId.value)els.cloudEmblemId.value=`l_emblem_${slug(group)}`;
  else if(forceDefaults)els.cloudEmblemId.value=`l_emblem_${slug(group)}`;
  // Group/theme changes should always refresh the obvious inferred values.
  if(!forceDefaults){els.cloudThemeText.value=theme==="—"?"":theme;els.cloudEmblemId.value=`l_emblem_${slug(group)}`;}
  const supports=kind!=="bg";
  document.querySelector(".generator-panel")?.classList.toggle("disabled",!supports);
  const supportsGrades=kind==="cards";
  const supportsSizes=kind==="cards"||kind==="empty_cards";
  els.cloudGradeCard.classList.toggle("disabled",!supportsGrades);
  els.cloudSizeCard.classList.toggle("disabled",!supportsSizes);
  document.querySelectorAll(".cloud-grade").forEach(cb=>cb.disabled=!supportsGrades);
  els.cloudLarge.disabled=!supportsSizes;
  els.cloudSmall.disabled=!supportsSizes;
  if(!supportsSizes){els.cloudLarge.checked=true;els.cloudSmall.checked=false;}
  els.cloudScopeLabel.textContent=`${kind==="cards"?"CARD":kind==="profile"?"PROFILE":kind==="empty_cards"?"GHOST":"BACKGROUND"} AUTOPILOT`;
  els.cloudScopeTitle.textContent=`${group} · ${theme}`;
  if(members.length){
    els.cloudMemberPreview.innerHTML=members.map(m=>`<span class="member-chip">${esc(m)}</span>`).join("");
  }else{
    els.cloudMemberPreview.innerHTML=`<span class="member-empty">No members found for ${esc(group)}. Add the group's members in Metadata first.</span>`;
  }
  const source=state.themeData[group]?.members?.length?"themeData":"published index";
  const msg=kind==="cards"
    ? `${members.length} member${members.length===1?"":"s"} found from ${source}. Autopilot will render every selected grade/size, rename each PNG, and stage the whole bundle.`
    : kind==="profile"
    ? `${members.length} member${members.length===1?"":"s"} found. One face-cropped profile PNG will be generated for every member automatically.`
    : kind==="empty_cards"
    ? `${members.length} member${members.length===1?"":"s"} found. Grayscale ghost cards will be generated for every member automatically.`
    : "Background bundles stay manual because they do not follow the member-card source pattern.";
  els.cloudGenModeHint.textContent=msg;
  updateAutopilotSummary();
}
function selectedCloudMembers(){return resolvedMembers()}
function selectedCloudGrades(){
  return [...document.querySelectorAll('.cloud-grade:checked')].map(x=>x.value.toUpperCase());
}
function selectedCloudSizes(){
  const sizes=[];
  if(els.cloudLarge.checked) sizes.push('large');
  if(els.cloudSmall.checked) sizes.push('small');
  return sizes;
}
function updateAutopilotSummary(){
  if(!els.cloudOutputCount)return;
  const kind=els.bundleKind.value,members=resolvedMembers(),grades=selectedCloudGrades(),sizes=selectedCloudSizes();
  let count=0;
  if(kind==="cards")count=members.length*grades.length*sizes.length;
  else if(kind==="profile")count=members.length;
  else if(kind==="empty_cards")count=members.length*sizes.length;
  els.cloudOutputCount.textContent=count;
  els.cloudGenerateBtn.disabled=kind==="bg";
  els.cloudGenerateBtn.querySelector("span").textContent=count?`GENERATE ${count} ASSET${count===1?"":"S"}`:"CHECK AUTOPILOT DATA";
}
function cloudinaryDoubleEncode(text){return encodeURIComponent(encodeURIComponent(String(text||'')));}
function imageSourceIdForMember(member){return `${els.cloudImagePrefix.value||'c_l'}_${slug(els.themeSelect.value)}_${slug(member)}`;}
function cropSourceIdForMember(member){return `${els.cloudCropPrefix.value||'u_c_l'}_${slug(els.themeSelect.value)}_${slug(member)}`;}
function buildCloudinaryUrl({member,grade='R',size='large'}){
  const cloud=els.cloudCloudName.value.trim()||'shining-superstar';
  const themeSlug=slug(els.themeSelect.value);
  const groupSlug=slug(els.groupSelect.value);
  const memberSlug=slug(member);
  const memberText=cloudinaryDoubleEncode(member);
  const themeText=cloudinaryDoubleEncode(els.cloudThemeText.value||els.themeSelect.value);
  const emblem=els.cloudEmblemId.value.trim()||`l_emblem_${groupSlug}`;
  const cropId=cropSourceIdForMember(member);
  const imageId=imageSourceIdForMember(member);
  const kind=els.bundleKind.value;
  const edition=els.editionSelect.value;
  const g=String(grade||'R').toLowerCase();
  const base=`https://res.cloudinary.com/${encodeURIComponent(cloud)}`;
  if(kind==='profile') return `${base}/c_thumb,g_face,w_200,h_200,r_max/${imageId}.png`;
  if(kind==='empty_cards') return size==='small'?`${base}/image/upload/o_50,e_grayscale,r_10/c_auto,h_130,w_93/${imageId}.png`:`${base}/image/upload/o_50,e_grayscale,r_10/${imageId}.png`;
  if(kind==='cards' && edition==='normal' && size==='large') return `${base}/${cropId}/c_scale,fl_relative,w_1.00/fl_layer_apply,fl_no_overflow,g_center/${emblem}/c_fit,fl_relative,h_0.11,w_0.33/fl_layer_apply,fl_no_overflow,g_center,x_60,y_-124/co_rgb:FFFFFF,l_text:Helvetica_26_bold_normal_right_letter_spacing_-1:${memberText}/fl_layer_apply,fl_no_overflow,g_east,x_16,y_124/co_rgb:FFC600,l_text:Helvetica_20_bold_normal_right:${themeText}/fl_layer_apply,fl_no_overflow,g_east,x_15,y_90/ced_default_${g}_Large.png`;
  if(kind==='cards' && edition==='normal' && size==='small') return `${base}/image/upload/l_ced_default_${g}_Small/c_scale,w_2.40/fl_layer_apply,fl_no_overflow,g_center/c_auto,h_130,w_93/e_unsharp_mask:39/${imageId}.png`;
  if(kind==='cards' && edition==='le' && size==='large') return `${base}/image/upload/${cropId}/c_scale,h_318,w_226/fl_layer_apply,fl_no_overflow,g_center/${emblem}/c_fit,fl_relative,h_0.11,w_0.33/fl_layer_apply,fl_no_overflow,g_center,x_60,y_-124/co_rgb:FFFFFF,l_text:Helvetica_26_bold_normal_right_letter_spacing_-1:${memberText}/fl_layer_apply,fl_no_overflow,g_east,x_32,y_125/limitednewframe_${themeSlug}_${g}_Large.png`;
  if(kind==='cards' && edition==='le' && size==='small') return `${base}/image/upload/${cropId}/c_fill,w_90,r_10/fl_layer_apply,g_center/limitednewframe_${themeSlug}_${g}_Small.png`;
  return `${base}/image/upload/${imageId}.png`;
}
async function fetchPngAsFile(url,filename){
  const r=await fetch(url,{mode:'cors'});
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${filename}`);
  const blob=await r.blob();
  return new File([blob],filename,{type:blob.type||'image/png'});
}
async function generateCloudinaryAssets(){
  refreshCloudinaryControls();
  const kind=els.bundleKind.value,group=els.groupSelect.value,theme=els.themeSelect.value;
  els.cloudGenOutput.textContent=`Checking ${group||"(no group)"} · ${theme||"(no theme)"}…`;
  if(kind==="bg")return toast("Backgrounds use the manual asset drop zone.","bad");
  if(!group||!theme){els.cloudGenOutput.textContent="Autopilot cannot start because Group or Theme is empty. Reload catalog data or add the group/theme in Metadata.";return toast("Group/theme data is missing.","bad");}
  const members=selectedCloudMembers();
  if(!members.length){els.cloudGenOutput.textContent=`AUTOPILOT STOPPED

Group: ${group}
Theme: ${theme}
Members found: 0

Add the member list once in Metadata and click APPLY THEME DATA. It will autosave in this browser from now on.`;return toast("No members found for this group.","bad");}
  const grades=kind==="cards"?selectedCloudGrades():["R"];
  const sizes=(kind==="cards"||kind==="empty_cards")?selectedCloudSizes():["large"];
  if(kind==="cards"&&!grades.length)return toast("Select at least one grade.","bad");
  if((kind==="cards"||kind==="empty_cards")&&!sizes.length)return toast("Select at least one size.","bad");
  const jobs=[];
  for(const member of members){
    if(kind==="profile")jobs.push({member,size:"large",grade:"R"});
    else if(kind==="empty_cards")for(const size of sizes)jobs.push({member,size,grade:"R"});
    else for(const size of sizes)for(const grade of grades)jobs.push({member,size,grade});
  }
  jobs.forEach(job=>job.url=buildCloudinaryUrl(job));
  els.cloudGenerateBtn.disabled=true;
  const lines=[`Generating ${jobs.length} assets for ${els.groupSelect.value} · ${els.themeSelect.value}`,`Bundle: ${currentManifestKey()}`,""];
  els.cloudGenOutput.textContent=lines.join("\n");
  let ok=0,failed=0,cursor=0;
  const processJob=async(job,index)=>{
    const tag=kind==="cards"?`${job.member} · ${job.grade} · ${job.size}`:kind==="empty_cards"?`${job.member} · ${job.size}`:job.member;
    try{
      const filename=kind==="cards"
        ?`c_${job.size==="small"?"s":"l"}_${slug(els.themeSelect.value)}_${slug(job.member)}_${String(job.grade).toLowerCase()}.png`
        :kind==="profile"
        ?`p_${slug(els.themeSelect.value)}_${slug(job.member)}.png`
        :`c_${job.size==="small"?"s":"l"}_${slug(els.themeSelect.value)}_${slug(job.member)}_em.png`;
      const file=await fetchPngAsFile(job.url,filename);
      const candidate={id:crypto.randomUUID(),file,member:job.member,grade:job.grade,size:job.size,alias:""};
      const entry=internalEntry(candidate);
      state.assets=state.assets.filter(existing=>internalEntry(existing)!==entry);
      state.assets.push(candidate);
      ok++;
      lines.push(`✓ ${tag} → ${entry}`);
    }catch(error){
      failed++;
      lines.push(`✗ ${tag} → ${error.message}`);
      console.error(job.url,error);
    }
    els.cloudGenOutput.textContent=lines.slice(-22).join("\n");
  };
  const workers=Array.from({length:Math.min(4,jobs.length)},async()=>{
    while(true){const index=cursor++;if(index>=jobs.length)break;await processJob(jobs[index],index);}
  });
  await Promise.all(workers);
  renderAssetRows();
  updateAutopilotSummary();
  els.cloudGenerateBtn.disabled=false;
  lines.push("",`Done · ${ok} staged${failed?` · ${failed} failed`:""}`);
  els.cloudGenOutput.textContent=lines.slice(-24).join("\n");
  toast(ok?`${ok} Cloudinary assets staged for the whole group.`:"Nothing could be generated.",ok?"good":"bad");
}
function updateStats(){const groups=Object.keys(state.themeData);let themes=0;for(const info of Object.values(state.themeData))themes+=new Set([...(info.themes||[]),...(info.le_themes||[])]).size;els.statGroups.textContent=groups.length;els.statThemes.textContent=themes;els.statBundles.textContent=Object.keys(state.manifest).length;els.statWallpapers.textContent=state.wallpaperData.length}
function updateIdentity(){const key=currentManifestKey();els.manifestKeyPreview.textContent=key||"—";els.bundleFilePreview.textContent=currentBundleFilename();els.buildAction.textContent=state.manifest[key]?"REPLACE":"CREATE"}
function currentManifestKey(){const g=slug(els.groupSelect.value),t=slug(els.themeSelect.value),kind=els.bundleKind.value;if(!g||!t)return"";if(kind==="cards")return`cards_${g}_${t}${els.editionSelect.value==="le"?"_le":""}`;if(kind==="profile")return`profile_${g}_${t}${els.editionSelect.value==="le"?"_le":""}`;if(kind==="empty_cards")return`empty_cards_${g}_${t}`;if(kind==="bg")return`bg_${g}_${t}`;return""}
function currentBundleFilename(){const g=slug(els.groupSelect.value),t=slug(els.themeSelect.value),kind=els.bundleKind.value,prefix=kind==="profile"?"profile_":kind==="empty_cards"?"em_":kind==="bg"?"bg_":"";return`images_2_assets_images_update_${prefix}${g}_${t}_${state.outputNonce}`}
function addFiles(files){if(!files.length)return;const known=memberNames();for(const file of files){if(!(file.type==="image/png"||/\.png$/i.test(file.name))){toast(`${file.name} skipped — PNG only.`,"bad");continue}const guess=inferAssetMeta(file.name,known);state.assets.push({id:crypto.randomUUID(),file,previewUrl:URL.createObjectURL(file),member:guess.member||known[0]||"",grade:guess.grade||"R",size:guess.size||"large",alias:guess.alias||""})}renderAssetRows()}
function memberNames(){return resolvedMembers()}
function inferAssetMeta(filename,members){const base=filename.replace(/\.[^.]+$/,"");const low=slug(base);let member="";for(const m of members){if(low.includes(slug(m))){member=m;break}}const gm=low.match(/(?:^|_)(c|b|a|s|r)(?:_|$)/i);return{member,grade:gm?.[1]?.toUpperCase()||"R",size:/(?:^|_)(small|c_s|_s_)/i.test(low)?"small":"large",alias:base}}
function revokeAssetPreview(asset){if(asset?.previewUrl){try{URL.revokeObjectURL(asset.previewUrl)}catch{}asset.previewUrl=""}}
function renderAssetRows(){
  els.buildFiles.textContent=state.assets.length;
  if(!state.assets.length){els.assetRows.innerHTML=`<tr class="empty-row"><td colspan="7">No assets staged yet.</td></tr>`;return}
  const kind=els.bundleKind.value,members=memberNames(),showGrade=kind==="cards",showSize=kind==="cards"||kind==="empty_cards";
  const entryCounts=new Map();
  for(const a of state.assets){const e=internalEntry(a);entryCounts.set(e,(entryCounts.get(e)||0)+1)}
  els.assetRows.innerHTML=state.assets.map(a=>{
    const memberCell=kind==="bg"?`<input data-field="alias" value="${attr(a.alias||generatedBgAlias())}" placeholder="mybg_lobby_…">`:`<select data-field="member">${members.map(m=>`<option value="${attr(m)}" ${m===a.member?"selected":""}>${esc(m)}</option>`).join("")}</select>`;
    const entry=internalEntry(a),duplicate=entryCounts.get(entry)>1;
    return`<tr data-id="${a.id}" class="${duplicate?"asset-row-warning":""}"><td class="preview-cell"><img class="asset-thumb" src="${attr(a.previewUrl||"")}" alt=""></td><td><div class="file-name" title="${attr(a.file.name)}">${esc(a.file.name)}</div><small>${prettyBytes(a.file.size)}${duplicate?' · <b class="dup-label">DUPLICATE TARGET</b>':''}</small></td><td>${memberCell}</td><td class="grade-col" style="${showGrade?"":"display:none"}"><select data-field="grade">${["C","B","A","S","R"].map(g=>`<option ${g===a.grade?"selected":""}>${g}</option>`).join("")}</select></td><td class="size-col" style="${showSize?"":"display:none"}"><select data-field="size"><option value="large" ${a.size==="large"?"selected":""}>Large</option><option value="small" ${a.size==="small"?"selected":""}>Small</option></select></td><td><code class="entry-preview">${esc(entry)}</code></td><td><button class="remove" title="Remove">×</button></td></tr>`
  }).join("");
  els.assetRows.querySelectorAll("tr[data-id]").forEach(row=>{const asset=state.assets.find(a=>a.id===row.dataset.id);row.querySelectorAll("[data-field]").forEach(input=>input.addEventListener("change",()=>{asset[input.dataset.field]=input.value;renderAssetRows()}));row.querySelector(".remove").addEventListener("click",()=>{revokeAssetPreview(asset);state.assets=state.assets.filter(a=>a.id!==asset.id);renderAssetRows()})})
}
function internalEntry(asset){const t=slug(els.themeSelect.value),kind=els.bundleKind.value;if(kind==="profile")return`images/p_${t}_${slug(asset.member)}`;if(kind==="cards")return`images/c_${asset.size==="small"?"s":"l"}_${t}_${slug(asset.member)}_${String(asset.grade||"R").toLowerCase()}`;if(kind==="empty_cards")return`images/c_${asset.size==="small"?"s":"l"}_${t}_${slug(asset.member)}_em`;if(kind==="bg")return`images/${normAlias(asset.alias||generatedBgAlias())}`;return"images/asset"}
function generatedBgAlias(){return`mybg_lobby_${slug(els.themeSelect.value||els.groupSelect.value)}`}
async function buildBundle(){if(!window.zip||!window.SparkMD5)return toast("ZIP libraries did not load. Check your connection.","bad");if(!state.assets.length)return toast("Add PNG assets first.","bad");const targets=state.assets.map(internalEntry);if(new Set(targets).size!==targets.length)return toast("Two or more files target the same internal entry. Fix the highlighted duplicate rows first.","bad");if(!els.bundlePassword.value)return toast("Enter the bundle password for this session.","bad");setBuildProgress(true,"Creating encrypted ZIP…",8);els.buildBundleBtn.disabled=true;try{const key=currentManifestKey(),filename=currentBundleFilename(),writer=new zip.ZipWriter(new zip.BlobWriter("application/octet-stream"),{password:els.bundlePassword.value,encryptionStrength:3});let done=0;for(const asset of state.assets){await writer.add(internalEntry(asset),new zip.BlobReader(asset.file),{password:els.bundlePassword.value,encryptionStrength:3,level:0});done++;setBuildProgress(true,`Encrypting ${done} / ${state.assets.length}`,10+Math.round(done/state.assets.length*65))}const blob=await writer.close();setBuildProgress(true,"Calculating manifest MD5…",82);const md5=await md5Blob(blob);state.manifest[key]={file:filename,md5_checksum:md5};const stagedItem={key,filename,md5,blob,assetCount:state.assets.length,kind:els.bundleKind.value};state.staged.set(key,stagedItem);state.draft.manifest[key]=structuredClone(state.manifest[key]);persistLocalDraft();await saveStagedBundle(stagedItem);state.outputNonce=randomHex(32);updateStats();renderStaging();setBuildProgress(true,"Bundle ready.",100);toast(`${key} built successfully.`);setTimeout(()=>setBuildProgress(false),900)}catch(error){console.error(error);setBuildProgress(false);toast(error.message||"Bundle build failed.","bad")}finally{els.buildBundleBtn.disabled=false;updateIdentity()}}
async function md5Blob(blob){const spark=new SparkMD5.ArrayBuffer(),chunk=2*1024*1024;for(let offset=0;offset<blob.size;offset+=chunk)spark.append(await blob.slice(offset,Math.min(blob.size,offset+chunk)).arrayBuffer());return spark.end()}
function setBuildProgress(show,text="",pct=0){els.buildProgress.classList.toggle("hidden",!show);if(show){els.buildProgressText.textContent=text;els.buildProgressPct.textContent=`${pct}%`;els.buildProgressBar.style.width=`${pct}%`}}
function renderStaging(){const items=[...state.staged.values()];els.stagedCount.textContent=`${items.length} bundle${items.length===1?"":"s"}`;els.exportKitBtn.disabled=!items.length&&!metadataDirty();if(!items.length){els.stagedList.innerHTML=`<div class="staged-empty">Built bundles will appear here.</div>`}else{els.stagedList.innerHTML=items.map(item=>`<div class="staged-item"><div><strong>${esc(item.key)}</strong><span>${item.assetCount} PNGs · ${esc(item.md5)}</span></div><button data-download="${attr(item.key)}">DOWNLOAD</button></div>`).join("");els.stagedList.querySelectorAll("[data-download]").forEach(btn=>btn.addEventListener("click",()=>{const item=state.staged.get(btn.dataset.download);downloadBlob(item.blob,item.filename)}))}renderGitHubSyncStatus()}
async function exportKit(){
  if(!window.zip)return toast("ZIP library unavailable.","bad");
  if(!state.staged.size&&!metadataDirty())return toast("Nothing staged yet.","bad");
  els.exportKitBtn.disabled=true;
  els.exportKitBtn.textContent="PACKAGING…";
  try{
    const writer=new zip.ZipWriter(new zip.BlobWriter("application/zip"));
    for(const item of state.staged.values()){
      await writer.add(`dev/2.0.0/${item.filename}`,new zip.BlobReader(item.blob),{level:0});
    }
    await writer.add("dev/2.0.0/manifest_hashes",new zip.TextReader(JSON.stringify(state.manifest,null,4)));
    await writer.add("qa/themeData.json",new zip.TextReader(JSON.stringify(state.themeData,null,2)));
    await writer.add("qa/wallpaperData.json",new zip.TextReader(JSON.stringify(state.wallpaperData,null,2)));
    const snapshot={
      exported_at:new Date().toISOString(),
      source:"SHINING Catalog Studio local export",
      metadata_fingerprint:await metadataFingerprint(),
      staged_bundles:state.staged.size,
      theme_groups:Object.keys(state.themeData||{}).length,
      wallpapers:Array.isArray(state.wallpaperData)?state.wallpaperData.length:0
    };
    await writer.add("METADATA_SNAPSHOT.json",new zip.TextReader(JSON.stringify(snapshot,null,2)));
    await writer.add("README_UPDATE.txt",new zip.TextReader([
      "SHINING SUPERSTAR — Catalog Studio update kit",
      "",
      "This kit was exported locally. No GitHub token or pre-export repository write was required.",
      "1. Review the bundled metadata snapshot.",
      "2. Copy bundle files + dev/2.0.0/manifest_hashes into the repository.",
      "3. Copy qa/themeData.json / qa/wallpaperData.json if those files changed.",
      "4. Commit/push the update when you are ready.",
      "5. Run GitHub Action: Publish catalog assets.",
      "6. Use Publish Center for backend sync after publishing.",
      "",
      `Generated: ${new Date().toISOString()}`
    ].join("\n")));
    downloadBlob(await writer.close(),`shining_catalog_update_${Date.now()}.zip`);
    toast("Update kit exported locally.");
  }catch(error){
    console.error(error);
    toast(error.message||"Export failed.","bad");
  }finally{
    els.exportKitBtn.disabled=!state.staged.size&&!metadataDirty();
    els.exportKitBtn.textContent="EXPORT UPDATE KIT";
  }
}
function metadataDraftPresent(){return Object.keys(state.draft.themeGroups||{}).length>0||Object.keys(state.draft.wallpapers||{}).length>0||state.edits.theme||state.edits.wallpaper}
function metadataDirty(){if(!metadataDraftPresent())return false;const sync=state.draft.metadataSync||{};return !sync.fingerprint||!sync.currentFingerprint||sync.fingerprint!==sync.currentFingerprint}
async function refreshMetadataDirtyState(){state.draft.metadataSync||={};state.draft.metadataSync.currentFingerprint=await metadataFingerprint();persistLocalDraft();renderGitHubSyncStatus()}
function renderGitHubSyncStatus(){if(!els.githubSyncStatus)return;const sync=state.draft.metadataSync||{};let label="NOT REQUIRED",cls="";if(state.githubSync.working){label="SYNCING";cls="working"}else if(metadataDirty()){label="PENDING";cls="pending"}else if(sync.verifiedAt){label="VERIFIED";cls="verified"}els.githubSyncStatus.className=`sync-badge ${cls}`.trim();els.githubSyncStatus.textContent=label;if(!state.githubSync.working&&sync.verifiedAt&&!metadataDirty()){const when=new Date(sync.verifiedAt).toLocaleString();els.githubSyncOutput.textContent=`Verified on GitHub\n${when}\n${sync.fingerprint||""}`}}
function githubHeaders(token){return{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"}}
function utf8ToBase64(text){const bytes=new TextEncoder().encode(text);let binary="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
function base64ToUtf8(base64){const binary=atob(String(base64||"").replace(/\n/g,""));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
async function githubGetFile(path,token){const r=await fetch(`${GITHUB_API}/contents/${path}?ref=${encodeURIComponent(GITHUB_BRANCH)}&v=${Date.now()}`,{headers:githubHeaders(token),cache:"no-store"});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`GitHub ${path}: HTTP ${r.status} ${body.message||""}`.trim());return body}
async function githubWriteJson(path,value,token,message){const current=await githubGetFile(path,token);const content=JSON.stringify(value,null,2)+"\n";const r=await fetch(`${GITHUB_API}/contents/${path}`,{method:"PUT",headers:githubHeaders(token),body:JSON.stringify({message,content:utf8ToBase64(content),sha:current.sha,branch:GITHUB_BRANCH})});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`GitHub write ${path}: HTTP ${r.status} ${body.message||""}`.trim());return{path,contentSha:body.content?.sha||null,commitSha:body.commit?.sha||null}}
async function githubVerifyJson(path,expected,token){const remote=await githubGetFile(path,token);const parsed=JSON.parse(base64ToUtf8(remote.content));if(canonicalJson(parsed)!==canonicalJson(expected))throw new Error(`${path} verification mismatch after GitHub write.`);return{path,sha:remote.sha}}
async function syncMetadataToGitHub({interactive=false}={}){if(state.githubSync.working)return{ok:false,error:"GitHub metadata sync is already running."};const needsTheme=Object.keys(state.draft.themeGroups||{}).length>0||state.edits.theme;const needsWall=Object.keys(state.draft.wallpapers||{}).length>0||state.edits.wallpaper;await refreshMetadataDirtyState();if(!metadataDirty()){if(interactive)toast("Metadata is already verified on GitHub.");return{ok:true,already:true}}const token=els.githubToken.value.trim();if(!token){els.githubSyncOutput.textContent="GitHub confirmation is required before export. Enter a fine-grained token with Contents read/write access to kesharrpm/shining-superstar. It stays only in this tab.";renderGitHubSyncStatus();if(interactive)toast("Enter the GitHub token first.","bad");return{ok:false,error:"Enter the GitHub token in Data Confirmation before exporting."}}state.githubSync.working=true;renderGitHubSyncStatus();els.githubSyncBtn.disabled=true;els.githubSyncOutput.textContent="Connecting to GitHub…";try{const writes=[];if(needsTheme){els.githubSyncOutput.textContent="Writing qa/themeData.json…";writes.push(await githubWriteJson("qa/themeData.json",state.themeData,token,"Catalog Studio: sync theme metadata"))}if(needsWall){els.githubSyncOutput.textContent="Writing qa/wallpaperData.json…";writes.push(await githubWriteJson("qa/wallpaperData.json",state.wallpaperData,token,"Catalog Studio: sync wallpaper metadata"))}els.githubSyncOutput.textContent="Verifying committed data from GitHub…";const files={};if(needsTheme){const v=await githubVerifyJson("qa/themeData.json",state.themeData,token);files.themeData=v.sha}if(needsWall){const v=await githubVerifyJson("qa/wallpaperData.json",state.wallpaperData,token);files.wallpaperData=v.sha}const fingerprint=await metadataFingerprint();state.draft.metadataSync={fingerprint,currentFingerprint:fingerprint,verifiedAt:new Date().toISOString(),files,commits:writes.map(x=>x.commitSha).filter(Boolean)};state.edits.theme=false;state.edits.wallpaper=false;persistLocalDraft();els.githubSyncOutput.textContent=`VERIFIED ✓\nRepository: ${GITHUB_REPO}\nBranch: ${GITHUB_BRANCH}\nFingerprint: ${fingerprint}\n${writes.map(x=>`${x.path} → ${x.commitSha||x.contentSha||"updated"}`).join("\n")}`;toast("GitHub metadata synced and verified.");return{ok:true,fingerprint,files}}catch(error){console.error(error);els.githubSyncStatus.className="sync-badge failed";els.githubSyncStatus.textContent="FAILED";els.githubSyncOutput.textContent=`SYNC FAILED\n${error.message}`;toast(error.message||"GitHub sync failed.","bad");return{ok:false,error:error.message}}finally{state.githubSync.working=false;els.githubSyncBtn.disabled=false;renderGitHubSyncStatus();renderStaging()}}
function hydrateMetaGroup(){const info=state.themeData[els.metaGroup.value.trim()];els.metaMembers.value=info?(info.members||[]).join("\n"):""}
function applyThemeData(){const group=els.metaGroup.value.trim(),theme=els.metaTheme.value.trim();if(!group||!theme)return toast("Group and theme are required.","bad");const isNewGroup=!state.themeData[group],members=els.metaMembers.value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean),info=state.themeData[group]||{members:[],themes:[],le_themes:[],availability:{}};if(members.length)info.members=[...new Set(members)];info.themes=[...(info.themes||[])].filter(x=>x!==theme);info.le_themes=[...(info.le_themes||[])].filter(x=>x!==theme);(els.metaLE.checked?info.le_themes:info.themes).push(theme);info.themes=[...new Set(info.themes)];info.le_themes=[...new Set(info.le_themes)];info.availability||={};info.availability[theme]={type:els.metaType.value,in_pool:els.metaPool.value==="true"?true:els.metaPool.value==="false"?false:"le"};state.themeData[group]=info;state.edits.theme=true;state.draft.themeGroups[group]=structuredClone(info);state.draft.selection={...(state.draft.selection||{}),group,theme};persistLocalDraft();refreshMetadataDirtyState();refreshProjectUI(group,theme);els.metaGroup.value=group;els.metaTheme.value=theme;els.metaMembers.value=info.members.join("\n");els.metadataLog.textContent=`${isNewGroup?"New group created":"Theme updated"}: ${group} → ${theme}. AUTOSAVED locally — you can reload without re-entering it.`;renderStaging();rememberSelection();toast(isNewGroup?"New group + theme autosaved.":"Theme metadata autosaved.")}
function applyWallpaper(){const id=els.wpId.value.trim(),group=els.wpGroup.value.trim(),name=els.wpName.value.trim();if(!id||!group||!name||!els.wpUrl.value.trim())return toast("ID, group, name, and URL are required.","bad");const record={id,group,type:els.wpType.value,name,url:els.wpUrl.value.trim(),cost:Number(els.wpCost.value||0),currency:els.wpCurrency.value},i=state.wallpaperData.findIndex(x=>String(x.id)===id);if(i>=0)state.wallpaperData[i]=record;else state.wallpaperData.push(record);state.edits.wallpaper=true;state.draft.wallpapers[id]=structuredClone(record);persistLocalDraft();refreshMetadataDirtyState();updateStats();renderStaging();els.metadataLog.textContent=`Wallpaper ${i>=0?"updated":"added"}: ${id} · ${name}. AUTOSAVED locally.`;toast("Wallpaper metadata autosaved.")}
async function loadIndex(){els.loadIndexBtn.disabled=true;els.loadIndexBtn.textContent="LOADING…";try{const r=await fetch(`${INDEX_URL}?v=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error(`Index HTTP ${r.status}`);state.index=await r.json();renderBindings();toast("Published index loaded.")}catch(error){console.error(error);els.indexMeta.textContent=error.message;toast("Could not load catalog_index.json.","bad")}finally{els.loadIndexBtn.disabled=false;els.loadIndexBtn.textContent="REFRESH INDEX"}}
function renderBindings(){if(!state.index)return;const bindings=Object.entries(state.index.bindings||{}),q=els.indexSearch.value.trim().toLowerCase(),category=els.indexCategory.value,filtered=bindings.filter(([key])=>(category==="all"||key.startsWith(`${category}:`))&&(!q||q.split(/\s+/).every(token=>key.toLowerCase().includes(token)))).slice(0,500);els.indexMeta.innerHTML=`<span>Version <b>${esc(state.index.version||"—")}</b></span><span>${Object.keys(state.index.assets||{}).length} assets</span><span>${bindings.length} bindings</span><span>Showing ${filtered.length}${filtered.length===500?"+":""}</span>`;els.bindingList.innerHTML=filtered.length?filtered.map(([key,assetId])=>{const url=workerAssetUrl(key,state.index.version);return`<div class="binding-item"><div class="binding-key">${esc(key)}</div><div class="binding-asset">${esc(assetId)}</div><div class="binding-actions"><button data-copy-key="${attr(key)}">COPY ID</button><button data-open-url="${attr(url)}">OPEN</button></div></div>`}).join(""):`<div class="staged-empty">No logical assets match this search.</div>`;els.bindingList.querySelectorAll("[data-copy-key]").forEach(btn=>btn.addEventListener("click",async()=>{await navigator.clipboard.writeText(btn.dataset.copyKey);toast("Logical ID copied.")}));els.bindingList.querySelectorAll("[data-open-url]").forEach(btn=>btn.addEventListener("click",()=>window.open(btn.dataset.openUrl,"_blank","noopener")))}
function workerAssetUrl(key,version="current"){return`${WORKER_BASE}/a/${encodeURIComponent(version)}/${encodeURIComponent(key)}`}
async function cloudCall(path,method){const token=els.adminToken.value;if(!token)return toast("Enter your admin token for this session.","bad");els.cloudOutput.textContent=`${method} ${path}\nWorking…`;try{const r=await fetch(`${WORKER_BASE}${path}`,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}}),text=await r.text();let value=text;try{value=JSON.parse(text)}catch{}els.cloudOutput.textContent=`HTTP ${r.status}\n${typeof value==="string"?value:JSON.stringify(value,null,2)}`;toast(r.ok?"Cloudflare request complete.":`Cloudflare returned HTTP ${r.status}.`,r.ok?"good":"bad")}catch(error){els.cloudOutput.textContent=String(error);toast("Cloudflare request failed.","bad")}}
function setSourceStatus(mode,text){els.sourceStatus.className=`source-status ${mode==="ready"?"ready":mode==="error"?"error":""}`;els.sourceStatus.querySelector("span:last-child").textContent=text}
function toggleSecret(input,button){const show=input.type==="password";input.type=show?"text":"password";button.textContent=show?"HIDE":"SHOW"}
function toast(message,type="good"){els.toast.textContent=message;els.toast.className=`toast show ${type}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>els.toast.className="toast",2600)}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function slug(value){return String(value??"").trim().toLowerCase().replace(/[’']/g,"").replace(/&/g,"and").replace(/\s+/g,"_").replace(/[^a-z0-9_.-]/g,"").replace(/_+/g,"_").replace(/^_+|_+$/g,"")}
function normAlias(value){return String(value||"").replace(/\\/g,"/").split("/").pop().replace(/\.(png|webp|jpe?g)$/i,"").toLowerCase()}
function randomHex(length){const bytes=crypto.getRandomValues(new Uint8Array(Math.ceil(length/2)));return[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,length)}
function prettyBytes(n){if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}function attr(value){return esc(value)}
