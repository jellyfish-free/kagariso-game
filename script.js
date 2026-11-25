/* 神狩荘・フロントエンド 初期版。外部ライブラリなし。 */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const API=(window.KAGARISO_API_BASE||'').replace(/\/$/,'');
const SESSION_KEY='kagariso_starter_session_v1';
const ADMIN_SESSION_KEY='kagariso_admin_session_v0115';
let adminToken=sessionStorage.getItem(ADMIN_SESSION_KEY)||'';
let adminTopicsCache=[],adminSelected=null;
let adminRequestsCache=[],adminRequestSelected=null;
let token=localStorage.getItem(SESSION_KEY)||'';
let resident=null, currentNpc=null, lastLocation=null, profileScene='', profileTimer=null;
let pendingRecovery='';
let inventoryReturn='hall';
let gathering=false;
let npcReturn='hall', mandatoryStory=false;
const pages=['auth','recovery','hall','npc','conversation','room','private-room','history','cave','cave-story','inventory','material-catalog','npc-requests','npc-diary','npc-gifts','gift-history','npc-words','word-history','npc-feeding','admin-login','admin-editor','forest-event','forest','forest-area','forest-memories','sea','sea-event','front-event','moon-event','build-event','pyoro','pyoro-conversation','pyoro-history','pyoro-feeding','pyoro-requests','pyoro-words','pyoro-word-history','pyoro-diary','pyoro-gifts','pair-memories','workshop','clothing','cooking','cooking-recipe','moon','greenhouse'];
let activePage='';
const show=(name)=>{
  const changed=activePage!==name; activePage=name;
  pages.forEach(p=>$(`#${p}-page`).classList.toggle('hidden',p!==name));
  if(name==='workshop')refreshClothing();
  if(name!=='npc'&&profileTimer){clearInterval(profileTimer);profileTimer=null;}
  if(name!=='pyoro'&&pyoroProfileTimer){clearInterval(pyoroProfileTimer);pyoroProfileTimer=null;}
  if(changed){if(name!=='cave')caveOpening++;window.scrollTo({top:0,behavior:'instant'});}
};
const toast=(message)=>{const box=$('#toast');box.textContent=message;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),4000);};
const api=async(path,method='GET',payload)=>{
  if(!API) throw new Error('config.js にAPIのURLを設定してください。');
  const response=await fetch(`${API}/api${path}`,{method,headers:{...(token?{'Authorization':`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  let data;try{data=await response.json();}catch{throw new Error('サーバーから応答を読み取れません。');}
  if(!response.ok){if(response.status===401&&path!=='/recover'){token='';localStorage.removeItem(SESSION_KEY);show('auth');}throw new Error(data.error||'処理に失敗しました。');}
  return data;
};
let clothingCheck=0;
async function refreshClothing(){
 const check=++clothingCheck,button=$('#workshop-enter-clothing');button.disabled=true;button.classList.add('workshop-choice-disabled');$('#clothing-hint').textContent='解放状況を確認中…';
 try{const data=await api('/clothing/unlock');if(check!==clothingCheck)return;button.disabled=!data.unlocked;button.classList.toggle('workshop-choice-disabled',!data.unlocked);$('#clothing-hint').textContent=data.unlocked?'裁縫や染色を行う場所':'温室で花を収穫すると解放されます';}catch(e){if(check===clothingCheck)$('#clothing-hint').textContent='解放状況を確認できませんでした';}
}
$('#workshop-enter-clothing').onclick=async()=>{try{if((await api('/clothing/unlock')).unlocked){show('clothing');await openClothingRecipes();}}catch(e){toast(e.message);}};
$('#clothing-back').onclick=()=>show('workshop');
$('#clothing-hall-back').onclick=async()=>{if(clothBusy)return;try{await openHall();}catch(e){toast(e.message);}};
window.KAGARISO_SEA_BRIDGE={api,show,openHall:()=>openHall(),checkEvents:()=>checkSeaEvents()};
window.KAGARISO_COOKING_BRIDGE={api,show,openHall:()=>openHall(),checkEvents:()=>checkSeaEvents()};
const openCookingFromProfile=()=>window.KAGARISO_COOKING.open();
const safe=(text)=>String(text??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// v0.15.3: 図鑑の表示もサーバーの新しいレア度に合わせる。
const FOREST_MATERIALS=[{"id":"S0046","name":"土","rarity":1,"category":"鉱石・土","sections":[],"source":"森","image":"images/materials/sozai0046.webp","description":"土。森で見つけられる素材。"},{"id":"S0047","name":"腐葉土","rarity":2,"category":"鉱石・土","sections":[],"source":"森","image":"images/materials/sozai0047.webp","description":"腐葉土。森で見つけられる素材。"},{"id":"S0048","name":"みみず","rarity":1,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0048.webp","description":"みみず。森で見つけられる素材。"},{"id":"S0049","name":"苔","rarity":1,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0049.webp","description":"苔。森で見つけられる素材。"},{"id":"S0050","name":"落ちた木の実","rarity":1,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0050.webp","description":"落ちた木の実。森で見つけられる素材。"},{"id":"S0051","name":"小枝の束","rarity":1,"category":"木材・繊維","sections":[],"source":"森","image":"images/materials/sozai0051.webp","description":"小枝の束。森で見つけられる素材。"},{"id":"S0052","name":"丈夫な枝","rarity":2,"category":"木材・繊維","sections":[],"source":"森","image":"images/materials/sozai0052.webp","description":"丈夫な枝。森で見つけられる素材。"},{"id":"S0053","name":"木材","rarity":2,"category":"木材・繊維","sections":[],"source":"森","image":"images/materials/sozai0053.webp","description":"木材。森で見つけられる素材。"},{"id":"S0054","name":"葉っぱ","rarity":1,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0054.webp","description":"葉っぱ。森で見つけられる素材。"},{"id":"S0055","name":"琥珀色の樹液","rarity":3,"category":"液体・甘味","sections":[],"source":"森","image":"images/materials/sozai0055.webp","description":"琥珀色の樹液。森で見つけられる素材。"},{"id":"S0056","name":"森の赤い木の実","rarity":2,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0056.webp","description":"森の赤い木の実。森で見つけられる素材。"},{"id":"S0057","name":"山ぶどう","rarity":3,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0057.webp","description":"山ぶどう。森で見つけられる素材。"},{"id":"S0058","name":"野生の木苺","rarity":2,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0058.webp","description":"野生の木苺。森で見つけられる素材。"},{"id":"S0059","name":"小鳥の羽根","rarity":2,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0059.webp","description":"小鳥の羽根。森で見つけられる素材。"},{"id":"S0060","name":"獣の抜け毛","rarity":1,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0060.webp","description":"獣の抜け毛。森で見つけられる素材。"},{"id":"S0061","name":"鹿の落とし角","rarity":4,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0061.webp","description":"鹿の落とし角。森で見つけられる素材。"},{"id":"S0062","name":"空っぽの巣","rarity":3,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0062.webp","description":"空っぽの巣。森で見つけられる素材。"},{"id":"S0063","name":"森の湧き水","rarity":3,"category":"液体・甘味","sections":[],"source":"森","image":"images/materials/sozai0063.webp","description":"森の湧き水。森で見つけられる素材。"},{"id":"S0064","name":"森の蜂蜜","rarity":4,"category":"液体・甘味","sections":[],"source":"森","image":"images/materials/sozai0064.webp","description":"森の蜂蜜。森で見つけられる素材。"},{"id":"S0065","name":"香りのよい若葉","rarity":3,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0065.webp","description":"香りのよい若葉。森で見つけられる素材。"},{"id":"S0066","name":"りんご","rarity":2,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0066.webp","description":"りんご。森で見つけられる素材。"},{"id":"S0067","name":"小魚","rarity":3,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0067.webp","description":"小魚。森で見つけられる素材。"},{"id":"S0068","name":"岩魚","rarity":4,"category":"生き物由来","sections":[],"source":"森","image":"images/materials/sozai0068.webp","description":"岩魚。森で見つけられる素材。"},{"id":"S0069","name":"錆びた鉄釘","rarity":3,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0069.webp","description":"錆びた鉄釘。森で見つけられる素材。"},{"id":"S0070","name":"真鍮の歯車","rarity":5,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0070.webp","description":"真鍮の歯車。森で見つけられる素材。"},{"id":"S0071","name":"小さな真鍮の鍵","rarity":5,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0071.webp","description":"小さな真鍮の鍵。森で見つけられる素材。"},{"id":"S0072","name":"星読みの羅針盤","rarity":5,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0072.webp","description":"星読みの羅針盤。森で見つけられる素材。"},{"id":"S0073","name":"夕焼けの色眼鏡","rarity":5,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0073.webp","description":"夕焼けの色眼鏡。森で見つけられる素材。"},{"id":"S0074","name":"おばけの種","rarity":5,"category":"植物・菌類","sections":[],"source":"森","image":"images/materials/sozai0074.webp","description":"おばけの種。森で見つけられる素材。"},{"id":"S0075","name":"雨粒の小瓶","rarity":5,"category":"落とし物","sections":[],"source":"森","image":"images/materials/sozai0075.webp","description":"雨粒の小瓶。森で見つけられる素材。"}];
const FOREST_AREAS=[{"id":1,"name":"灯りの森","description":"木々の間に小さな灯りが揺れている。森の香りが漂う。","image":"images/backgrounds/forest1.webp","spots":[{"id":"f1-1","name":"木々の周辺","items":["S0051","S0052","S0053","S0055","S0046","C026"]},{"id":"f1-2","name":"草花の群生地","items":["S0046","S0047","S0048","S0049","S0054","S0065","S0074","S0005"]},{"id":"f1-3","name":"実のなる木","items":["S0050","S0056","S0057","S0058","S0066"]},{"id":"f1-4","name":"獣たちの痕跡","items":["S0059","S0060","S0061","S0062","S0064","S0073"]}]},{"id":2,"name":"水辺の小道","description":"澄んだ水が流れ、木橋の向こうから滝の音が聞こえる。","image":"images/backgrounds/forest2.webp","spots":[{"id":"f2-1","name":"川の浅瀬","items":["S0046","S0048","S0063","S0067","S0007"]},{"id":"f2-2","name":"滝つぼ","items":["S0049","S0063","S0068","S0075","S0007"]},{"id":"f2-3","name":"川辺の草むら","items":["S0047","S0048","S0054","S0058","S0065","S0005"]},{"id":"f2-4","name":"木橋の周辺","items":["S0069","S0071","C026","C028","C002"]}]},{"id":3,"name":"朽ちた遺跡","description":"苔むした石壁と古い柱が残る、静かな遺跡。","image":"images/backgrounds/forest3.webp","spots":[{"id":"f3-1","name":"崩れた石壁","items":["S0046","S0049","S0069","S0007","C002"]},{"id":"f3-2","name":"朽ちた建造物","items":["S0051","S0053","S0069","S0070","C026","C028"]},{"id":"f3-3","name":"遺跡の草むら","items":["S0047","S0048","S0049","S0054","S0060","S0065","S0005"]},{"id":"f3-4","name":"古い祭壇の周辺","items":["S0049","S0059","S0072","S0007","C002"]}]}];
const SEA_ITEMS=window.KAGARISO_SEA_ITEMS||[];
let frontCookingUnlocked=false;
let moonDoorUnlocked=false;
let greenhouseUnlocked=false;
let seaState=null;
const FOREST_COMMON=new Set(["C026","C002","S0005","S0007","C028"]);
const MATERIALS=[...(window.KAGARISO_MATERIALS||[]),...FOREST_MATERIALS,...SEA_ITEMS,...(window.KAGARISO_GREENHOUSE?.items||[])].map(m=>['S0039','S0040'].includes(m.id)?{...m,rarity:5}:m);
const materialById=id=>MATERIALS.find(m=>m.id===id);
const matIcon=(id)=>{const m=materialById(id);return m?`<img class="material-thumb" src="${safe(m.image)}" alt="" loading="lazy" onerror="this.style.display='none'">`:'';};

const handler=fn=>async(event)=>{try{await fn(event);}catch(err){toast(err.message||'エラーが発生しました。');}};
const bind=(selector,fn)=>$(selector).addEventListener('click',handler(fn));
const login=(data)=>{token=data.token;localStorage.setItem(SESSION_KEY,token);pendingRecovery=data.recoveryCode;$('#recovery-output').textContent=pendingRecovery;$('#confirmed-recovery').checked=false;$('#enter-after-recovery').disabled=true;show('recovery');};
const switchTab=(recover)=>{$('#tab-register').classList.toggle('active',!recover);$('#tab-recover').classList.toggle('active',recover);$('#register-form').classList.toggle('hidden',recover);$('#recover-form').classList.toggle('hidden',!recover);};
$('#tab-register').onclick=()=>switchTab(false);
$('#tab-recover').onclick=()=>switchTab(true);
$('#register-form').addEventListener('submit',handler(async e=>{e.preventDefault();login(await api('/register','POST',{name:$('#register-name').value}));}));
$('#recover-form').addEventListener('submit',handler(async e=>{e.preventDefault();login(await api('/recover','POST',{name:$('#recover-name').value,recoveryCode:$('#recover-code').value}));}));
bind('#copy-recovery',async()=>{await navigator.clipboard.writeText(pendingRecovery);toast('復旧コードをコピーしました。');});
$('#confirmed-recovery').addEventListener('change',e=>{$('#enter-after-recovery').disabled=!e.target.checked;});
bind('#enter-after-recovery',async()=>{pendingRecovery='';await openHall();});
bind('#logout-btn',async()=>{try{await api('/logout','POST');}finally{token='';resident=null;$('#game-notifications').replaceChildren();localStorage.removeItem(SESSION_KEY);$('#user-bar').classList.add('hidden');show('auth');}});
// v0.11.2: ビジュアルはD1のNPC状態を表示するだけ。更新や判定は従来APIに委ねる。
const VISUALS=window.KAGARISO_VISUALS||{};
const paperVisual=VISUALS.npcs?.paper;
const bgVisual=VISUALS.backgrounds||{};

// v0.11.8: ホール背景の時間帯・ゲーム内天気切り替え。
// 世界内の架空の天気を、日本時間の日付で全住人に共通化する。
// ※現時点では実際の気象データ/APIとは連動しません。
const HALL_SETTINGS=window.KAGARISO_HALL_SETTINGS||{};
const HALL_BG_DIR=HALL_SETTINGS.basePath||'images/backgrounds/';
const HALL_IMAGE_NAMES={
  clear:{morning:'hall1',day:'hall2',evening:'hall3',night:'hall4'},
  cloud:{morning:'hall2-cloud',day:'hall2-cloud',evening:'hall3-cloud',night:'hall4-cloud'}
};
const hallJstFormat=new Intl.DateTimeFormat('en-CA',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
});
const hallJapanClock=()=>{
  const p=Object.fromEntries(hallJstFormat.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
};
const hallTimeBand=(hour)=>hour>=5&&hour<11?'morning':hour>=11&&hour<17?'day':hour>=17&&hour<19?'evening':'night';
const hallDailyWeather=(day)=>{
  // 同じ日付なら、ログイン端末や再読み込みに関係なく同じ天気。
  let h=2166136261;
  for(const c of `kagariso-hall:${day}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  const cloudProbability=Math.max(0,Math.min(100,Number(HALL_SETTINGS.cloudProbability??30)));
  return (h>>>0)%100<cloudProbability?'cloud':'clear';
};
const hallWeather=(day)=>{
  const mode=HALL_SETTINGS.weatherMode;
  return mode==='clear'||mode==='cloud'?mode:hallDailyWeather(day);
};
let hallBuildLevel=1, roomLevels={paper:0,pyoro:0};
const privateRoomImage=(npc,level)=>{const t=hallJapanClock(),band=hallTimeBand(t.hour),cloud=hallWeather(t.day)!=='clear';return `images/backgrounds/${npc}RoomLv${level}-${band==='evening'?2:band==='night'?(cloud?5:3):cloud?4:1}.webp`;};
function renderPrivateRoomLinks(data){if(!data?.rooms)return;roomLevels=data.rooms;const el=$('#private-room-links');el.innerHTML=Object.entries(roomLevels).filter(([,lv])=>lv>0).map(([npc,lv])=>`<button class="secondary" data-private-room="${npc}">${npc==='paper'?'黄色い獣':'赤色の獣'}のおへや</button>`).join('');el.classList.toggle('hidden',!Object.values(roomLevels).some(Boolean));el.querySelectorAll('button').forEach(btn=>btn.onclick=handler(()=>openPrivateRoom(btn.dataset.privateRoom)));}
async function openPrivateRoom(npc){const data=await api('/hall');renderPrivateRoomLinks(data.build);const lv=roomLevels[npc];if(!lv)return;const n=data.npcs.find(x=>x.id===npc);$('#private-room-title').textContent=(npc==='paper'?'黄色い獣':'赤色の獣')+'のおへや';$('#private-room-bg').src=privateRoomImage(npc,lv);const here=n?.state.location==='room';const actor=$('#private-room-actor');actor.classList.toggle('hidden',!here);if(here){if(npc==='paper')paintPaper('#private-room-actor img',n);else paintPyoro('#private-room-actor img',n);actor.style.left=/^(desk_|shelf_)/.test(n.state.furnitureAction||'')?'86%':n.state.furnitureAction?(npc==='paper'?'53%':'65%'):n.state.activity==='sleeping'?'30%':lv>=3&&n.state.activity==='resting'?'65%':'53%';actor.style.bottom=/^(desk_|shelf_)/.test(n.state.furnitureAction||'')?'18%':n.state.furnitureAction?(npc==='paper'?'35%':'15%'):n.state.activity==='sleeping'?'30%':lv>=3&&n.state.activity==='resting'?'15%':'8%';$('#private-room-sleep').classList.toggle('hidden',n.state.activity!=='sleeping');}$('#private-room-status').textContent=here?n.state.activityLabel:'今はおへやにいないようだ。';
 const button=$('#private-room-talk'),sleeping=n?.state.activity==='sleeping';
 button.classList.remove('hidden');button.textContent=sleeping&&n?.affinity>=8?'そっと声をかけて起こす':'話しかける';
 button.disabled=!here||n.affinity<3||(sleeping&&n.affinity<8);
 const msg=$('#private-room-message');msg.classList.add('hidden');msg.textContent='';
 button.onclick=handler(async()=>{if(button.disabled)return;button.disabled=true;try{const result=await api(`/npcs/${npc}/room/enter`,'POST',{});if(result.allowed){await (npc==='paper'?openConversation():openPyoroConversation());}else{msg.textContent=result.message;msg.classList.remove('hidden');}}finally{button.disabled=!here||n.affinity<3||(sleeping&&n.affinity<8);}});
 show('private-room');}

const hallBackgroundName=()=>{
  const t=hallJapanClock();
  const band=hallTimeBand(t.hour),weather=hallWeather(t.day);
  const hallLevelPrefix=hallBuildLevel>=3?'hallLv3-':hallBuildLevel>=2?'hallLv2-':'';
  if(hallLevelPrefix)return hallLevelPrefix+(weather==='cloud'?(band==='night'?6:band==='evening'?3:5):({morning:1,day:2,evening:3,night:4}[band]));
  return HALL_IMAGE_NAMES[weather][band];
};
const hallBackgroundFiles=(name)=>{
  const fallback=bgVisual.hall||'images/backgrounds/hall.png';
  return [`${HALL_BG_DIR}${name}.webp`,`${HALL_BG_DIR}${name}.png`,fallback];
};
const applyImageFallback=(img,files,datasetKey='visualSrc')=>{
  if(!img||!files?.length)return;
  const cacheKey=files.join('|');
  if(img.dataset[datasetKey]===cacheKey)return;
  img.dataset[datasetKey]=cacheKey;
  let step=0;
  img.onerror=()=>{
    step+=1;
    if(step<files.length){img.src=encodeURI(files[step]);}
    else{img.classList.add('visual-error');}
  };
  img.onload=()=>img.classList.remove('visual-error');
  img.src=encodeURI(files[0]);
};
const updateHallBackground=()=>{
  const img=$('#hall-background');
  if(!img)return;
  const name=hallBackgroundName();
  applyImageFallback(img,hallBackgroundFiles(name),'hallBackground');
};
const updateConversationBackground=()=>{
  const img=$('#conversation-background');
  if(!img||!currentNpc)return;
  if(currentNpc.state.location==='room'){const lv=Number(currentNpc.roomLevel||roomLevels.paper||1);applyImageFallback(img,[privateRoomImage('paper',lv)],'conversationBackground');return;}
  if(currentNpc.state.location==='cave'){
    applyImageFallback(img,[bgVisual.cave||bgVisual.hall||'images/backgrounds/cave.png'],'conversationBackground');
    return;
  }
  const name=hallBackgroundName();
  img.dataset.hallBackground=name;
  applyImageFallback(img,hallBackgroundFiles(name),'conversationBackground');
};
const hallSceneHash=(value)=>{let h=0;for(const c of String(value||'')){h=(h*33+c.charCodeAt(0))>>>0;}return h>>>0;};
const resetHallActorLayout=actor=>{
  if(!actor)return;
  actor.classList.remove('hall-lounge-actor','hall-chatting');
  actor.style.left='';actor.style.top='';actor.style.width='';actor.style.bottom='';actor.style.transform='';
};
const ensureHallActorBubble=actor=>{
  if(!actor||actor.querySelector('.hall-chat-bubble'))return;
  const bubble=document.createElement('span');
  bubble.className='hall-chat-bubble';
  bubble.textContent='…';
  bubble.setAttribute('aria-hidden','true');
  actor.append(bubble);
};
const placeHallActor=(actor,{x,y,width=15,chatting=false,scale=1}={})=>{
  if(!actor)return;
  ensureHallActorBubble(actor);
  actor.classList.add('hall-lounge-actor');
  actor.classList.toggle('hall-chatting',!!chatting);
  actor.style.left=`${x}%`;
  actor.style.top=`${y}%`;
  actor.style.width=`${width}%`;
  actor.style.bottom='auto';
  actor.style.transform=`translate(-50%,-100%) scale(${scale})`;
};
const updateHallLoungeActors=(paperNpc,pyoroNpc)=>{
  const paperActor=$('#hall-paper-actor'),pyoroActor=$('#hall-pyoro-actor');
  if(!paperActor||!pyoroActor)return;
  resetHallActorLayout(paperActor);
  resetHallActorLayout(pyoroActor);
  const paperHere=!!paperNpc&&paperActor&&!paperActor.classList.contains('hidden');
  const pyoroHere=!!pyoroNpc&&pyoroActor&&!pyoroActor.classList.contains('hidden');
  if(hallBuildLevel<2||(!paperHere&&!pyoroHere))return;
  const block=Math.floor(Date.now()/(10*60*1000));
  const scene=hallSceneHash(`${resident?.id||''}:${hallBuildLevel}:${block}`)%4;
  const paperAwake=paperNpc?.state?.activity!=='sleeping';
  const pyoroAwake=pyoroNpc?.state?.activity!=='sleeping';
  const canChat=paperHere&&pyoroHere&&paperAwake&&pyoroAwake;
  const talking=canChat&&(scene===0||scene===1);
  const mobileHall=window.matchMedia("(max-width: 600px)").matches;
  const baseY=mobileHall?(hallBuildLevel>=3?86:88):(hallBuildLevel>=3?84:87);
  if(talking){
    placeHallActor(paperActor,{x:46,y:baseY,width:15.5,chatting:true});
    placeHallActor(pyoroActor,{x:56,y:baseY+1,width:15.2,chatting:true,scale:.92});
    const paperLabel=$('#hall-paper-label'),pyoroLabel=$('#hall-pyoro-label');
    if(paperLabel)paperLabel.textContent='黄色い獣はおしゃべり中';
    if(pyoroLabel)pyoroLabel.textContent='赤色の獣はおしゃべり中';
    return;
  }
  if(paperHere)placeHallActor(paperActor,{x:scene===2?41:48,y:baseY,width:15.2,chatting:false});
  if(pyoroHere)placeHallActor(pyoroActor,{x:scene===3?60:54,y:baseY+1,width:15,chatting:false,scale:.92});
};
// v0.18.5.20: ホールの4つの扉の感知範囲を長方形に統一する。
// 背景画像の左上を(0,0)、右下を(1,1)とする相対座標。
// 森の扉の表示を基準とし、洞窟・海・工房の形も扉の輪郭に合わせる。
const HALL_DOOR_ZONES={
  cave:{x:0.012,y:0.250,width:0.108,height:0.460},
  forest:{x:0.150,y:0.290,width:0.110,height:0.420},
  sea:{x:0.747,y:0.270,width:0.107,height:0.450},
  front:{x:0.445,y:0.255,width:0.111,height:0.413},
  moon:{x:0.596,y:0.295,width:0.104,height:0.426},
  greenhouse:{x:0.867,y:0.20,width:0.117,height:0.52}
};
const positionHallCaveDoor=()=>{
  const image=$('#hall-background'),stage=$('#hall-visual');
  if(!image||!stage)return;
  const entries=[['cave','#hall-cave-door'],['forest','#hall-forest-door'],['sea','#hall-sea-door'],['front','#hall-front-door'],['moon','#hall-moon-door'],['greenhouse','#hall-greenhouse-door']];
  if(!image.naturalWidth||!image.naturalHeight){
    for(const [,selector] of entries)$(selector)?.classList.add('hidden');
    return;
  }
  // object-fit:contain と object-position:center を反映。スマホの余白にも対応。
  const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
  if(!stageWidth||!stageHeight)return;
  const scale=Math.min(stageWidth/image.naturalWidth,stageHeight/image.naturalHeight);
  const drawnWidth=image.naturalWidth*scale,drawnHeight=image.naturalHeight*scale;
  const offsetX=(stageWidth-drawnWidth)/2,offsetY=(stageHeight-drawnHeight)/2;
  for(const [key,selector] of entries){
    const door=$(selector),zone=HALL_DOOR_ZONES[key];
    if(!door)continue;
    const left=offsetX+drawnWidth*zone.x;
    const top=offsetY+drawnHeight*zone.y;
    const width=drawnWidth*zone.width;
    const height=drawnHeight*zone.height;
    const visible=left+width>0&&left<stageWidth&&top+height>0&&top<stageHeight;
    door.classList.toggle('hidden',!visible||(key==='front'&&!frontCookingUnlocked)||(key==='moon'&&!moonDoorUnlocked)||(key==='greenhouse'&&!greenhouseUnlocked));
    Object.assign(door.style,{
      left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`
    });
  }
};
// 背景画像が日替わり・時間帯切り替えで読み込まれたときにも位置を更新。
$('#hall-background')?.addEventListener('load',positionHallCaveDoor);
window.addEventListener('resize',positionHallCaveDoor);

// 時刻が境界を越えたら、ホールを開き直さなくても背景更新。
setInterval(()=>{
  if(document.hidden)return;
  if(!$('#hall-page')?.classList.contains('hidden')){ updateHallBackground(); updateHallLoungeActors($('#hall-paper-actor')?.classList.contains('hidden')?null:{state:{activity:$('#hall-paper-label')?.textContent.includes('おやすみ')?'sleeping':'awake'}}, $('#hall-pyoro-actor')?.classList.contains('hidden')?null:{state:{activity:$('#hall-pyoro-label')?.textContent.includes('おやすみ')?'sleeping':'awake'}}); }
  if(activePage==='conversation') refreshConversationScene('paper');
  if(activePage==='pyoro-conversation') refreshConversationScene('pyoro');
},30000);

const paperImage=(expression='normal')=>{
  // v0.11.2 hotfix: visuals.js が未配置・未読込でもログインを止めない。
  if (!paperVisual || !paperVisual.base || !paperVisual.expressions) return '';
  const file=paperVisual.expressions[expression] || paperVisual.expressions.normal || 'normal.png';
  return paperVisual.base+file;
};
const paperExpression=(npc)=>{
  const s=npc?.state||{};
  const activity=String(s.activity||'').toLowerCase(),mood=String(s.moodLabel||'');
  if(activity==='sleeping')return 'sleeping';
  if(s.fullExpression||Number(s.hunger)<=15)return 'full';
  if(activity==='resting'||activity==='sleepy'||String(s.energyLabel||'').includes('眠'))return 'sleepy';
  if(mood.includes('不機嫌')||mood.includes('怒'))return 'angry';
  if(mood.includes('落ち')||mood.includes('悲'))return 'sad';
  if(mood.includes('ご機嫌')||mood.includes('嬉')||mood.includes('上機嫌'))return 'happy';
  if(String(s.hungerLabel||'').includes('満腹'))return 'full';
  return 'normal';
};
const visualImg=(id,src)=>{
  const img=$(id); if(!img||!src)return;
  // srcは固定の公開画像パスからのみ設定。データ未登録のときは既存UIで続行。
  img.src=encodeURI(src);
  img.onerror=()=>{img.classList.add('visual-error');};
  img.onload=()=>{img.classList.remove('visual-error');};
};
const paintPaper=(id,npc,override)=>visualImg(id,paperImage(override||paperExpression(npc)));
const paperStoryAsset=(file)=>`images/npc/paper/${file}`;
const caveStoryVisualPlan=(storyId,phase,index,preCount,postCount)=>{
  const base={
    background:bgVisual.cave||'images/backgrounds/cave.png',
    paperMode:'expression',
    paperExpression:'normal',
    still:null
  };
  if(storyId==='section-2')base.background='images/backgrounds/cave2.png';
  else if(storyId==='section-3')base.background='images/backgrounds/cave3.png';
  else if(storyId==='section-4')base.background='images/backgrounds/cave4.png';
  else if(storyId==='section-5'||storyId==='rescue')base.background='images/backgrounds/cave5.png';

  if(storyId==='section-1'){
    if(phase==='pre'){
      if(index===0){base.paperMode='hidden';}
      else if(index===1){base.paperMode='src';base.paperSrc=paperStoryAsset('stand up.png');}
      else if(index===4){base.paperMode='src';base.paperSrc=paperStoryAsset('scary.png');}
    }
    if((phase==='post'&&postCount>0&&index===postCount-1)||phase==='complete'){
      base.still='images/memories/caveStill001.webp';
      base.paperMode='hidden';
    }
    return base;
  }

  if(storyId==='rescue'){
    if(phase==='pre'&&index<=1){
      base.still='images/memories/caveStill002.webp';
      base.paperMode='hidden';
      return base;
    }
    if((phase==='pre'&&index>=3)||phase==='choice'||phase==='response'||(phase==='post'&&index===0)){
      base.still='images/memories/faintPaper.webp';
      base.paperMode='hidden';
      return base;
    }
    if((phase==='post'&&index>=1)||phase==='complete'){
      base.background=bgVisual.hall||'images/backgrounds/hall.png';
      base.paperMode='expression';
      return base;
    }
    return base;
  }

  return base;
};
const applyCaveStoryVisual=(storyId,phase,index,preCount,postCount)=>{
  const visual=caveStoryVisualPlan(storyId,phase,index,preCount,postCount);
  const wrapper=$('#cave-story-visual');
  const background=$('#cave-story-background');
  const paper=$('#cave-story-paper-image');
  const still=$('#cave-story-still');
  wrapper.classList.toggle('cave-story-still-mode',!!visual.still);
  background.classList.toggle('hidden',!!visual.still);
  still.classList.toggle('hidden',!visual.still);
  if(visual.still){
    visualImg('#cave-story-still',visual.still);
    paper.classList.add('hidden');
  }else{
    visualImg('#cave-story-background',visual.background);
    if(visual.paperMode==='hidden')paper.classList.add('hidden');
    else if(visual.paperMode==='src'){paper.classList.remove('hidden');visualImg('#cave-story-paper-image',visual.paperSrc);}
    else {paper.classList.remove('hidden');paintPaper('#cave-story-paper-image',currentNpc,visual.paperExpression||'normal');}
  }
};
const stateText=(npc)=>npc.state.locationLabel;
// v0.16.1: server state is authoritative; replay never modifies the record.
let forestState=null,forestReplay=false,forestFinishing=false,forestNoticeKey='';
const updateForestHall=forest=>{
 forestState=forest;const ready=Boolean(forest?.unlocked&&forest?.seen&&forest?.eligible);
 $('#forest-door-hint').textContent=ready?'森へ':'🔒';
 $('#hall-forest-door').title=ready?'森へ':'白い扉';
 $('#forest-memory').classList.toggle('hidden',!ready);
};
const showForestEvent=replay=>{
 forestReplay=replay;$('#forest-event-unlocked').classList.toggle('hidden',replay);
 $('#forest-event-finish').textContent=replay?'思い出の一覧へ戻る':'ホールへ';show('forest-event');
};
async function openForest(){
 const {forest}=await api('/forest/status');updateForestHall(forest);
 if(!forest.unlocked||!forest.eligible){toast('白い扉はまだ開かない。');return;}
 if(!forest.seen){showForestEvent(false);return;}show('forest');
}
// v0.17.0.3: one durable encounter per resident; replay never writes.
let seaEventBusy=false;
const seaEventStory=(kind,e)=>{
 if(kind==='green')return {title:'緑の扉の向こう側',pages:[['greenDoorUnlock.webp','黄色い獣が緑の扉の前で鼻をひくひくさせている。「ねえねえ、なんかね、しょっぱいニオイがする！」'],['greenDoorUnlock.webp','前足が扉に触れると、静かに扉が開いた。その向こうには青い海と桟橋が広がっていた。「わあ！ うみだぁ！」']]};
 if(kind==='meet')return {title:'赤色の獣との出会い',pages:[['paperMeetsPyoro.webp','ホールで黄色い獣が嬉しそうにこちらを呼んだ。「ねえねえ！ '+e.finderName+'がね、うみでつったんだって！」'],['paperMeetsPyoro.webp','赤色の獣は耳を伏せた。「……つられたんじゃない。ちょっと、ひっかかっただけだ。」黄色い獣は嬉しそうに尻尾を振っている。赤色の獣は少し照れながら、こちらへ小さく頷いた。']]};
 return {title:'海から釣れた、へんなもの',pages:[['fishingPyoro.webp','いつもより重い手応え。釣り糸の先から、妙な声が聞こえた。「……っぷ、ぶくぶく……！」'],['fishingPyoro.webp','釣り上げたのは、びしょ濡れの赤色の獣だった。「べつに、おぼれてたわけじゃないからな。ちょっと、うみのなかがどうなってるのか、きになっただけだし。」'],['fishingPyoro.webp','赤色の獣は水を滴らせながら、こちらをちらりと見上げた。',true],['fishingPyoro.webp','「……なまえ、おしえて。」あなたの名前を繰り返すと、赤色の獣は小さな声で「ありがと」と呟いた。'],['paperMeetsPyoro.webp','ホールに連れて帰ると、黄色い獣が駆け寄ってきた。「キミはおよげるの？」赤色の獣は目を逸らす。「……ちょっとだけ。」「じゃあ、おともだちだね！」赤色の獣は困ったように、それでも小さく笑った。']]};
};
const seaReplies={kind:'「……だいじょうぶ。ちょっとびっくりしただけ。」',tease:'「お、おぼれてないってば！」',dry:'赤色の獣は身体を拭いてもらうと、少し安心したように耳を起こした。'};
function showSeaEvent(kind,e,replay=false){
 const story=seaEventStory(kind,e);let index=0,choice=replay?e.choice:null;
 const next=$('#sea-event-next'),buttons=$('#sea-event-choices');
 $('#sea-event-title').textContent=story.title;
 const render=()=>{const page=story.pages[index];$('#sea-event-image').src='images/memories/'+page[0];$('#sea-event-text').textContent=page[1]+(page[2]&&choice?'\n'+seaReplies[choice]:'');buttons.replaceChildren();
 next.classList.toggle('hidden',!!page[2]&&!choice);next.textContent=index===story.pages.length-1?'物語を終える →':'続きを読む →';
 if(page[2])for(const [key,label] of [['kind','大丈夫？ と声を掛ける'],['tease','溺れていたんでしょう？'],['dry','身体を拭いてあげる']]){const b=document.createElement('button');b.className='secondary';b.textContent=label;b.onclick=()=>{choice=key;render();};buttons.append(b);}
 };
 next.onclick=handler(async()=>{if(seaEventBusy)return;if(index<story.pages.length-1){index++;render();return;}seaEventBusy=true;next.disabled=true;try{if(!replay)await api('/sea/event','POST',{event:kind,choice});if(replay)await openForestMemories();else await openHall();}finally{seaEventBusy=false;next.disabled=false;}});
 render();show('sea-event');
}
const frontStoryPages=["大理石のホールに、カチリ、と小さな音が響いた。\n\nこれまで固く閉ざされていた中央の透明な扉が、誰も触れていないというのに、ゆっくりと開き始める。扉の向こうから溢れ出した柔らかな光が、磨かれた床を淡い虹色に染めていった。", "「……あれ？　ねえねえ、あの扉、開いてるよ！」\n\n黄色い獣が大きな耳をぴんと立て、虹色の尻尾を揺らしながら扉を見つめる。", "「本当だ！　いつの間に開いたんだ？」\n\n赤い獣も首元の鈴を鳴らしながら駆け寄ってきた。二匹は並んで扉の向こうを覗き込もうとするものの、光に包まれたその先の様子は、まだよく分からない。", "「……なんだか、美味しそうな匂いがしない？」\n\n黄色い獣が鼻をひくひくと動かす。", "「美味しいものがあるのか！？　もしかして、ご馳走がいっぱいある場所かもしれないぞ！」\n\n「でも、何かを作る場所かもしれないよ。自分たちで美味しいものを作れたら楽しそうだね！」\n\n「食べ物だけじゃなくて、色んなものが作れたりしてな！　今まで集めたものも使えるかもしれないぞ！」", "まだ見ぬ扉の先を想像しながら、二匹は楽しそうに顔を見合わせる。赤い獣は待ちきれない様子で足踏みをし、黄色い獣は住人たちの方へと振り返った。\n\n「ねえ、みんなは何があると思う？」\n\n「ここで考えてても分からないぞ！　一緒に確かめに行こうぜ！」", "これまでの探索で集めてきた、様々な素材や不思議な品々。それらにも、もしかすると新たな使い道が見つかるのかもしれない。"];
function showFrontEvent(replay=false){
 let index=0,busy=false;const next=$('#front-event-next');
 const render=()=>{$('#front-event-text').textContent=frontStoryPages[index];$('#front-event-progress').textContent=`${index+1} / ${frontStoryPages.length}`;next.textContent=index===frontStoryPages.length-1?(replay?'思い出に戻る →':'物語を終える →'):'続きを読む →';};
 next.disabled=false;next.onclick=handler(async()=>{if(busy)return;if(index<frontStoryPages.length-1){index++;render();return;}busy=true;next.disabled=true;try{if(replay){await openForestMemories();return;}await api('/sea/event','POST',{event:'front'});await openHall();}finally{busy=false;next.disabled=false;}});
 render();show('front-event');
}
const moonStoryPages=["大理石のホールを歩いていた赤い獣の耳に、聞き慣れない音が届いた。\n\nギィ……。\n\n何かが軋むような音に足を止め、辺りを見回す。すると、金色の月が描かれた黒い扉が、いつの間にか開いているではないか。", "「……えっ？」\n\n赤い獣の尻尾がぴたりと止まった。\n\n開いた扉の向こうには、紫がかった仄暗い光が漂っている。昼間の明るいホールとは対照的なその光景に、思わず一歩、二歩と後退った。", "「お、おい……。あんなところ、開いてたか？」\n\n恐る恐る様子を窺っていると、扉の奥から何やら硬貨が触れ合うような音が聞こえてきた。", "チャリン、チャリン。\n\n「……な、なんかいるぞ！　絶対になんかいる！」\n\n慌てて近くの柱の陰へと駆け込み、顔だけを覗かせる。しばらく耳を澄ませていたが、聞こえてくるのは物を動かす音や、時折響く小さな物音ばかり。", "「もしかして、誰か住んでるのか？　……いや、でも、あんな暗いところに住んでるやつなんて、怪しいに決まってるぞ……」\n\n気にはなるものの、自分から確かめに行く勇気はないらしい。住人の姿を見つけると、これ幸いとばかりに駆け寄ってきた。", "「なあなあ！　あそこの黒い扉、開いてるんだ！　中から変な音もするんだぞ！」\n\n一生懸命に状況を伝えながらも、ちらちらと扉の方を気にしている。", "「……ちょっと見てきてくれないか？　オレはここで待ってるから！　べ、別に怖いわけじゃないぞ！　誰かがここを見張ってないといけないだろ？」\n\nそう言って胸を張るものの、尻尾はすっかり身体に巻き付いていた。"];
function showMoonEvent(replay=false){
 let index=0,busy=false;const next=$('#moon-event-next');
 const render=()=>{$('#moon-event-text').textContent=moonStoryPages[index];$('#moon-event-progress').textContent=`${index+1} / ${moonStoryPages.length}`;next.textContent=index===moonStoryPages.length-1?(replay?'思い出に戻る →':'商店へ →'):'続きを読む →';};
 next.disabled=false;next.onclick=handler(async()=>{if(busy)return;if(index<moonStoryPages.length-1){index++;render();return;}busy=true;next.disabled=true;try{if(replay){await openForestMemories();return;}await api('/sea/event','POST',{event:'moon'});await openMoonDoor();}finally{busy=false;next.disabled=false;}});render();show('moon-event');
}
async function checkSeaEvents(){if(!seaState?.unlocked||!seaState?.eligible)return false;const e=await api('/sea/events');if(!e.greenSeen){showSeaEvent('green',e);return true;}if(e.discovered&&!e.encounterSeen){showSeaEvent(e.isFinder?'discover':'meet',e);return true;}if(e.discovered&&e.encounterSeen&&!e.frontSeen){showFrontEvent();return true;}return false;}

// v0.18.7 商人lent。画像は背景と人物が一体のWebPを使う。
let lentBusy=false,lentCurrentProfile=null;
const lentImageFiles=new Set(['normal.webp','sleeping.webp','lentNothing.webp','lentNothing2.webp','lent20.webp','Bad.webp','angry.webp','laugh.webp','surprised.webp','notInterested.webp','notinterested.webp','play.webp']);
// 商人の短い台詞。AI自由会話は♡5で解放されるが、接客の挨拶は最初から表示する。
const lentLinePools={
 entry:{normal:['「いらっしゃいませ～……」','「いらっしゃ……あ～、なんだ、おまえか。」','「どうも～。何か探してる？」'],bad:['「……いらっしゃい。今日はあんまり気分が乗らないんだけど。」','「雨っぽいなあ……。ああ、いらっしゃい。」']},
 trade:{normal:['「取引？ いいよ。」','「交換ね。……何を持ってきた？」'],bad:['「取引？ ……まあ、いいよ。」','「手短に頼むよ。」']},
 after:{normal:['「またね～」','「ごひいきに～」','「……まだいたの？」'],bad:['「……もういい？」','「次は晴れた日に来てよ。」']}
};
const lentRandomLine=p=>p[Math.floor(Math.random()*p.length)];
const lentLine=(p,kind)=>{
 if(p.activity==='playing'&&!p.canRespond)return '「.......」';
 if(p.mood==='odd')return lentRandomLine(['「ほえ～～～」','「はえ～～～」']);
 if(p.activity==='sleeping')return '商人は眠っている。';
 if(p.activity==='away')return '商人は留守にしている。';
 return lentRandomLine(lentLinePools[kind][p.mood==='bad'?'bad':'normal']);
};
const showLentLine=(p,kind)=>{$('#lent-message').textContent=lentLine(p,kind);$('#lent-message').classList.remove('hidden');};
function renderLent(p){
 lentCurrentProfile=p;
 const image=String(p.image||'').split('/').pop();
 $('#lent-scene').src='images/npc/lent/'+(lentImageFiles.has(image)?image:'normal.webp');
 // 親密度ptや日次上限はUIで公開せず、獣たちと同じハートを控えめに表示。
 $('#lent-hearts').textContent='♥'.repeat(p.hearts)+'♡'.repeat(Math.max(0,10-p.hearts));
 $('#lent-hearts').setAttribute('aria-label',`親密度 ♡${p.hearts}`);
 $('#lent-relation').textContent=`あなたとの関係：${p.relationship}`;
 $('#lent-state').textContent=p.activityLabel;
 $('#lent-wake').classList.toggle('hidden',!p.canWake);
 $('#lent-conversation').classList.toggle('hidden',!p.aiUnlocked);
 $('#lent-chat-locked').classList.toggle('hidden',!!p.aiUnlocked);
 if(p.aiUnlocked){const u=p.aiUsage||{used:0,limit:5};$('#lent-chat-usage').textContent=`(${u.used}/${u.limit}回)`;$('#lent-chat-send').disabled=(!p.canChat&&p.activity!=='playing')||u.used>=5||lentBusy;$('#lent-chat-input').disabled=!p.canChat&&p.activity!=='playing';}
 const quest=p.flowerQuest;
 const reward=$('#lent-seed-reward');
 const received=!!(quest?.seedClaimed&&quest?.canClaimed);
 reward.classList.toggle('hidden',!quest?.completed||received);
 $('#lent-shop').classList.toggle('hidden',!received);
 $('#lent-seed-image').classList.toggle('hidden',!received);
 if(quest?.completed){
  $('#lent-seed-claim').classList.toggle('hidden',!!quest.canClaimed);
  $('#lent-seed-claim').textContent=quest.seedClaimed?'じょうろを受け取る':'商人の話を聞く';
  $('#lent-seed-claim').onclick=ghShowReward;
  $('#lent-seed-message').textContent=received?'商人から種を受け取った。':'商人があなたを待っている。';
  $('#lent-seed-claim').disabled=lentBusy||!p.canRespond;
  $('#lent-seed-status').textContent=quest.canClaimed?'報酬を受け取った。紫色の扉が開かれている。':p.canRespond?'商人から種を受け取ろう。':'商人が店にいるとき、種を受け取れる。';
  $('#lent-enter-greenhouse').classList.toggle('hidden',!quest.canClaimed);
 }
 const questBox=$('#lent-flower-quest'),intro=$('#lent-flower-intro'),qStatus=$('#lent-flower-progress');
 questBox.classList.toggle('hidden',!!quest?.completed);
 intro.textContent=quest?.completed?'「……へえ、こんなに集まったのか。これなら商売ができそうだ。」':'「ここで商売しようと思うんだけど……そもそも交換できるものなんてあんの？」';
 if(quest){
  qStatus.textContent=quest.completed?'共同納品達成！ 商人から報酬を受け取ろう。':`逆さに咲く花：${quest.donated} / ${quest.target}個（あと${quest.remaining}個）`;
  $('#lent-flower-owned').textContent=`あなたの所持数：${quest.owned}個　あなたの納品：${quest.personalDonated}個`;
  $('#lent-flower-qty').max=String(Math.min(quest.owned,quest.remaining,1000));
  const qtyInput=$('#lent-flower-qty');qtyInput.value=String(Math.max(1,Math.min(Number(qtyInput.max),Number(qtyInput.value)||1)));
  document.querySelectorAll('[data-lent-step]').forEach(b=>b.disabled=lentBusy||!p.canRespond||Number(qtyInput.max)<1);
  $('#lent-flower-donate').disabled=lentBusy||!p.canRespond||quest.owned<1||quest.remaining<1;
  $('#lent-flower-qty').disabled=lentBusy||!p.canRespond||quest.owned<1||quest.remaining<1;
 }
 ghRenderShop(p);
 const box=$('#lent-offers');box.replaceChildren();
 if(!received)return;
 if(!p.canTrade){const msg=document.createElement('p');msg.className='muted';msg.textContent=p.activity==='away'?'商人は留守にしています。':p.activity==='playing'?'「.......」':'商人は眠っています。取引はできません。';box.append(msg);return;}
 if(!p.offers?.length){const msg=document.createElement('p');msg.className='muted';return;}
 for(const offer of p.offers){
  const row=document.createElement('div');row.className='lent-offer';
  const left=document.createElement('div');left.className='lent-offer-copy';
  const strong=document.createElement('strong');strong.textContent=offer.title;
  const desc=document.createElement('p');desc.className='muted tiny';desc.textContent=`${offer.give.name} ×${offer.give.quantity} → ${offer.receive.name} ×${offer.receive.quantity}`;
  const button=document.createElement('button');button.className='secondary small';button.textContent='交換する';button.disabled=lentBusy;
  button.onclick=handler(async()=>{if(lentBusy)return;showLentLine(lentCurrentProfile,'trade');lentBusy=true;button.disabled=true;try{const res=await api('/lent/trade','POST',{offerId:offer.id});renderLent(res.profile);showLentLine(res.profile,'after');}finally{lentBusy=false;button.disabled=false;}});
  left.append(strong,desc);row.append(left,button);box.append(row);
 }
}
// 温室：画面の時計は表示専用。実際の完了判定はWorkerが行う。
const GH=window.KAGARISO_GREENHOUSE;
const ghDir='images/greenhouse/growing/';
const ghFlowers={GREEN:'Green',RED:'Red',WHITE:'White',YELLOW:'Yellow',BLACK:'Black',BLUE:'Blue',SILK:'Silk',COTTON:'Cotton'};
let ghData=null,ghBusy=false,ghTimer=null,ghOffset=0,ghShopCategory='園芸用品',ghShopRender=0,ghPotKey='';
const ghName=id=>materialById(id)?.name||id;
const ghImage=id=>materialById(id)?.image||'';
const ghQuantity=id=>Number(ghData?.owned?.[id]||0);
function ghSet(data){ghData=data;ghOffset=data.serverNow-Date.now();ghRender();}
function ghRender(){
 if(!ghData||activePage!=='greenhouse')return;
 const c=ghData.cycle, state=c?.state||'empty', now=Date.now()+ghOffset, ready=state==='ready', growing=state==='growing';
 const ratio=growing?Math.max(0,Math.min(1,(now-c.startedMs)/(c.finishMs-c.startedMs))):0;
 const phase=ratio>=.8?'plant5.webp':ratio>=.5?'plant4.webp':'plant3.webp';
 const potKey=JSON.stringify([state,phase,ready?c.pots:null]);
 if(potKey!==ghPotKey){ghPotKey=potKey;$('#gh-pots').innerHTML=Array.from({length:5},(_,i)=>{
  const flower=ready?c.pots[i]:null, src=flower?`plant${ghFlowers[flower.id.replace('GH_FLOWER_','')]}.webp`:growing?phase:state==='planted'?'plant3.webp':'plantEmpty.webp';
  const label=flower?`${ghName(flower.id)} ×${flower.quantity}本`:state==='empty'?'空き':growing?'育成中':'種まき済み';
  return `<div class="gh-pot"><img src="${ghDir+src}?v=0.20.8.12" alt=""><span>${safe(label)}</span></div>`;
 }).join('');}
 $('#gh-can').innerHTML=ghData.canColor?`<img src="${ghDir}jouro${ghData.canColor}.webp" alt="じょうろ">${({B:'青',G:'緑',R:'赤',Y:'黄'})[ghData.canColor]}のじょうろ`:'じょうろを受け取っていません';
 $('#gh-owned').textContent=`種：${ghQuantity('LENT_SEED')}袋　腐葉土：${ghQuantity('S0047')}個　肥料：${ghQuantity('GH_FERTILIZER')}個`;
 $('#gh-plant').classList.toggle('hidden',state!=='empty');$('#gh-plant').disabled=ghBusy||!ghData.canColor||ghQuantity('LENT_SEED')<1;
 $('#gh-prep').classList.toggle('hidden',state!=='planted');$('#gh-water').disabled=ghBusy||!ghData.canColor;
 for(const [selector,id] of [['#gh-compost','S0047'],['#gh-fertilizer','GH_FERTILIZER']]){const el=$(selector);el.disabled=ghBusy||ghQuantity(id)<1;if(ghQuantity(id)<1||state!=='planted')el.checked=false;}
 $('#gh-progress').classList.toggle('hidden',!growing);$('#gh-bar').value=ratio*100;
 const remaining=Math.max(0,Math.ceil((c?.finishMs-now)/1000));$('#gh-clock').textContent=growing?`開花まで ${Math.floor(remaining/60)}分${String(remaining%60).padStart(2,'0')}秒` :'';
 $('#gh-harvest').classList.toggle('hidden',!ready);$('#gh-harvest').disabled=ghBusy;
 $('#gh-status').textContent=!ghData.canColor?'商人のところでじょうろを受け取ろう。':state==='empty'?'種を1袋植えると、5つの鉢が埋まります。':state==='planted'?'水をあげると育成が始まります。':ready?`花が咲きました！ 合計${c.pots.reduce((n,p)=>n+p.quantity,0)}本を収穫できます。`:'すくすく育っています……';
 if(growing&&remaining===0&&!ghBusy){ghBusy=true;api('/greenhouse').then(data=>{ghSet(data);if(data.cycle?.state==='ready')checkGameNotifications().catch(console.warn);}).catch(e=>toast(e.message)).finally(()=>{ghBusy=false;});}
}
async function ghAnimate(color){
 if(!color||activePage!=='greenhouse')return;
 const stage=$('#gh-stage'),can=$('#gh-watering');can.src=ghDir+'jouro'+color+'.webp';can.classList.remove('hidden');
 try{for(let i=0;i<5;i++){
  if(activePage!=='greenhouse')break;
  const pot=$('#gh-pots').children[i];can.style.left=`${i<3?(i+.5)*20-5:(i+.5)*20-26}%`;can.style.setProperty('--gh-flip',i<3?'1':'-1');can.classList.add('gh-pour');$('#gh-status').textContent=`${i+1} / 5　水をあげています……`;
  pot?.classList.add('gh-wet');await new Promise(r=>setTimeout(r,700));can.classList.remove('gh-pour');await new Promise(r=>setTimeout(r,100));
 }}finally{can.classList.add('hidden');can.classList.remove('gh-pour');}
}
async function ghDo(action){
 if(ghBusy||!ghData)return;ghBusy=true;
 const body={cycleId:ghData.cycle?.id,compost:$('#gh-compost').checked,fertilizer:$('#gh-fertilizer').checked};
 ghRender();
 try{const result=await api('/greenhouse/'+action,'POST',body);
  if(action==='water'){ghData=result;ghOffset=result.serverNow-Date.now();await ghAnimate(result.canColor);}
  ghSet(result);
  if(action==='harvest'){
   if(result.clothingJustUnlocked)toast('工房の「服飾」が解放されました！');
   const sums={};for(const x of result.harvested||[])sums[x.id]=(sums[x.id]||0)+x.quantity;
   $('#gh-result').innerHTML='<h3>今回の収穫</h3>'+Object.entries(sums).map(([id,n])=>`<div class="gh-result-row"><img src="${safe(ghImage(id))}" alt=""><span>${safe(ghName(id))}</span><strong>×${n}</strong></div>`).join('');
  }else if(action==='plant')$('#gh-result').replaceChildren();
 }catch(e){toast(e.message);try{ghSet(await api('/greenhouse'));}catch(_){}}
 finally{ghBusy=false;ghRender();}
}
$('#gh-plant').onclick=()=>ghDo('plant');$('#gh-water').onclick=()=>ghDo('water');$('#gh-harvest').onclick=()=>ghDo('harvest');
$('#gh-catalog').onclick=handler(openMaterialCatalog);
function ghShowReward(){
 const p=lentCurrentProfile;if(!p?.flowerQuest?.completed||!p.canRespond||lentBusy||p.flowerQuest.canClaimed)return;
 let i=0;const box=$('#lent-seed-message'),button=$('#lent-seed-claim');
 const dialogue=GH.event.dialogue;box.textContent='「'+dialogue[0]+'」';button.textContent='次へ';
 button.onclick=handler(async()=>{
  if(lentBusy)return;
  if(i<dialogue.length-1){i++;box.textContent='「'+dialogue[i]+'」';button.textContent=i===dialogue.length-1?'報酬を受け取る':'次へ';return;}
  lentBusy=true;button.disabled=true;
  try{const result=await api('/lent/flowers/reward','POST',{});lentBusy=false;renderLent(result.profile);$('#lent-message').textContent='「ごひいきに♡」';if(activePage==='moon')$('#lent-reward-confirm').showModal();}
  finally{lentBusy=false;button.disabled=false;}
 });
}
function ghRenderShop(p){
 const host=$('#gh-shop');host.replaceChildren();const ticket=++ghShopRender;
 if(!p?.flowerQuest?.seedClaimed||!p?.flowerQuest?.canClaimed||!p?.canTrade)return;
 api('/greenhouse/shop').then(data=>{
  if(ticket!==ghShopRender||activePage!=='moon'||!data.canTrade)return;
  const refreshers=[];
  const cats=['園芸用品','染料','生地','裁縫素材'];
  host.innerHTML=`<div class="gh-tabs">${cats.map(x=>`<button class="secondary small ${x===ghShopCategory?'gh-selected':''}" data-gh-cat="${x}">${x}</button>`).join('')}</div><div id="gh-recipes"></div>`;
  host.querySelectorAll('[data-gh-cat]').forEach(b=>b.onclick=()=>{if(lentBusy)return;ghShopCategory=b.dataset.ghCat;ghRenderShop(p);});
  for(const recipe of GH.recipes.filter(x=>x.category===ghShopCategory)){
   const item=GH.items.find(x=>x.id===recipe.result.id),card=document.createElement('article');card.className='request-card gh-recipe';
   const desc=recipe.alternatives.map(a=>a.map(x=>`${ghName(x.id)}×${x.quantity}`).join(' ＋ '));
   card.innerHTML=`<div class="gh-result-row"><img src="${safe(item.image)}" alt=""><div><strong>${safe(item.name)}</strong><p class="muted tiny gh-owned">所持：${data.owned[item.id]||0}個</p></div></div><label>交換素材<select class="gh-alt">${desc.map((x,i)=>`<option value="${i}">${safe(x)}</option>`).join('')}</select></label><p class="muted tiny gh-cost"></p><div class="gh-qty"><button class="secondary small" data-step="-10">−10</button><input type="number" min="1" value="1" inputmode="numeric"><button class="secondary small" data-step="10">＋10</button><button class="secondary small" data-step="max">最大</button></div><button class="primary gh-exchange">交換する</button>`;
   const sel=card.querySelector('select'),input=card.querySelector('input'),btn=card.querySelector('.gh-exchange');
   const max=()=>Math.min(1000,...recipe.alternatives[Number(sel.value)].map(x=>Math.floor((data.owned[x.id]||0)/x.quantity)));
   const refresh=()=>{const m=max();input.max=String(m);input.value=String(Math.max(1,Math.min(m||1,Math.floor(Number(input.value)||1))));btn.disabled=m<1||lentBusy||!data.canTrade;card.querySelector('.gh-owned').textContent=`所持：${data.owned[item.id]||0}個`;card.querySelector('.gh-cost').textContent=recipe.alternatives[Number(sel.value)].map(x=>`${ghName(x.id)}：所持${data.owned[x.id]||0}個 / 必要${x.quantity*Number(input.value)}個`).join('　');};
   sel.onchange=refresh;input.onchange=refresh;input.oninput=()=>{card.querySelector('.gh-cost').textContent=recipe.alternatives[Number(sel.value)].map(x=>`${ghName(x.id)}：所持${data.owned[x.id]||0}個 / 必要${x.quantity*(Number(input.value)||0)}個`).join('　');};
   card.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{input.value=String(b.dataset.step==='max'?max():Number(input.value)+Number(b.dataset.step));refresh();});
   btn.onclick=handler(async()=>{
    if(lentBusy||!data.canTrade)return;refresh();const quantity=Number(input.value),alternative=Number(sel.value);if(quantity>max())return;
    lentBusy=true;refreshers.forEach(fn=>fn());
    try{const result=await api('/greenhouse/trade','POST',{recipeId:recipe.id,alternative,quantity,operationId:crypto.randomUUID()});Object.assign(data,result);toast(`${item.name}を${quantity}個交換しました。`);}
    catch(e){try{Object.assign(data,await api('/greenhouse/shop'));}catch(_){}throw e;}
    finally{lentBusy=false;if(ticket===ghShopRender&&activePage==='moon')refreshers.forEach(fn=>fn());}
   });
   refreshers.push(refresh);
   refresh();host.querySelector('#gh-recipes').append(card);
  }
 }).catch(e=>{if(ticket===ghShopRender)host.textContent=e.message;});
}

async function openGreenhouse(){
 const h=await api('/hall');greenhouseUnlocked=!!h.greenhouseUnlocked;
 if(!greenhouseUnlocked){toast('紫色の扉はまだ開かない。');return;}
 const data=await api('/greenhouse');
 show('greenhouse');ghPotKey='';$('#gh-result').replaceChildren();ghSet(data);clearInterval(ghTimer);ghTimer=setInterval(()=>{if(activePage!=='greenhouse'){clearInterval(ghTimer);ghTimer=null;return;}if(!ghBusy)ghRender();},1000);
}
async function openMoonDoor(){
 const hall=await api('/hall');
 moonDoorUnlocked=!!hall.moonUnlocked;
 if(!moonDoorUnlocked){toast('月の扉はまだ開かない。');return;}
 const e=await api('/sea/events');if(!e.moonSeen){if(!e.frontSeen){await openHall();return;}showMoonEvent();return;}
 const data=await api('/lent');
 renderLent(data.lent);
 showLentLine(data.lent,'entry');
 show('moon');
}
document.querySelectorAll('[data-lent-step]').forEach(b=>b.onclick=()=>{const input=$('#lent-flower-qty'),max=Number(input.max);if(b.disabled||max<1)return;input.value=String(Math.max(1,Math.min(max,b.dataset.lentStep==='max'?max:(Number(input.value)||1)+Number(b.dataset.lentStep))));});
$('#lent-flower-donate').addEventListener('click',handler(async()=>{
 if(lentBusy)return;
 const qty=Number($('#lent-flower-qty').value);
 if(!Number.isSafeInteger(qty)||qty<1||qty>Number($('#lent-flower-qty').max)){toast('納品する個数を入力してください。');return;}
 if(!confirm(`逆さに咲く花を${qty}個納品しますか？`))return;
 lentBusy=true;$('#lent-flower-donate').disabled=true;
 let result=null;
 try{result=await api('/lent/flowers/donate','POST',{quantity:qty});
  $('#lent-message').textContent=result.message;$('#lent-message').classList.remove('hidden');
  if(result.quest.completed){toast('共同納品達成！ 商人があなたを待っています。');checkGameNotifications().catch(console.warn);}
 }finally{lentBusy=false;if(result)renderLent(result.profile);else $('#lent-flower-donate').disabled=false;}
}));
$('#lent-enter-greenhouse').addEventListener('click',handler(openGreenhouse));
$('#lent-reward-close').onclick=()=>$('#lent-reward-confirm').close();
$('#greenhouse-back-moon').addEventListener('click',handler(openMoonDoor));
$('#greenhouse-back-hall').addEventListener('click',handler(openHall));
$('#lent-chat-send').addEventListener('click',handler(async()=>{
 if(lentBusy)return;const message=$('#lent-chat-input').value.trim();if(!message){toast('話しかけたいことを入力してください。');return;}
 lentBusy=true;$('#lent-chat-send').disabled=true;
 try{const res=await api('/lent/chat','POST',{message});$('#lent-chat-reply').textContent=res.response;$('#lent-chat-input').value='';renderLent(res.profile);}finally{lentBusy=false;}
}));
$('#lent-wake').addEventListener('click',handler(async()=>{if(lentBusy)return;lentBusy=true;try{const data=await api('/lent/wake','POST',{});renderLent(data.profile);$('#lent-message').textContent='商人が目を覚ました。';$('#lent-message').classList.remove('hidden');}finally{lentBusy=false;}}));
$('#moon-back-hall').addEventListener('click',handler(openHall));
async function openHall(){const data=await api('/hall');resident=data.resident;$('#user-name').textContent=resident.name;$('#user-bar').classList.remove('hidden');
  hallBuildLevel=data.build?.level||1;
  renderHallBuild(data.build);renderPrivateRoomLinks(data.build);
  updateHallBackground();
  updateForestHall(data.forest);
  seaState=data.sea||null;
  $('#hall-closed-door-copy').classList.toggle('hidden',!!seaState?.unlocked);
  frontCookingUnlocked=!!data.frontUnlocked;
  moonDoorUnlocked=!!data.moonUnlocked;
  greenhouseUnlocked=!!data.greenhouseUnlocked;
  $('#hall-front-door').title=frontCookingUnlocked?'工房へ':'正面の扉';
  $('#hall-front-door').setAttribute('aria-label',frontCookingUnlocked?'工房へ移動する':'正面の扉');
  $('#front-door-hint').textContent=frontCookingUnlocked?'工房へ':'正面の扉';
  $('#sea-door-hint').textContent=seaState?.unlocked&&seaState?.eligible?'海へ':'🔒';
  $('#hall-sea-door').title=seaState?.unlocked&&seaState?.eligible?'海へ':'緑の扉';
  const paperHere=data.npcs.find(n=>n.id==='paper'&&n.state.location==='hall');
  // ホール専用の表示位置。5体対応の予約枠はCSS側の data-hall-slot=1〜5。
  // 黄色い獣だけがいる現在は中央(3)へ。プロフィール・会話画面には影響しない。
  const paperActor=$('#hall-paper-actor');
  const pyoroHere=data.npcs.find(n=>n.id==='pyoro'&&n.state.location==='hall');
  paperActor.dataset.hallSlot=pyoroHere?'2':'3';
  $('#hall-pyoro-actor').classList.toggle('hidden',!pyoroHere);
  if(pyoroHere){
    paintPyoro('#hall-pyoro-actor img',pyoroHere);
    updatePyoroHallLabel(pyoroHere);
  }
  $('#hall-pyoro-actor').onclick=handler(openPyoro);
  paperActor.classList.toggle('hidden',!paperHere);
  if(paperHere){paintPaper('#hall-paper-image',paperHere);$('#hall-paper-label').textContent=paperHere.state.activity==='sleeping'?'黄色い獣はおやすみ中':'黄色い獣に会う';}
  updateHallLoungeActors(paperHere,pyoroHere);
  $('#npc-list').innerHTML=data.npcs.map(n=>`<article class="npc-card">${n.id==='paper'&&paperVisual?`<img class="npc-list-portrait" src="${safe(encodeURI(paperImage(paperExpression(n))))}" alt="">`:n.id==='pyoro'?`<img class="npc-list-portrait" src="${safe(encodeURI(pyoroImage(pyoroExpression(n))))}" alt="">`:'<div class="avatar" aria-hidden="true">✦</div>'}<div><strong>${safe(n.id==='pyoro'?'赤色の獣':n.name)}</strong><div class="muted">${safe(stateText(n))} · ${safe(n.state.activityLabel)}</div></div><button class="secondary small" data-npc="${safe(n.id)}">詳細を見る</button></article>`).join('');
  $('#doors').innerHTML=data.hall.doors.map(d=>`<article class="door-card" data-door-card="${safe(d.id)}"><span class="door-glyph">◇</span><div class="door-card-copy"><strong>${safe(d.id==='moon'&&d.status==='available'?'商店':d.id==='greenhouse'&&d.status==='available'?'温室':d.id==='forest'&&d.status==='available'?'森':d.id==='sea'&&d.status==='available'?'海':d.id==='unknown'?(d.status==='available'?'工房':'正面の扉'):d.name)}</strong>${['forest','cave','sea','moon','greenhouse'].includes(d.id)||(d.id==='unknown'&&d.status==='available')||(d.status!=='available'&&d.id!=='unknown')?'':`<div class="muted">${d.status==='available'?'入口の採取ができます':'まだ扉は開かない'}</div>`}</div>${d.status==='available'?`<button class="secondary small" data-door="${safe(d.id)}">${d.id==='unknown'?'工房へ':d.id==='moon'?'商店へ':d.id==='greenhouse'?'温室へ':'探索する'}</button>`:`<span class="tag">${['forest','sea','moon'].includes(d.id)?'未解放':'準備中'}</span>`}</article>`).join('');
  $('#doors').querySelector('[data-door="cave"]')?.addEventListener('click',handler(()=>enterHallCave()));
  $('#doors').querySelector('[data-door="forest"]')?.addEventListener('click',handler(openForest));
  $('#doors').querySelector('[data-door="sea"]')?.addEventListener('click',handler(async()=>{if(!await checkSeaEvents())await window.KAGARISO_SEA.open();}));
  $('#doors').querySelector('[data-door="unknown"]')?.addEventListener('click',handler(()=>window.KAGARISO_COOKING.open()));
  $('#doors').querySelector('[data-door="moon"]')?.addEventListener('click',handler(openMoonDoor));
  $('#doors').querySelector('[data-door="greenhouse"]')?.addEventListener('click',handler(openGreenhouse));
  $('#hall-front-door').onclick=handler(async()=>{if(!frontCookingUnlocked){toast('まだ正面の扉は開かない。');return;}await window.KAGARISO_COOKING.open();});
  $('#hall-moon-door').onclick=handler(openMoonDoor);
  $('#hall-greenhouse-door').onclick=handler(openGreenhouse);
  $('#hall-sea-door').onclick=handler(async()=>{if(!seaState?.unlocked||!seaState?.eligible){toast('緑の扉はまだ開かない。');return;}if(!await checkSeaEvents())await window.KAGARISO_SEA.open();});
  $('#npc-list').querySelectorAll('[data-npc]').forEach(b=>b.addEventListener('click',handler(()=>b.dataset.npc==='pyoro'?openPyoro():openNpc('hall'))));
  if(!data.npcs.length)$('#npc-list').innerHTML='<p class="muted">黄色い獣の姿はまだここにない。洞窟の扉を調べてみよう。</p>';
  show('hall');
  positionHallCaveDoor();
  if(data.requiredStory){toast('先に洞窟での大切な物語を体験しよう。');await openCave(1);return;}
  if(data.forest?.unlocked&&data.forest.eligible&&!data.forest.seen){showForestEvent(false);return;}
  if(await checkSeaEvents())return;
  if(data.moonUnlocked&&data.frontUnlocked&&!data.moonSeen){showMoonEvent();return;}
  if(data.build?.active&&!data.build.seen){showBuildEvent(data.build);return;}
  if(data.build?.completedAt&&!isBuildCompletionClosed(data.build)){showBuildEvent(data.build,true);return;}
  checkGameNotifications().catch(console.warn);
}
// v0.20.1 shared hall build event chain and donation UI.
const buildDialogues={
  hall_lounge:[['黄色い獣','ねぇねぇ、ボクね、ずっとおもってたんだけど……ここにふかふかのソファがあったら、もっとのんびりできるとおもわない？'],['赤色の獣','おっ、それいいじゃん！ テーブルもあったら、おやつだってたべられるぞ！'],['黄色い獣','わぁ！ みんなでおやつをたべたり、ごろごろしたりできるねぇ！'],['赤色の獣','でも、どうやってつくるんだ？ オレたちだけじゃ、ざいりょうがたりないぞ。'],['黄色い獣','ねぇ、みんなにもおてつだいしてもらえないかなぁ？'],['赤色の獣','よーし！ みんなで、もっとすごしやすいホールにしようぜ！']],
  hall_stairs:[['黄色い獣','わぁ～！ ふかふかだぁ！ みんなのおかげで、すてきなばしょができたねぇ！'],['赤色の獣','へへっ、これならいくらでもごろごろできるぞ！'],['黄色い獣','……ねぇねぇ。もっとホールをひろくしたら、もっとたのしくなるかなぁ？'],['赤色の獣','おっ！ じゃあ、かいだんをつくって、二階にもいけるようにしようぜ！'],['黄色い獣','わぁ！ いいねぇ！'],['赤色の獣','みんな、もうちょっとだけてつだってくれるか？']]
};
Object.assign(buildDialogues,{"paper_room": [["黄色い獣", "えへへぇ、すっごくひろくなったねぇ！"], ["赤色の獣", "まさか二階までできるなんてなぁ。上から見ると、いつものホールもちがって見えるぞ！"], ["黄色い獣", "ねぇねぇ、二階にはおへやがいっぱいあるでしょう？"], ["黄色い獣", "こんなにへやがあるなら、ぼくのへやもほしいなぁ～。"], ["黄色い獣", "ぼくのすきなものをいっぱいおいて、ぼくだけのおへやにするの！"], ["赤色の獣", "……え、いいな。"], ["赤色の獣", "オレも……おへや……ほしい……。"], ["黄色い獣", "えっへへ！ じゃあ、おとなりのおへやにしようよぉ！"], ["赤色の獣", "……いいのか？"], ["黄色い獣", "うん！ いつでもあそびにいけるねぇ！"], ["赤色の獣", "へへっ……それなら、さみしくないな。"], ["黄色い獣", "ねぇねぇ、みんなぁ。ぼくたちのおへやをつくるの、てつだってくれる？"], ["赤色の獣", "オ、オレからも……おねがいしますっ！"]], "paper_bed": [["黄色い獣", "わぁ～～！ ぼくのおへやだぁ！"], ["黄色い獣", "ここからおそとがみえるよぉ！ ひなたぼっこもできそう！"], ["黄色い獣", "えへへ、みんな、ありがとうねぇ！"], ["黄色い獣", "……でも、なんにもないねぇ？"], ["黄色い獣", "ふかふかのおふとんがあったら、ここでねむれるのになぁ～"], ["黄色い獣", "ねぇねぇ、ベッドもつくってくれる？"]], "pyoro_room": [["黄色い獣", "わぁ～！ ふかふかのベッドだぁ！ みんなありがとうねぇ！"], ["赤色の獣", "……いいな。オレも、あの……おへやがほしい。"], ["黄色い獣", "うん！ おとなりのおへや、つくろうねぇ！"], ["赤色の獣", "みんな……オレのおへやも、てつだってくれるか？"]]});
Object.assign(buildDialogues,{"pyoro_bed": [["赤色の獣", "へへっ……ここ、オレのおへやなんだよな。"], ["赤色の獣", "海も見えるし、すっげぇ気に入った！"], ["赤色の獣", "でもさ、床で寝るとちょっと冷たいんだ。"], ["赤色の獣", "べ、別に寒がりってわけじゃないぞ！"], ["黄色い獣", "ふかふかのベッド、あったらいいねぇ！"], ["赤色の獣", "……赤くて、あったかいやつがいいな。みんな、てつだってくれるか？"]], "paper_rug": [["黄色い獣", "ねぇねぇ、ベッドはふかふかなんだけど、ゆかはちょっとかたいねぇ。"], ["黄色い獣", "おひさまのあたるところで、ごろごろしたいなぁ～。"], ["赤色の獣", "ラグをしいたらいいんじゃないか？ クッションもあれば最高だぞ！"], ["黄色い獣", "わぁ！ それいいねぇ！ みんな、ふかふかにするの、てつだってくれる？"]], "pyoro_rug": [["赤色の獣", "……おまえのへや、またふかふかが増えてる！"], ["黄色い獣", "えへへぇ、ここでおひるねできるよぉ！"], ["赤色の獣", "オレだって窓のそばでごろごろしたいし……。"], ["赤色の獣", "赤くてあったかいラグとクッション、オレのへやにもほしい！"], ["赤色の獣", "みんな、もうちょっとだけ、てつだってくれるか？"]]});
Object.assign(buildDialogues,{"paper_sofa": [["黄色い獣", "ねぇねぇ、まどのそと、ずっとみていたいなぁ。"], ["黄色い獣", "ここにふかふかのソファがあったら、おひさまのところでのんびりできるねぇ！"], ["赤色の獣", "クッションもいっぱい置けるな！"], ["黄色い獣", "みんな、ぼくのソファをつくるの、てつだってくれる？"]], "pyoro_table": [["赤色の獣", "なぁ、オレのへやにも、なにかほしいんだけど……。"], ["黄色い獣", "なにがほしいのぉ？"], ["赤色の獣", "ひろったものをならべたり、おやつをおいたりできるテーブル！"], ["赤色の獣", "木でできた、ひくいやつがいいな。てつだってくれるか？"]]});
const buildStillByQuest={hall_lounge:'images/memories/hall-expansion.webp',hall_stairs:'images/memories/hall-stairs.webp'};
const buildCompleteByQuest={
  hall_lounge:{title:'寛ぎスペースが完成しました！',lines:['みんなのおかげで、ホールに寛げる場所ができた。','黄色い獣「わぁ、ふかふかだぁ！ みんな、ありがとう！」','赤色の獣「やったな！ ここでいっぱいのんびりできるぞ！」']},
  hall_stairs:{title:'ホール拡張が完成しました！',lines:['みんなのおかげで、ホールが大きく広がり、二階へ続く階段ができた。','黄色い獣「わぁ……！ こんなにひろくなるなんて、すごいねぇ！」','赤色の獣「やったー！ これで二階にも行けるぞ！」']}
};
Object.assign(buildCompleteByQuest,{paper_room:{title:'黄色い獣のおへやが完成しました！',lines:['黄色い獣「わぁ～！ ぼくのおへやだぁ！」']},paper_bed:{title:'黄色い獣のベッドが完成しました！',lines:['黄色い獣「ふかふかだぁ！」']},pyoro_room:{title:'赤色の獣のおへやが完成しました！',lines:['赤色の獣「……オレのおへやだ。ありがとう！」']}});
Object.assign(buildCompleteByQuest,{"pyoro_bed": {"title": "赤色の獣のベッドが完成しました！", "lines": ["赤色の獣「うわっ、ふかふかだ！ ……ありがとうな！」"]}, "paper_rug": {"title": "黄色い獣のラグ・クッションが完成しました！", "lines": ["黄色い獣「えへへぇ、ずっとごろごろしていたいなぁ！」"]}, "pyoro_rug": {"title": "赤色の獣のラグ・クッションが完成しました！", "lines": ["赤色の獣「へへっ、これでオレもごろごろできるぞ！ ありがとな！」"]}});
Object.assign(buildCompleteByQuest,{"paper_sofa": {"title": "黄色い獣の窓際ソファが完成しました！", "lines": ["黄色い獣「わぁ～！ ここ、ぽかぽかだねぇ！ ありがとう！」"]}, "pyoro_table": {"title": "赤色の獣のローテーブルが完成しました！", "lines": ["赤色の獣「へへっ、これでたからものもならべられるぞ！ ありがとな！」"]}});
Object.assign(buildDialogues,{paper_desk:[['黄色い獣','ねぇねぇ、ぼく、えをかいたり、おはなしをかいたりしたいなぁ！'],['黄色い獣','ちいさなつくえとイスがあったらいいなぁ。'],['赤色の獣','できたらオレにもみせてくれよ。'],['黄色い獣','うん！ みんな、おてつだいしてくれる？']],pyoro_shelf:[['赤色の獣','オレも、ほんとかたからものをおくところがほしい……。'],['黄色い獣','ほんだなだねぇ！'],['赤色の獣','うん。きれいにならべたいんだ。'],['赤色の獣','……てつだってくれるか？']]});
Object.assign(buildCompleteByQuest,{paper_desk:{title:'黄色い獣の机が完成しました！',lines:['黄色い獣「わぁ！ いっぱいえをかくねぇ！ ありがとう！」']},pyoro_shelf:{title:'赤色の獣の本棚が完成しました！',lines:['赤色の獣「へへっ、これでたいせつなものをしまえるぞ。ありがとな！」']}});
Object.assign(buildDialogues,{paper_decor:[['黄色い獣','ねぇねぇ、ぼくのおへや、すっかりすてきになったねぇ！'],['黄色い獣','おほしさまのかざりと、きれいなカーテンもあったらいいなぁ。'],['赤色の獣','夜もあかるくなるように、ランプもつけたらどうだ？'],['黄色い獣','わぁ！ さいごのおねがい、てつだってくれる？']],pyoro_decor:[['赤色の獣','……オレのへやも、もうちょっとだけかざりたいんだ。'],['赤色の獣','たからものをしまうタンスと、あったかいあかりがほしい。'],['黄色い獣','おはなや、きれいなつぼもいいねぇ！'],['赤色の獣','へへっ。これでさいごだ。みんな、てつだってくれるか？']]});
Object.assign(buildCompleteByQuest,{paper_decor:{title:'黄色い獣のおへやが完成しました！',lines:['黄色い獣「わぁ～！ きらきらだぁ！ みんな、だいすき！」']},pyoro_decor:{title:'二匹のおへやが完成しました！',lines:['黄色い獣「わぁ～！ ぼくたちのおへや、こんなにすてきになったよぉ！」','赤色の獣「へへっ……オレ、こんなにいいへやができるなんておもわなかったぞ！」','黄色い獣「みんながいっぱいおてつだいしてくれたからだねぇ！」','赤色の獣「……ほんとに、ありがとな！」','黄色い獣「これからも、いっぱいあそぼうねぇ！」','二匹は顔を見合わせ、嬉しそうににっこりと笑った。']}});
function renderFurnitureSkills(id,n){const el=document.getElementById(id);if(!el)return;el.replaceChildren();for(const skill of n.skills||[]){const row=document.createElement('p');row.textContent=skill.name+' ｜ '+['','興味を持った','練習中','慣れてきた','得意'][skill.level];el.append(row);}}
let buildBusy=false,buildStep=-1,buildOwner='',buildLastProgress=-1,buildQuestKey='',buildLastCompletedAt=null;
const dismissedBuildCompletions=new Set();
function buildCompletionKey(data){return `kagariso-build-closed:${resident?.id}:${data.questId}:${data.completedAt}`;}
function isBuildCompletionClosed(data){const key=buildCompletionKey(data);try{return dismissedBuildCompletions.has(key)||localStorage.getItem(key)==='1';}catch{return dismissedBuildCompletions.has(key);}}
function closeBuildCompletion(data){const key=buildCompletionKey(data);dismissedBuildCompletions.add(key);try{localStorage.setItem(key,'1');}catch{}renderHallBuild(data);}
function showBuildEvent(data,complete=false,replay=false){
 const questId=data.questId;let index=0,busy=false;
 const done=buildCompleteByQuest[questId];const dialogue=complete?(done?.lines||[]).map(line=>['',line]):(buildDialogues[questId]||[]);
 if(!dialogue.length)return;
 const next=$('#build-event-next'),prev=$('#build-event-prev'),img=$('#build-event-image');
 const render=()=>{
 const still=questId==='paper_decor'?privateRoomImage('paper',5):questId==='pyoro_decor'?privateRoomImage('pyoro',5):questId==='paper_desk'?privateRoomImage('paper',4):questId==='pyoro_shelf'?privateRoomImage('pyoro',4):questId==='paper_room'?`images/memories/paper-room-event${index<5?1:2}.webp`:questId==='paper_bed'?privateRoomImage('paper',1):questId==='pyoro_room'?privateRoomImage('paper',2):questId==='pyoro_bed'?privateRoomImage('pyoro',1):questId==='paper_rug'?privateRoomImage('paper',2):questId==='pyoro_rug'?privateRoomImage('pyoro',2):questId==='paper_sofa'?privateRoomImage('paper',3):questId==='pyoro_table'?privateRoomImage('pyoro',3):buildStillByQuest[questId]||buildStillByQuest.hall_lounge;
 let picture=still;if(complete){const npc=questId.startsWith('paper_')?'paper':questId.startsWith('pyoro_')?'pyoro':null;const levels={room:1,bed:2,rug:3,sofa:4,table:4,desk:5,shelf:5,decor:6};if(npc)picture=privateRoomImage(npc,levels[questId.split('_')[1]]);else picture=`images/memories/${questId==='hall_stairs'?'hall-stairs':'hall-expansion'}.webp`;}
 $('#build-event-title').textContent=complete?done.title:(data.title||'ホール拡張計画');img.src=picture;
 const line=dialogue[index];$('#build-event-text').textContent=line[0]?`${line[0]}\n\n「${line[1]}」`:line[1];$('#build-event-progress').textContent=`${index+1} / ${dialogue.length}`;prev.disabled=index===0;next.textContent=index===dialogue.length-1?(replay?'思い出に戻る':complete?'閉じる':'会話を終える →'):'続きを読む →';};
 prev.onclick=()=>{if(!busy&&index>0){index--;render();}};next.disabled=false;next.onclick=handler(async()=>{if(busy)return;if(index<dialogue.length-1){index++;render();return;}busy=true;next.disabled=true;try{if(replay){await openForestMemories();return;}if(complete){closeBuildCompletion(data);}else{try{await api('/build/lounge/visit','POST',{questId});}catch(e){const latest=await api('/build/lounge');if(latest.active&&latest.questId===questId)throw e;}}await openHall();}finally{busy=false;next.disabled=false;}});render();show('build-event');
}
function renderHallBuild(data){
 const panel=$('#hall-build');if(!panel)return;
 const hasPanel=!!(data?.active||data?.completedAt)&&!(data?.completedAt&&!data.active&&isBuildCompletionClosed(data));
 if(buildOwner!==resident?.id||buildQuestKey!==String(data?.questId||'')){buildOwner=resident?.id;buildQuestKey=String(data?.questId||'');buildStep=-1;buildLastProgress=-1;}
 panel.classList.toggle('hidden',!hasPanel);buildLastProgress=data?.progress??0;buildLastCompletedAt=data?.completedAt??null;if(!hasPanel){panel.replaceChildren();return;}
 if(!data.active&&data.completedAt){
  const done=buildCompleteByQuest[data.questId]||{title:'ホール拡張が完成しました！',lines:['みんなで力を合わせて、ホールがより居心地のよい場所になった。']};
  panel.innerHTML=`<h2>${safe(done.title)}</h2><button class="primary" id="build-complete-story">様子を見る</button>`;$('#build-complete-story').onclick=()=>showBuildEvent(data,true);const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='閉じる';close.onclick=()=>closeBuildCompletion(data);panel.append(close);return;
 }
 const questId=data.questId||'hall_lounge';
 const dialogue=buildDialogues[questId]||buildDialogues.hall_lounge;
 const completeInfo=buildCompleteByQuest[questId]||buildCompleteByQuest.hall_lounge;
 if(!data.seen){panel.innerHTML=`<h2>${safe(data.title||'ホール拡張計画')}</h2><p>獣たちが何か相談している。</p><button class="primary" id="build-start">話を聞く</button>`;$('#build-start').onclick=()=>showBuildEvent(data);return;}
 const total=data.requirements.reduce((a,r)=>a+r.needed,0),done=data.requirements.reduce((a,r)=>a+r.donated,0);
 panel.innerHTML=`<h2>共同クエスト｜${safe(data.title||completeInfo.title)}</h2><div class="progress-track"><div class="progress-fill" style="width:${total?100*done/total:0}%"></div></div><p class="muted">${done} / ${total} 納品済み</p><div id="build-reqs" class="cave-requirements"></div>`;
 for(const r of data.requirements){const card=document.createElement('div');card.className='requirement-row';const remaining=r.needed-r.donated;card.innerHTML=`<div class="material-inline">${matIcon(r.id)}<div><strong>${safe(r.name)}</strong><div class="muted tiny">納品済み ${r.donated} / ${r.needed}　残り ${remaining}　｜持ち物 ×${r.owned}　｜あなたの納品 ${r.personal}</div></div></div>`;
 if(remaining>0){const form=document.createElement('form');form.className='donation-form';const input=document.createElement('input');input.type='number';input.min='1';input.max=String(Math.min(remaining,r.owned));input.step='1';input.value=String(Math.min(10,Number(input.max))||1);input.setAttribute('aria-label',r.name+'の納品数');const btn=document.createElement('button');btn.type='submit';btn.className='secondary small';btn.textContent='納品';btn.disabled=Number(input.max)<1;appendDonationControls(form,input,btn);let pending=null;
 form.onsubmit=handler(async e=>{e.preventDefault();if(buildBusy)return;const quantity=Number(input.value);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>Number(input.max))throw new Error('納品数を確認してください。');if(!pending||pending.quantity!==quantity)pending={quantity,itemId:r.id,questId,requestId:crypto.randomUUID()};buildBusy=true;btn.disabled=true;const previousLevel=hallBuildLevel;try{const result=await api('/build/lounge/donate','POST',pending);pending=null;hallBuildLevel=result.level;renderHallBuild(result);renderPrivateRoomLinks(result);updateHallBackground();if(activePage==='hall'&&result.completedAt&&!isBuildCompletionClosed(result))showBuildEvent(result,true);const completedMessage=result.level>previousLevel?(result.level>=3?'ホール拡張が完成しました！':'寛ぎスペースが完成しました！'):'納品しました。';toast(result.questId!==questId||!result.active?(buildCompleteByQuest[questId]?.title||'おへやの共同クエストが完成しました！'):completedMessage);}catch(err){if(err.message.includes('納品状況')){pending=null;renderHallBuild(await api('/build/lounge'));}throw err;}finally{buildBusy=false;btn.disabled=false;}});card.append(form);}$('#build-reqs').append(card);}
}
let selectedCaveSection=1,activeCaveStory=null,caveStoryReplay=false;
const caveQty=(n)=>Number(n)||0;
let caveActionBusy=false,caveRefreshTask=null,caveOpening=0,caveSnapshotKey='',lastCaveProgress=null;
function renderCaveStatus(cave,items,sectionId){
  // v0.16.4.3: 共同開拓が完了したら、手動の進捗更新は不要。
  $('#cave-refresh').classList.toggle('hidden',!!cave.rescued);
  const key=JSON.stringify([cave,items,sectionId]);
  if(key===caveSnapshotKey)return;
  caveSnapshotKey=key;
  $('#cave-npc-section').classList.toggle('hidden',!cave.npcInCave||!!cave.requiredStory);
  const navigation=$('#cave-sections');navigation.replaceChildren();
  for(const sec of cave.sections){
    const btn=document.createElement('button');btn.type='button';btn.className='secondary small'+(sec.id===sectionId?' selected':'');
    btn.textContent=sec.name;btn.addEventListener('click',handler(()=>openCave(sec.id)));navigation.append(btn);
  }
  const constructionVisible=!cave.rescued&&!cave.requiredStory&&sectionId===cave.currentSection;
  $('#cave-construction').classList.toggle('hidden',!constructionVisible);
  if(constructionVisible){
    $('#cave-gate-title').textContent=cave.gateLabel;
    const total=cave.requirements.reduce((s,r)=>s+r.needed,0),done=cave.requirements.reduce((s,r)=>s+r.donated,0);
    $('#cave-progress-fill').style.width=(total?100*done/total:0)+'%';
    $('#cave-progress-label').textContent=`現在の区画：${done} / ${total} 納品済み`;
    const requirements=$('#cave-requirements');
    const focusedItem=document.activeElement?.dataset?.item;const draft=new Map([...requirements.querySelectorAll('input[data-item]')].map(i=>[i.dataset.item,i.value]));requirements.replaceChildren();
    const owned=Object.fromEntries(items.map(i=>[i.id,i.quantity]));
    for(const req of cave.requirements){
      const card=document.createElement('div');card.className='requirement-row';
      const info=document.createElement('div');info.innerHTML=`<div class="material-inline">${matIcon(req.id)}<div><strong>${safe(req.name)}</strong><div class="muted tiny">納品済み ${req.donated} / ${req.needed}　残り ${req.remaining}　｜持ち物 ×${owned[req.id]||0}</div></div></div>`;
      card.append(info);
      if(req.remaining>0){
        const form=document.createElement('form');form.className='donation-form';
        const input=document.createElement('input');input.type='number';input.min='1';input.step='1';input.max=String(Math.min(req.remaining,owned[req.id]||0));input.value=String(Math.min(req.remaining,owned[req.id]||0,10)||1);input.dataset.item=req.id;input.setAttribute('aria-label',req.name+'の納品数');if(draft.has(req.id)&&Number(input.max)>0)input.value=String(Math.max(1,Math.min(Number(input.max),Number(draft.get(req.id))||1)));
        const btn=document.createElement('button');btn.type='submit';btn.textContent='納品';btn.className='secondary small';btn.disabled=(owned[req.id]||0)===0;
        appendDonationControls(form,input,btn);form.addEventListener('submit',handler(async e=>{
          e.preventDefault();if(caveActionBusy||gathering)return;const quantity=Number(input.value);
          if(!Number.isSafeInteger(quantity)||quantity<1||quantity>req.remaining||quantity>(owned[req.id]||0))throw new Error('納品数を確認してください。');
          btn.disabled=true;
          caveActionBusy=true;
          try{const result=await api('/cave/donate','POST',{sectionId:cave.currentSection,itemId:req.id,quantity});toast(result.message);}finally{try{await refreshCaveStatus(true);}catch(e){console.warn(e);}caveActionBusy=false;btn.disabled=false;}
        }));card.append(form);
      }
      requirements.append(card);
    }
    if(focusedItem){const input=[...requirements.querySelectorAll('input[data-item]')].find(i=>i.dataset.item===focusedItem);input?.focus({preventScroll:true});}
    $('#cave-excavate').classList.toggle('hidden',!cave.ready);
    $('#cave-excavate-note').textContent=cave.ready?'必要な素材がすべて揃いました。誰でも開拓できます。':'必要な素材を住人全員で持ち寄りましょう。';
    $('#cave-excavate').onclick=handler(async()=>{
      if(caveActionBusy||gathering)return;const btn=$('#cave-excavate');btn.disabled=true;caveActionBusy=true;
      try{const result=await api('/cave/excavate','POST',{sectionId:cave.currentSection});toast(result.message);await openCave(result.cave.currentSection);}finally{caveActionBusy=false;btn.disabled=false;}
    });
  }
  // 解放済みの章は未体験でも開ける。初回選択は個人に保存し、再読では変更しない。
  const history=$('#cave-history');history.replaceChildren();
  for(const sec of cave.sections){
    const id=`section-${sec.id}`, seen=cave.stories.some(x=>x.id===id);
    const btn=document.createElement('button');btn.className='secondary';
    btn.textContent=`${sec.name}の物語`;
    btn.disabled=!!cave.requiredStory;
    btn.addEventListener('click',handler(()=>openStory(id,seen)));history.append(btn);
  }
  if(cave.rescued){
    const seen=cave.stories.some(x=>x.id==='rescue');
    const btn=document.createElement('button');btn.className='secondary';
    btn.textContent='黄色い獣を連れ帰った物語';
    btn.disabled=!!cave.requiredStory;btn.addEventListener('click',handler(()=>openStory('rescue',seen)));history.append(btn);
  }
}
async function refreshCaveStatus(force=false){
  if(activePage!=='cave'||!token||(!force&&(gathering||caveActionBusy)))return;
  if(caveRefreshTask){if(!force)return;await caveRefreshTask.catch(()=>{});if(activePage!=='cave')return;}
  const generation=caveOpening,section=selectedCaveSection,session=token;
  const task=(async()=>{
    const {cave,items}=await api('/cave/status');
    if(activePage!=='cave'||generation!==caveOpening||section!==selectedCaveSection||session!==token||(!force&&(gathering||caveActionBusy)))return;
    const previous=lastCaveProgress;lastCaveProgress={section:cave.currentSection,rescued:cave.rescued};
    if(previous&&(cave.currentSection>previous.section||(!previous.rescued&&cave.rescued))){
      const target=cave.sections.find(x=>x.id===cave.currentSection);
      const label=cave.rescued?'洞窟の出口が開拓されました！':`${target?.name||'新しい区画'}が解放されました！`;
      $('#cave-unlock-notice').textContent=label;$('#cave-unlock-banner').classList.remove('hidden');
      $('#cave-unlock-go').textContent=cave.rescued?'物語へ進む':`${target?.name||'次の区画'}へ進む`;
      $('#cave-unlock-go').onclick=handler(async()=>{ $('#cave-unlock-banner').classList.add('hidden');await openCave(cave.currentSection); });
      if(notificationPrefs().cave)pushGameNotice(label,()=>openCave(cave.currentSection));
    }
    const y=window.scrollY;renderCaveStatus(cave,items,section);if(window.scrollY!==y)window.scrollTo(0,y);
    // 救出などの必須物語が発生したら採取を止め、本人の選択で物語へ進む。
    if(cave.requiredStory){$('#cave-spots').querySelectorAll('button').forEach(b=>b.disabled=true);$('#cave-unlock-banner').classList.remove('hidden');$('#cave-unlock-notice').textContent='新しい物語が解放されました。先に物語を体験してください。';$('#cave-unlock-go').textContent='物語へ進む';$('#cave-unlock-go').onclick=handler(()=>openCave(section));}
  })();caveRefreshTask=task;try{await task;}finally{if(caveRefreshTask===task)caveRefreshTask=null;}
}

async function openCave(sectionId=null){
  const requestId=++caveOpening;const previousSection=selectedCaveSection;const previousMap=!$('#cave-map').classList.contains('hidden');
  const {cave,items}=await api('/cave/status');
  if(requestId!==caveOpening)return;
  lastCaveProgress={section:cave.currentSection,rescued:cave.rescued};caveSnapshotKey='';$('#cave-unlock-banner').classList.add('hidden');
  if(!cave.sections.length)throw new Error('洞窟のデータがまだありません。');
  // 救出済み・必須物語完了後のみ地図を解放する。
  const mapAllowed=cave.rescued && cave.worldRescued && !cave.requiredStory && cave.stories.some(x=>x.id==='rescue');
  const showMap=mapAllowed && sectionId===null;
  $('#cave-map').classList.toggle('hidden',!showMap);
  $('#cave-map-return').classList.toggle('hidden',!mapAllowed||showMap);
  $('#cave-sections').classList.toggle('hidden',showMap);
  if(sectionId===null||!cave.sections.some(s=>s.id===sectionId))sectionId=cave.currentSection;
  selectedCaveSection=sectionId;
  mandatoryStory=!!cave.requiredStory;
  $('#cave-npc-section').classList.toggle('hidden',!cave.npcInCave||!!cave.requiredStory);
  $('#cave-npc-note').textContent=cave.npcInCave?'黄色い獣はまだ洞窟の入口で過ごしている。会いに行こう。':'';
  renderCaveStatus(cave,items,sectionId);
  if(showMap){
    if(activePage==='cave'&&!previousMap)window.scrollTo(0,0);
    $('#cave-section-content').classList.add('hidden');
    $('#cave-map').querySelectorAll('[data-cave-area]').forEach(btn=>{
      const id=Number(btn.dataset.caveArea);
      btn.disabled=!cave.sections.some(sec=>sec.id===id);
      btn.onclick=handler(()=>openCave(id));
    });
    show('cave');return;
  }
  const entry=await api('/cave/section?id='+sectionId);
  if(requestId!==caveOpening)return;
  visualImg('#cave-section-background',bgVisual.sections?.[sectionId]||bgVisual.cave);
  $('#cave-section-name').textContent=entry.section.name;
  $('#cave-description').textContent=entry.section.description;
  const list=$('#cave-spots');list.replaceChildren();
  for(const spot of entry.spots){
    const btn=document.createElement('button');btn.className='secondary gather-btn';
    btn.innerHTML=`<strong>${safe(spot.name)}</strong><span class="muted tiny">${safe(spot.description)}</span>`;
    btn.addEventListener('click',handler(async()=>{
      if(gathering||caveActionBusy)return;
      gathering=true;const actionGeneration=caveOpening;list.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{
        const result=await api('/cave/gather','POST',{sectionId,spotId:spot.id});
        if(activePage!=='cave'||actionGeneration!==caveOpening)return;
        const found=result.items.map(item=>`<span class="material-found-item">${matIcon(item.id)}<strong>${safe(item.name)} ×${Number(item.quantity)}</strong></span>`).join('、');
        $('#cave-result').innerHTML=`<div>${safe(result.message)}</div>${found?`<div>入手：${found}</div>`:''}`;
        $('#cave-result').classList.remove('hidden');
        await refreshCaveStatus(true).catch(console.warn);
      }finally{gathering=false;list.querySelectorAll('button').forEach(b=>b.disabled=!$('#cave-unlock-banner').classList.contains('hidden')&&$('#cave-unlock-go').textContent==='物語へ進む');}
    }));list.append(btn);
  }
  $('#cave-result').classList.add('hidden');$('#cave-section-content').classList.remove('hidden');show('cave');
  if(previousSection!==sectionId||previousMap)window.scrollTo(0,0);
  if(cave.requiredStory)await openStory(cave.requiredStory,false);
  else if(entry.story)await openStory(entry.story.id,false);
}
async function openStory(storyId,replay){
  const {story,seen,originalChoice}=await api('/cave/story?id='+encodeURIComponent(storyId));
  if(replay&&!seen)throw new Error('まだ体験していない物語です。');
  activeCaveStory=storyId;caveStoryReplay=replay;
  visualImg('#cave-story-background',bgVisual.cave);
  paintPaper('#cave-story-paper-image',currentNpc,'normal');
  $('#cave-story-title').textContent=story.title;
  const scene=$('#cave-story-scene'),speech=$('#cave-story-speech');
  const choices=$('#cave-story-choices'),result=$('#cave-story-result'),done=$('#cave-story-done');
  const next=$('#cave-story-next');
  let phase='pre', index=0,selected=null;
  const pre=Array.isArray(story.pre)&&story.pre.length?story.pre:[story.scene];
  const post=Array.isArray(story.post)&&story.post.length?story.post:[];
  const showParagraph=(value)=>{scene.textContent=value;scene.classList.remove('hidden');};
  const render=()=>{
    applyCaveStoryVisual(storyId,phase,index,pre.length,post.length);
    choices.replaceChildren(); result.classList.add('hidden');done.classList.add('hidden');next.classList.add('hidden');
    speech.parentElement.classList.add('hidden');
    if(phase==='pre'){
      showParagraph(pre[index]); next.textContent=index===pre.length-1?'黄色い獣の話を聞く →':'続きを読む →'; next.classList.remove('hidden');
      return;
    }
    if(phase==='choice'){
      showParagraph('黄色い獣がこちらの返事を待っている。');
      speech.textContent=story.speech;speech.parentElement.classList.remove('hidden');
      if(replay){const note=document.createElement('p');note.className='muted tiny';note.textContent='読み返し中：返答を試せます。初回の選択記録は変わりません。';choices.append(note);}
      for(const opt of story.choices){
        const btn=document.createElement('button');btn.className='secondary';btn.textContent=opt.label+(replay&&opt.id===originalChoice?'（初回の選択）':'');
        btn.addEventListener('click',handler(async()=>{
          // 初回だけこの時点で記録。再読は初回の選択を書き換えない。
          const answer=await api('/cave/story/choose','POST',{storyId,choiceId:opt.id,replay});
          selected=opt; phase='response';render();
        })); choices.append(btn);
      }
      return;
    }
    if(phase==='response'){
      showParagraph('あなたの返答を聞いて、黄色い獣は少し考えたあと、ゆっくり口を開いた。');
      speech.textContent=selected.response;speech.parentElement.classList.remove('hidden');
      next.textContent='物語の続きを読む →';next.classList.remove('hidden');return;
    }
    if(phase==='post'){
      showParagraph(post[index]);next.textContent=index===post.length-1?'物語を終える →':'続きを読む →';next.classList.remove('hidden');return;
    }
    scene.classList.add('hidden');
    result.textContent=replay?'読み返しはここまで。初回の記録は変更されていません。':'この出来事を思い出に記録しました。';
    result.classList.remove('hidden');done.classList.remove('hidden');
  };
  next.onclick=()=>{
    if(phase==='pre'){if(++index>=pre.length){phase='choice';index=0;}}
    else if(phase==='response'){phase=post.length?'post':'complete';index=0;}
    else if(phase==='post'){if(++index>=post.length)phase='complete';}
    render();
  };
  render();show('cave-story');
  $('#cave-story-back').classList.toggle('hidden',mandatoryStory&&!replay);
  $('#cave-story-done').textContent=mandatoryStory&&!replay?'次へ進む →':'洞窟へ戻る →';
}
// v0.9.2 図鑑: 素材は45枠を常時公開し、イベント品・プレゼントは取得後のみ追加。
// ジャンル／発見状態／入手場所を独立して絞り込める。
const SOURCE_ORDER=['洞窟','森','海','料理','服飾','商人との交換','温室','その他'];
const sourceGroup=s=>s==='初回イベント'||s==='商人と交換'?'商人との交換':SOURCE_ORDER.includes(s)?s:'その他';
const sourceRank=s=>SOURCE_ORDER.indexOf(sourceGroup(s));
const sourceLabel=s=>s==='初回イベント'||s==='商人と交換'?'商人との交換':s;
const collectionTabs=[['material','素材'],['cooked','料理'],['snack','おやつ'],['clothing','服飾'],['gift','贈り物'],['event','イベント'],['other','その他']];
let inventoryTab='material',catalogTab='material',mailTab='receive';
function collectionKind(i){const k=String(i.kind||''),c=String(i.category||'');if(k==='gift')return 'gift';if(k==='event')return 'event';if(k==='clothing'||/服飾|衣服/.test(c))return 'clothing';if(k==='cooked'||k==='cooking')return /おやつ|菓子|dessert|snack/i.test(c)?'snack':'cooked';if(k==='crafted'||k==='craft')return 'crafted';return k==='material'?'material':'other';}
function collectionTabBar(id,tabs,current,change){const root=$(id);root.replaceChildren();for(const [key,label] of tabs){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.setAttribute('aria-pressed',String(key===current));b.onclick=()=>change(key);root.append(b);}}
function collectionDetail(i){const d=document.createElement('dialog');d.className='collection-detail';d.innerHTML=`<h2>${safe(i.name)}</h2>${i.image?`<img src="${safe(i.image)}" alt="">`:''}<p>${safe(i.description||'')}</p><p class="muted">${safe(i.category||'')} · ${safe(sourceLabel(i.source)||'')}${i.quantity==null?'':` · 所持数 ×${Number(i.quantity)}`}</p>${i.firstCreatedAt?`<p class="muted">作成済み${i.times==null?'':` · 作成回数 ${Number(i.times)}回`}${i.totalCreated==null?'':` · 累計作成数 ${Number(i.totalCreated)}個`}</p>`:''}<button class="secondary">閉じる</button>`;document.body.append(d);d.querySelector('button').onclick=()=>d.close();if(i.kind==='clothing'&&i.image){const a=document.createElement('a');a.href=i.image;a.download=i.id+'.webp';a.textContent='画像を保存する';a.style.display='block';d.insertBefore(a,d.querySelector('button'));}d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();}
function collectionCards(root,items){[...root.querySelectorAll('article')].forEach((card,n)=>{const item=items[n];if(!item||item.found===false)return;card.tabIndex=0;card.setAttribute('role','button');card.onclick=()=>collectionDetail(item);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();collectionDetail(item);}};});}
async function openMaterialCatalog(){
 const [discovery,eventData,giftData,giftStats,createdData]=await Promise.all([
   api('/materials/discovered'),
   api('/catalog/events'),
   api('/inventory'),
   api('/catalog/gifts'),
   api('/catalog/created')
 ]);
 const discovered=new Set(discovery.ids||[]);
 const forestReady=Boolean(forestState?.unlocked&&forestState?.seen&&forestState?.eligible);
 const materials=MATERIALS.filter(m=>(!window.KAGARISO_GREENHOUSE.items.some(x=>x.id===m.id)||greenhouseUnlocked||discovered.has(m.id))&&(m.source!=='森'||forestReady||discovered.has(m.id))&&(m.source!=='海'||Boolean(seaState?.unlocked&&seaState?.eligible)||discovered.has(m.id))).map(m=>({id:m.id,name:m.name,image:m.image,rarity:m.rarity,
   category:m.category,description:m.description,kind:'material',source:m.source||'洞窟',found:discovered.has(m.id)}));
 const events=(eventData.items||[]).map(e=>({id:e.id,name:e.name,image:e.image,description:e.description,
   kind:'event',source:e.source||'その他',found:true}));
 // 実際に「受け取った」プレゼントのみ。準備中や未受取は図鑑に出さない。
 const giftDefs=new Map((window.KAGARISO_GIFTS||[]).map(g=>[g.id,g]));
 const giftRecords=new Map((giftData.gifts||[]).filter(g=>Number(g.quantity)>0).map(g=>[g.itemId,g]));
 const receivedData=await api('/gifts').catch(()=>({}));
 for(const g of [...(receivedData.npc?.history||[]),...(receivedData.pyoro?.history||[])]){const id=g.itemId||[...giftDefs.values()].find(d=>d.name===g.name)?.id;if(id&&!giftRecords.has(id))giftRecords.set(id,{...g,itemId:id,npcName:g.sender});}
 const gifts=[...giftRecords.values()].map(g=>{
   const def=giftDefs.get(g.itemId)||{};
   return {id:g.itemId,name:g.name||def.name,description:g.description||def.description,
     image:g.image||def.image||'',kind:'gift',source:g.npcName||'黄色い獣',found:true};
 });
 // 作成履歴は所持数と独立してサーバーから取得する。
 // 未発見の返礼品は名前・IDを公開せず、総数のみ図鑑に反映。
 const giftTotal=Math.max(gifts.length,Number(giftStats.total)||0);
 const foundByNpc=new Map();gifts.forEach(g=>foundByNpc.set(g.source,(foundByNpc.get(g.source)||0)+1));
 const giftUnknown=(giftStats.byNpc||[{name:'黄色い獣',count:giftTotal}]).flatMap(({name,count})=>Array.from({length:Math.max(0,Number(count)-(foundByNpc.get(name)||0))},(_,n)=>({id:`gift-unknown-${name}-${n}`,name:'？？？？？',kind:'gift',source:name,found:false})));
 const entries=[...materials,...events,...gifts,...giftUnknown,...(createdData.items||[])].sort((a,b)=>sourceRank(a.source)-sourceRank(b.source));
 const progress=$('#catalog-progress');
 progress.textContent=`素材：${materials.filter(m=>m.found).length} / ${materials.length} ｜ イベントアイテム：${events.length?events.length:"-"} ｜ プレゼント：${gifts.length}/${giftTotal} ｜ 作成済み：${(createdData.items||[]).filter(i=>i.found).length}/${(createdData.items||[]).length}種類`;
 const kindLabels={material:'素材',event:'イベントアイテム',gift:'プレゼント',crafted:'作製物',cooked:'作成済み',clothing:'服飾'};
 const render=()=>{
   const state=$('#catalog-filter').value;
   const rarity=catalogTab==='material'?$('#catalog-rarity').value:'all', query=$('#catalog-search').value.trim().toLowerCase();
   const kind=catalogTab; if(kind!=='material')$('#catalog-rarity').value='all'; $('#catalog-rarity').disabled=kind!=='material'; collectionTabBar('#catalog-tabs',collectionTabs,catalogTab,k=>{catalogTab=k;render();});
   const source=$('#catalog-source').value;
   const selected=entries.filter(m=>(state==='all'||(state==='found'?m.found:!m.found))
     &&(collectionKind(m)===kind)&&(source==='all'||sourceGroup(m.source)===source||(forestReady&&source==='森'&&m.kind==='material'&&FOREST_COMMON.has(m.id)))
     &&(rarity==='all'||(m.kind==='material'&&Number(m.rarity)===Number(rarity)))&&(!query||(m.found&&m.name.toLowerCase().includes(query))));
   $('#catalog-results').textContent=`表示：${selected.length} 件`;
   $('#material-catalog-grid').innerHTML=selected.map(item=>{
     const found=item.found;
     // 管理用ID（sozai0001 / C020 / GIFT_*）は画面には出さない。
     const thumb=found&&item.image
       ?`<img class="material-thumb" src="${safe(item.image)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('✧'))">`
       :found?'<span class="catalog-placeholder" aria-hidden="true">✧</span>'
       :'<div class="material-missing-icon" aria-hidden="true">？</div>';
     const subtitle=found
       ?`${safe(kindLabels[item.kind]||item.kind)} · ${safe(forestReady&&item.kind==='material'&&FOREST_COMMON.has(item.id)?'洞窟・森':sourceLabel(item.source))}${item.kind==='material'?' · '+safe(item.category)+' · '+'★'.repeat(item.rarity):''}`
       :item.kind==='gift'?'未入手のプレゼント':collectionKind(item)==='snack'?'未発見のおやつ':collectionKind(item)==='cooked'?'未発見の料理':collectionKind(item)==='clothing'?'未作成の服':'未発見素材';
     return `<article class="material-catalog-card ${found?'':'undiscovered'}"><div class="material-catalog-image">${thumb}</div><strong>${found?safe(item.name):'？？？？？'}</strong><div class="muted tiny">${subtitle}</div></article>`;
   }).join('')||'<p class="muted catalog-empty">該当する品はまだありません。</p>';
   collectionCards($('#material-catalog-grid'),selected);
 };
 const sourceSelect=$('#catalog-source');
 // Rebuild options rather than hiding native select options (mobile browsers may expose them).
 const previousSource=sourceSelect.value;
 const sources=new Set(SOURCE_ORDER);
 if(!forestReady)sources.delete('森');if(!seaState?.unlocked||!seaState?.eligible)sources.delete('海');
 sourceSelect.replaceChildren(new Option('すべて','all'),...[...sources].map(source=>new Option(source,source)));
 sourceSelect.value=[...sourceSelect.options].some(o=>o.value===sourceLabel(previousSource))?sourceLabel(previousSource):'all';
 for(const selector of ['#catalog-filter','#catalog-kind','#catalog-source','#catalog-rarity'])$(selector).onchange=render;
 $('#catalog-search').oninput=render;
 render();show('material-catalog');
}
// v0.11.8.1: 所持品のデータはサーバーのまま。並び替えは画面上だけで行う。
let inventorySortItems=[];
function renderInventoryItems(){
  const mode=$('#inventory-sort').value;
  const sourceFilter=$('#inventory-source').value;
  collectionTabBar('#inventory-tabs',collectionTabs,inventoryTab,k=>{inventoryTab=k;renderInventoryItems();});
  const query=$('#inventory-search').value.trim().toLowerCase();
  const items=inventorySortItems.filter(i=>Number(i.quantity)>0&&collectionKind(i)===inventoryTab&&String(i.name||'').toLowerCase().includes(query)&&(sourceFilter==='all'||sourceGroup(i.source)===sourceFilter||(sourceFilter==='森'&&i.kind==='material'&&FOREST_COMMON.has(i.id))));
  const byName=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ja');
  const rarity=i=>Number(i.rarity)||0;
  const count=i=>Number(i.quantity)||0;
  if(mode==='name-asc') items.sort(byName);
  else if(mode==='count-desc') items.sort((a,b)=>count(b)-count(a)||byName(a,b));
  else if(mode==='count-asc') items.sort((a,b)=>count(a)-count(b)||byName(a,b));
  else if(mode==='rarity-desc') items.sort((a,b)=>rarity(b)-rarity(a)||byName(a,b));
  else if(mode==='rarity-asc') items.sort((a,b)=>rarity(a)-rarity(b)||byName(a,b));
  else if(mode==='category') items.sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'ja')||byName(a,b));
  else if(mode==='source') items.sort((a,b)=>sourceRank(a.source)-sourceRank(b.source)||byName(a,b));
  else items.sort((a,b)=>sourceRank(a.source)-sourceRank(b.source));
  $('#inventory-list').innerHTML=items.length?items.map(i=>`<article class="inventory-item">${i.image?`<img class="material-thumb" src="${safe(i.image)}" loading="lazy" alt="">`:matIcon(i.id)}<strong>${safe(i.name)}</strong><span>×${Number(i.quantity)}</span></article>`).join(''):'<p class="muted">該当する持ち物はありません。</p>';
  collectionCards($('#inventory-list'),items);

}
async function openInventory(from='hall'){
  inventoryReturn=from;
  const {items:serverItems,gifts:ownedGifts=[],cooked:ownedCooked=[]}=await api('/inventory');
  inventorySortItems=[...serverItems.filter(i=>i.kind==='clothing'&&i.quantity>0),...serverItems.filter(i=>materialById(i.id)).map(i=>({...i,source:materialById(i.id)?.source||'洞窟',description:materialById(i.id)?.description,image:materialById(i.id)?.image,kind:'material'})),...ownedGifts.map(g=>({...g,id:g.itemId,category:'プレゼント',source:g.npcName||'黄色い獣',kind:'gift',rarity:0})),...ownedCooked.map(d=>({...d,id:d.id,source:'料理',kind:'cooked',rarity:0}))]; // 所持素材と受取済み返礼品を統合
  const sourceSelect=$('#inventory-source');const selectedSource=sourceSelect.value;
  const forestReady=Boolean(forestState?.unlocked&&forestState?.seen&&forestState?.eligible);
  const sources=new Set(SOURCE_ORDER);
  if(!forestReady)sources.delete('森');if(!seaState?.unlocked||!seaState?.eligible)sources.delete('海');
  sourceSelect.replaceChildren(new Option('すべて','all'),...[...sources].map(source=>new Option(source,source)));
  sourceSelect.value=[...sourceSelect.options].some(o=>o.value===sourceLabel(selectedSource))?sourceLabel(selectedSource):'all';
  renderInventoryItems();
  show('inventory');
}
// v0.18.1: 赤色の獣も黄色い獣と同じ見せ方。APIやNPC別データは分離したまま。
let pyoroProfile=null,pyoroProfileTimer=null,pyoroLastLocation='';
// v0.18.3: 既存の表情画像を状態と会話の反応に合わせて表示。
// パスは GitHub の images/npc/pyoro/ 以下に配置済みの画像を使用。
const pyoroExpression=(n)=>{
 const st=n?.state||{};
 const mood=String(st.moodLabel||'');
 if(st.activity==='sleeping')return 'sleeping';
 if(st.fullExpression||Number(st.hunger)<=15||String(st.hungerLabel||'').includes('満腹'))return 'full stomach';
 if(st.activity==='resting'||Number(st.energy)<32)return 'sleepy';
 if(Number(st.hunger)>=85)return 'sad';
 if(mood.includes('不機嫌')||mood.includes('怒'))return 'angry';
 if(mood.includes('落ち')||mood.includes('悲')||mood.includes('元気がない'))return 'sad';
 if(mood.includes('ご機嫌')||mood.includes('嬉')||mood.includes('上機嫌'))return 'happy';
 return 'normal';
};
const pyoroImage=expression=>`images/npc/pyoro/${expression||'normal'}.webp`;
// v0.18.5.17: ホールの足元ラベルも黄色い獣と同じ状態に連動する。
const updatePyoroHallLabel=n=>{
 const label=$('#hall-pyoro-label');if(!label||!n)return;
 label.textContent=n.state?.activity==='sleeping'?'赤色の獣はおやすみ中':'赤色の獣に会う';
};
const paintPyoro=(id,n,override)=>{
 const img=$(id);if(!img)return;
 const exp=override||pyoroExpression(n);
 const target=encodeURI(pyoroImage(exp));
 if(img.getAttribute('src')!==target)img.src=target;
 img.onerror=()=>{img.onerror=null;if(exp!=='normal')img.src=pyoroImage('normal');};
};
const pyoroReplyExpression=(response)=>{
 const t=String(response||'');
 if(/ありがと|うれし|やった|すごい|おいし|好き|楽しい|いいな|へへ|わーい/.test(t))return 'happy';
 if(/こわ|怖|びっくり|おどろ|ひえ|ひっ/.test(t))return 'scary';
 if(/照れ|はずかし|恥ずかし|えへ/.test(t))return 'shy';
 if(/怒|むっ|ぷん|ふんっ|なんだよ/.test(t))return 'angry';
 if(/かなしい|悲し|さびし|寂し|しょんぼり/.test(t))return 'sad';
 if(/えっへん|すごいだろ|まかせろ/.test(t))return 'pride';
 return 'normal';
};
const pyoroStateScene=n=>{
 const state=n.state||{};
 if(state.location==='room'&&state.activity==='sleeping')return '赤色の獣は自室のベッドですやすや眠っている。';
 if(state.location==='room')return state.furnitureAction?'赤色の獣は'+state.activityLabel+'。':'赤色の獣は自室でのんびり過ごしている。';
 if(state.activity==='sleeping')return '赤色の獣はホールの片隅で小さく丸まり、すうすうと眠っている。時おり耳がぴくりと動く。';
 if(state.hunger>75)return '赤色の獣はおなかを押さえ、こちらの様子をちらちらうかがっている。……どうやら、おなかが空いたらしい。';
 if(state.fullExpression||Number(state.hunger)<=15)return '赤色の獣は満足そうにおなかを撫で、しっぽをゆっくり揺らしている。おいしいごはんを食べて、ご機嫌らしい。';
 if(state.activity==='resting')return '赤色の獣はホールのソファで、少し警戒しながらもゆっくり休んでいる。';
 if(state.energy<40)return '赤色の獣は少し疲れているようで、ホールの隅に座って静かにあくびをしている。';
 if(state.mood<35)return '赤色の獣は耳を伏せ、足元をじっと見つめている。少し落ち着かない様子だ。';
 return '赤色の獣はホールのあちこちを興味深そうに見て回っている。こちらに気づくと、少しだけ目をそらした。';
};
const paintPyoroProfile=(n,moved=false)=>{
 if(!n)return;
 pyoroProfile=n;
 $('#pyoro-name').textContent='赤色の獣';
 $('#pyoro-hearts').textContent='♥'.repeat(n.affinity)+'♡'.repeat(10-n.affinity);
 $('#pyoro-relationship').textContent=`あなたとの関係：${n.relationship}`;
 $('#pyoro-relationship-detail').textContent=n.relationship;renderFurnitureSkills('pyoro-skills',n);
 $('#pyoro-description').textContent=n.description||'';
 $('#pyoro-personality').textContent=n.personality||'';
 $('#pyoro-memory').classList.toggle('hidden',!n.isFinder);
 const st=n.state||{};
 $('#pyoro-live-state').innerHTML=`<div class="state-item"><span>現在地</span><strong>${safe(st.locationLabel||'ホール')}</strong></div><div class="state-item"><span>活動状態</span><strong>${safe(st.activityLabel||'')}</strong></div>`;
 $('#pyoro-life-status').innerHTML=['energy','hunger','mood'].map(k=>{
   const label={energy:'元気',hunger:'空腹',mood:'気分'}[k],key=k+'Label';
   return `<div class="life-item"><span>${label}</span><strong>${safe(st[key]||'確認中')}</strong></div>`;
 }).join('');
 $('#pyoro-scene').textContent=pyoroStateScene(n);
 paintPyoro('#pyoro-profile-image',n);
 paintPyoro('#hall-pyoro-actor img',n);
 updatePyoroHallLabel(n);
 const notice=$('#pyoro-move-notice');
 if(moved){notice.textContent=`赤色の獣は${st.locationLabel||'ホール'}へ移動しました。`;notice.classList.remove('hidden');}
 $('#pyoro-talk-open').disabled=st.activity==='sleeping'||st.location==='room';
 $('#pyoro-room-btn').classList.toggle('hidden',!n.roomLevel);
 $('#pyoro-room-btn').disabled=!n.roomLevel;
 $('#pyoro-talk-open').title=st.activity==='sleeping'?'赤色の獣は眠っています。':'';
 $('#pyoro-rest-btn').disabled=st.activity!=='awake';
 $('#pyoro-wake-btn').disabled=st.activity!=='sleeping'||n.affinity<3||st.location==='room';
};
async function openPyoro(){
 const {npc}=await api('/npcs/pyoro');
 pyoroLastLocation=npc.state.location;
 
 $('#pyoro-move-notice').classList.add('hidden');
 $('#pyoro-life-action-result').classList.add('hidden');
 $('#pyoro-profile-more').open=false;
 paintPyoroProfile(npc);
 $('#pyoro-talk-result').textContent='';$('#pyoro-feed-result').textContent='';
 // 交流の記録は独立ページで開いたときに取得する（旧要素は存在しない）。
 pyoroDiaryEntries=[];pyoroDiaryIndex=0;pyoroDiaryHasMore=false;
 show('pyoro');
 // v0.18.5.2: 会話・食事・お願い・贈り物・言葉帳は各ページで必要になったときだけ取得する。
 if(pyoroProfileTimer)clearInterval(pyoroProfileTimer);
 pyoroProfileTimer=setInterval(async()=>{
   if(document.hidden||activePage!=='pyoro')return;
   try{const {npc:updated}=await api('/npcs/pyoro');const moved=pyoroLastLocation!==updated.state.location;pyoroLastLocation=updated.state.location;paintPyoroProfile(updated,moved);}catch{}
 },15000);
}
bind('#pyoro-requests-open',async()=>{await loadPyoroRequests();show('pyoro-requests');});
bind('#pyoro-requests-back',openPyoro);
bind('#pyoro-feeding-open',async()=>{$('#pyoro-feed-result').classList.add('hidden');await loadPyoroFood();show('pyoro-feeding');});
bind('#pyoro-feeding-back',()=>show('pyoro-conversation'));
bind('#pyoro-words-open',async()=>{await loadPyoroWords();show('pyoro-words');});
bind('#pyoro-words-back',()=>show('pyoro-conversation'));
bind('#pyoro-word-history-open',async()=>{await loadPyoroWords();show('pyoro-word-history');});
bind('#pyoro-word-history-back',()=>show('pyoro-words'));
bind('#pyoro-diary-open',async()=>{await loadPyoroDiary(true);show('pyoro-diary');});
bind('#pyoro-diary-back',openPyoro);
bind('#pyoro-gifts-open',()=>openNpcGifts('pyoro'));
bind('#pyoro-gifts-back',openPyoro);
const updatePyoroConversationBackground=npc=>{
 const background=$('#pyoro-conversation-background');
 applyImageFallback(background,npc.state.location==='room'?[privateRoomImage('pyoro',Number(npc.roomLevel||roomLevels.pyoro||1))]:hallBackgroundFiles(hallBackgroundName()),'pyoroConversationBackground');
};
// Refresh scene text and background from the same server snapshot.
let conversationSceneRefreshBusy=false;
async function refreshConversationScene(npcId){
 if(conversationSceneRefreshBusy)return;
 const page=npcId==='paper'?'conversation':'pyoro-conversation';
 const before=npcId==='paper'?currentNpc:pyoroProfile;
 conversationSceneRefreshBusy=true;
 try{
  const {npc}=await api('/npcs/'+npcId);
  if(activePage!==page||(npcId==='paper'?currentNpc:pyoroProfile)!==before)return;
  if(npcId==='paper'){
   currentNpc=npc;updateConversationBackground();$('#conversation-scene').textContent=npc.scene;
   if(before?.state?.location!==npc.state.location||before?.state?.activity!==npc.state.activity)paintPaper('#conversation-paper-image',npc);
  }else{
   paintPyoroProfile(npc);updatePyoroConversationBackground(npc);$('#pyoro-conversation-scene').textContent=pyoroStateScene(npc);
   if(before?.state?.location!==npc.state.location||before?.state?.activity!==npc.state.activity)paintPyoro('#pyoro-conversation-image',npc);
  }
 }catch(e){console.warn('会話場面の更新に失敗しました',e);}finally{conversationSceneRefreshBusy=false;}
}
const openPyoroConversation=async()=>{
 const {npc}=await api('/npcs/pyoro');
 paintPyoroProfile(npc);
 updatePyoroConversationBackground(npc);
 paintPyoro('#pyoro-conversation-image',npc);
 $('#pyoro-conversation-scene').textContent=pyoroStateScene(npc);
 $('#pyoro-talk-result').textContent='「……なんだ？ オレに話があるのか？」';
 $('#pyoro-conversation-result').classList.add('hidden');
 await loadPyoroTalk();
 show('pyoro-conversation');
};
bind('#pyoro-talk-open',openPyoroConversation);
bind('#pyoro-room-btn',()=>openPrivateRoom('pyoro'));
bind('#pyoro-conversation-back',openPyoro);
bind('#pyoro-conversation-hall',openHall);
bind('#pyoro-history-shortcut',()=>openPyoroHistory('pyoro'));

for(const [id,action] of [['#pyoro-rest-btn','rest'],['#pyoro-wake-btn','wake']])bind(id,async()=>{
 const result=await api('/npcs/pyoro/life/action','POST',{action});paintPyoroProfile(result.npc);
 const el=$('#pyoro-life-action-result');el.textContent=result.message;el.classList.remove('hidden');
});
let pyoroBusy=false;
// v0.18.5.1: 表示を見出しに一本化。削除された #pyoro-ai-usage にはアクセスしない。
const paintPyoroTalkUsage=u=>{const title=$('#pyoro-ai-remaining');if(title)title.textContent=`自由に話しかける（${u.used}/${u.limit}回）`;};
const pyoroReply=r=>{ $('#pyoro-talk-result').textContent=r.response;paintPyoroProfile(r.npc);updatePyoroConversationBackground(r.npc);paintPyoro('#pyoro-conversation-image',r.npc,pyoroReplyExpression(r.response));$('#pyoro-conversation-scene').textContent=pyoroStateScene(r.npc);paintPyoroTalkUsage(r.usage);};
const pyoroAction=async(path,body)=>{if(pyoroBusy)return;pyoroBusy=true;try{const r=await api(path,'POST',body);pyoroReply(r);return r;}finally{pyoroBusy=false;}};
const loadPyoroTalk=async()=>{const data=await api('/npcs/pyoro/conversation/options');paintPyoroTalkUsage(data.usage);const list=$('#pyoro-talk-options');list.replaceChildren();for(const t of data.choices){const b=document.createElement('button');b.className='secondary';b.textContent=t.disabled?'挨拶する（この時間帯は挨拶済み）':t.label;b.disabled=!!t.disabled;b.onclick=handler(async()=>{const r=await pyoroAction('/npcs/pyoro/conversation',{choice:t.id});if(r)await loadPyoroTalk();});list.append(b);}};
$('#pyoro-ai-form').addEventListener('submit',handler(async e=>{e.preventDefault();const field=$('#pyoro-ai-message');const r=await pyoroAction('/npcs/pyoro/ai/chat',{message:field.value});if(r)field.value='';}));
// v0.18.5: 黄色い獣の呼び名入力と同じ操作。住人ごと・NPCごとにD1保存。
$('#pyoro-name-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();
 const button=$('#pyoro-name-send');button.disabled=true;
 try{
   const r=await api('/npcs/pyoro/ai/name','POST',{nickname:$('#pyoro-name-input').value});
   $('#pyoro-talk-result').textContent=r.response;
   $('#pyoro-name-input').value='';
   $('#pyoro-conversation-result').textContent='呼び名を教えました。';
   $('#pyoro-conversation-result').classList.remove('hidden');
   toast('赤色の獣に呼び名を教えました。');
 }finally{button.disabled=false;}
}));
bind('#pyoro-conversation-close',openPyoro);
// v0.18.5.2: 黄色い獣と同様の独立会話履歴。最新20件ずつを表示。
let pyoroHistoryReturn='pyoro-conversation',pyoroHistoryRecords=[];
const switchPyoroHistoryTab=(ai)=>{
 for(const [kind,active] of [['ai',ai],['choice',!ai]]){
  const button=$('#pyoro-history-tab-'+kind);
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  $('#pyoro-history-'+kind+'-panel').classList.toggle('hidden',!active);
 }
};
const renderPyoroHistory=()=>{
 for(const kind of ['ai','choice']){
  const list=$('#pyoro-history-'+kind+'-list');list.replaceChildren();
  const records=pyoroHistoryRecords.filter(r=>kind==='ai'?r.kind==='ai':r.kind!=='ai').slice(0,20);
  for(const record of records){
   const item=document.createElement('article');item.className='history-entry';
   const time=document.createElement('time');time.textContent=jstDate(record.created_at);
   const message=document.createElement('p');message.textContent=record.message||'';
   const answer=document.createElement('p');answer.textContent='赤色の獣：'+(record.response||'');
   item.append(time,message,answer);list.append(item);
  }
  if(!records.length)list.textContent='まだ会話の記録はありません。';
 }
};
const openPyoroHistory=async(origin='pyoro-conversation')=>{
 pyoroHistoryReturn=origin;
 $('#pyoro-history-back').textContent=origin==='pyoro'?'← プロフィールへ':'← お話に戻る';
 switchPyoroHistoryTab(true);
 show('pyoro-history');
 $('#pyoro-history-ai-list').textContent='読み込み中…';
 $('#pyoro-history-choice-list').textContent='読み込み中…';
 try{
  const data=await api('/npcs/pyoro/history');
  pyoroHistoryRecords=Array.isArray(data.history)?data.history:[];
  renderPyoroHistory();
 }catch(error){
  $('#pyoro-history-ai-list').textContent='履歴を読み込めませんでした。 '+error.message;
  $('#pyoro-history-choice-list').textContent='履歴を読み込めませんでした。';
 }
};
bind('#pyoro-history-open',()=>openPyoroHistory('pyoro-conversation'));
bind('#pyoro-history-back',()=>pyoroHistoryReturn==='pyoro'?show('pyoro'):show('pyoro-conversation'));
bind('#pyoro-history-tab-ai',()=>switchPyoroHistoryTab(true));
bind('#pyoro-history-tab-choice',()=>switchPyoroHistoryTab(false));
// v0.18.5.20: 食事カードを黄色い獣と統一。料理は同じ食事画面へ合流。
let pyoroFeedingBusy=false;
const pyoroFoodKind=(kind)=>kind==='cooking'?'#pyoro-feed-cooking':kind==='meal'?'#pyoro-feed-meals':'#pyoro-feed-snacks';

// v0.18.5.20 食事候補を「料理・おやつ・素材」に切り替える共通タブ。
for(const npc of ['npc','pyoro']){
  const page=document.getElementById(npc+'-feeding-page');
  if(!page)continue;
  page.querySelectorAll('.npc-food-tab').forEach(button=>button.addEventListener('click',()=>{
    const selected=button.dataset.foodCategory;
    page.querySelectorAll('.npc-food-tab').forEach(tab=>{const active=tab.dataset.foodCategory===selected;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
    page.querySelectorAll('.npc-food-panel').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.foodPanel!==npc+'-'+selected));
  }));
}
const renderPyoroFood=(data,message='')=>{
 const n=data.npc;paintPyoroProfile(n);
 paintPyoro('#pyoro-feeding-image',n,data.expression);
 $('#pyoro-feeding-condition').textContent=n?.state?.hungerLabel||'確認中';
 $('#pyoro-feeding-activity').textContent=`いまいる場所：${n?.state?.locationLabel||'ホール'}・${n?.state?.activityLabel||''}`;
 const result=$('#pyoro-feed-result');result.textContent=message;result.classList.toggle('hidden',!message);
 for(const kind of ['cooking','snack','meal']){
  const list=$(pyoroFoodKind(kind));list.replaceChildren();
  const items=(data.items||[]).filter(x=>kind==='cooking'?!!x.cooked:!x.cooked&&x.kind===kind);
  if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent=kind==='cooking'?'あげられる料理をまだ持っていません。':kind==='meal'?'あげられる素材をまだ持っていません。':'あげられるおやつをまだ持っていません。';list.append(p);continue;}
  for(const item of items){
    const card=document.createElement('div');card.className='feeding-item';
    const thumb=document.createElement('div');
    if(item.cooked){const img=document.createElement('img');img.src=encodeURI(item.image||`images/cooking/${item.id}.webp`);img.alt='';img.loading='lazy';img.onerror=()=>img.remove();thumb.append(img);}
    else thumb.innerHTML=matIcon(item.id);
    card.append(thumb);
    const info=document.createElement('div');info.className='feeding-item-info';
    const strong=document.createElement('strong');strong.textContent=item.name;info.append(strong);
    const small=document.createElement('p');small.className='muted tiny';small.textContent=`所持数 ×${item.quantity} ・ 満腹度 +${item.restore}`+(item.cooked?` ・ 腹持ち ${item.satietyMinutes}分`:'');info.append(small);card.append(info);
    const button=document.createElement('button');button.type='button';button.className='secondary small';button.textContent='1個あげる';button.disabled=pyoroFeedingBusy||!data.canFeed;
    button.addEventListener('click',handler(async()=>{
      if(pyoroFeedingBusy)return;pyoroFeedingBusy=true;
      document.querySelectorAll('#pyoro-feeding-page .feeding-item button').forEach(b=>b.disabled=true);
      try{
        if(item.cooked){const response=await api('/cooking/feed','POST',{npcId:'pyoro',recipeId:item.id});pyoroFeedingBusy=false;await loadPyoroFood(response.message);}
        else{const response=await api('/npcs/pyoro/feeding','POST',{itemId:item.id});pyoroFeedingBusy=false;await loadPyoroFood(response.message+(response.affinityChange?`（親密度 +${response.affinityChange}pt）`:''));}
      }catch(e){pyoroFeedingBusy=false;await loadPyoroFood().catch(()=>{});throw e;}finally{pyoroFeedingBusy=false;}
    }));card.append(button);list.append(card);
  }
 }
};
const loadPyoroFood=async(message='')=>{
 const data=await api('/npcs/pyoro/feeding');
 // 料理が未解放の住人には、食事素材だけを表示する。
 if(frontCookingUnlocked){
  try{const cooked=await api('/cooking/feed-options?npcId=pyoro');data.items.push(...(cooked.items||[]).map(x=>({...x,cooked:true})));}catch(e){console.warn('料理の食事候補を取得できませんでした',e);}
 }
 renderPyoroFood(data,message);
};

// v0.17.0.7: Requests/presents/words are separate for pyoro.
let pyoroGiftBusy=false;
const pyoroStatus=(id,message)=>{const el=$(id);el.textContent=message||'';el.classList.toggle('hidden',!message);};
const pyoroRequestCard=(title,description)=>{
  const box=document.createElement('article');box.className='request-card';
  const h=document.createElement('h3');h.textContent=title;box.append(h);
  if(description){const p=document.createElement('p');p.className='muted tiny';p.textContent=description;box.append(p);}
  return box;
};
// v0.18.5.10: 素材依頼・料理依頼を同じNPCお願い画面に表示する。
// 保存先は既存の各テーブルを維持し、共通の1日3件・同時3件枠はWorkerが判定する。
async function renderCookingRequestsInNpcPage(npcId,dailyExhausted=false){
 const prefix=npcId==='paper'?'paper':'pyoro';
 const active=$('#'+prefix+'-cooking-active'),offers=$('#'+prefix+'-cooking-offers'),history=$('#'+prefix+'-cooking-history');
 if(!active||!offers||!history)return;
 active.replaceChildren();offers.replaceChildren();history.replaceChildren();
 if(!frontCookingUnlocked)return;
 let d;
 try{const result=await api('/cooking/orders');d=result[npcId];if(!d)throw new Error('料理のお願いを確認できませんでした。');}
 catch(err){const note=document.createElement('p');note.className='muted tiny';note.textContent='料理のお願いを読み込めませんでした：'+err.message;offers.append(note);return;}
 const makeCard=(title,detail,image,owned)=>{
  const box=document.createElement('article');box.className='request-card';
  const h=document.createElement('h3');h.textContent='［料理］'+title;box.append(h);
  if(detail){const p=document.createElement('p');p.className='muted tiny';p.textContent=detail;box.append(p);}
  const line=document.createElement('div');line.className='material-inline muted tiny';
  if(image){const img=document.createElement('img');img.src=encodeURI(image);img.alt=title;img.loading='lazy';img.style.cssText='width:48px;height:48px;object-fit:contain';line.append(img);}
  const label=document.createElement('span');label.textContent=title+' ×1'+(owned==null?'':'（持ち物 '+owned+'）');line.append(label);box.append(line);
  return box;
 };
 const refreshRequests=async(message)=>{await renderNpcRequests(npcId,message);};
 const addButton=(box,label,style,action,confirmText)=>{
  const button=document.createElement('button');button.type='button';button.className=style;button.textContent=label;
  button.addEventListener('click',handler(async()=>{
   if(button.disabled||requestBusy)return;
   if(confirmText&&!confirm(confirmText))return;
   requestBusy=true;button.disabled=true;
   try{const result=await api('/cooking/orders/'+action.path,'POST',action.body);await refreshRequests(result.message||'お願いを更新したよ。');}
   finally{requestBusy=false;button.disabled=false;}
  }));box.append(button);
 };
 for(const req of d.active||[]){
  const box=makeCard(req.name,'必要な料理：'+req.name+' ×1',req.image,req.owned);
  const buttons=document.createElement('div');buttons.className='actions';
  addButton(buttons,'料理を渡す','primary small',{path:'resolve',body:{orderId:req.id,action:'complete'}});
  addButton(buttons,'取り消す','secondary small',{path:'resolve',body:{orderId:req.id,action:'cancel'}},'この料理のお願いを取り消しますか？');
  if(req.owned!=null&&req.owned<1)buttons.firstElementChild.disabled=true;
  box.append(buttons);active.append(box);
 }
 for(const offer of (dailyExhausted||d.acceptedToday>=d.dailyLimit?[]:(d.offers||[]))){
  const box=makeCard(offer.name,'完成した「'+offer.name+'」を1個渡すお願いです。',offer.image,offer.owned);
  const btn=document.createElement('button');btn.type='button';btn.className='secondary small';btn.textContent='このお願いを引き受ける';btn.disabled=!d.canAccept;
  btn.addEventListener('click',handler(async()=>{if(btn.disabled||requestBusy)return;requestBusy=true;btn.disabled=true;try{const r=await api('/cooking/orders/accept','POST',{npcId,recipeId:offer.recipeId});await refreshRequests(r.message||'引き受けたよ。');}finally{requestBusy=false;btn.disabled=false;}}));
  box.append(btn);offers.append(box);
 }
 for(const row of d.history||[]){const line=document.createElement('p');line.className='muted tiny';line.textContent='［料理］'+row.name+'：'+(row.status==='completed'?'完了':'取消');history.append(line);}
}
// v0.18.7.11: 赤色の獣も黄色い獣と同じお願い画面を使う。
async function loadPyoroRequests(message=''){return renderNpcRequests('pyoro',message);}
async function loadPyoroWords(){
 const data=await api('/npcs/pyoro/words');const list=$('#pyoro-word-list');list.replaceChildren();
 $('#pyoro-word-count').textContent=`（${data.words.length}こ）`;
 for(const w of data.words){
  const card=document.createElement('article');card.className='request-card';
  const title=document.createElement('strong');title.textContent=w.word;card.append(title);
  for(const line of [`意味：${w.meaning}`,`使うとき：${w.usage}`,`教わった回数：${w.lessons}回`]){
   const p=document.createElement('p');p.className='muted tiny';p.textContent=line;card.append(p);
  }
  const b=document.createElement('button');b.className='secondary small';b.type='button';b.textContent='この言葉を教え直す';
  b.onclick=()=>{$('#pyoro-word').value=w.word;$('#pyoro-meaning').value=w.meaning;$('#pyoro-usage').value=w.usage;show('pyoro-words');$('#pyoro-meaning').focus();};
  card.append(b);list.append(card);
 }
 if(!data.words.length)list.textContent='まだ覚えた言葉はありません。';
}
$('#pyoro-word-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();const button=e.currentTarget.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
 try{const r=await api('/npcs/pyoro/words/teach','POST',{word:$('#pyoro-word').value,meaning:$('#pyoro-meaning').value,usage:$('#pyoro-usage').value});pyoroStatus('#pyoro-word-message',r.message);e.currentTarget.reset();await loadPyoroWords();}
 finally{button.disabled=false;}
}));
let pyoroDiaryBefore='',pyoroDiaryLoading=false;
let pyoroDiaryEntries=[],pyoroDiaryIndex=0,pyoroDiaryHasMore=false;
// v0.18.5.20: 黄色い獣・赤色の獣共通の月別日記カレンダー。
const diaryCalendarMonths={paper:null,pyoro:null};
function paintDiaryCalendar(npc,entries,selectedIndex,hasMore,onSelect){
 const prefix=npc==='paper'?'paper':'pyoro';
 const grid=$('#'+prefix+'-calendar-grid');if(!grid)return;
 const latest=entries[0]?.day||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const display=diaryCalendarMonths[npc]||latest.slice(0,7);
 diaryCalendarMonths[npc]=display;
 const [year,month]=display.split('-').map(Number);
 $('#'+prefix+'-calendar-month').textContent=`${year}年 ${month}月`;
 grid.replaceChildren();
 for(const title of ['日','月','火','水','木','金','土']){const cell=document.createElement('span');cell.className='npc-calendar-weekday';cell.textContent=title;grid.append(cell);}
 const offset=new Date(Date.UTC(year,month-1,1)).getUTCDay();
 for(let i=0;i<offset;i++){const blank=document.createElement('span');grid.append(blank);}
 const last=new Date(Date.UTC(year,month,0)).getUTCDate();
 for(let d=1;d<=last;d++){
  const day=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const index=entries.findIndex(x=>x.day===day);
  const button=document.createElement('button');button.type='button';button.className='secondary small';button.textContent=d;
  if(index>=0){button.classList.add('has-entry');if(index===selectedIndex)button.classList.add('active');button.onclick=()=>onSelect(index);}
  else button.disabled=true;
  grid.append(button);
 }
 const more=$('#'+prefix+'-calendar-more');
 const earliest=entries.at(-1)?.day;
 more.classList.toggle('hidden',!hasMore||!!earliest&&display>=earliest.slice(0,7));
}
function shiftDiaryMonth(npc,delta){const month=diaryCalendarMonths[npc]||new Date().toISOString().slice(0,7);const [y,m]=month.split('-').map(Number);const next=new Date(Date.UTC(y,m-1+delta,1));diaryCalendarMonths[npc]=next.toISOString().slice(0,7);}
const paintPyoroDiary=()=>{
 const e=pyoroDiaryEntries[pyoroDiaryIndex];
 $('#pyoro-diary-empty').classList.toggle('hidden',!!e);
 $('#pyoro-diary-paper').classList.toggle('hidden',!e);
 $('#pyoro-diary-navigation').classList.toggle('hidden',!e);
 if(!e){paintDiaryCalendar('pyoro',pyoroDiaryEntries,pyoroDiaryIndex,pyoroDiaryHasMore,()=>{});return;}
 const [y,m,d]=e.day.split('-').map(Number),weekday='にち げつ か すい もく きん ど'.split(' ')[new Date(Date.UTC(y,m-1,d)).getUTCDay()];
 $('#pyoro-diary-date').textContent=`${y}ねん ${m}がつ${d}にち ${weekday}ようび`;
 $('#pyoro-diary-weather').textContent=e.weather==='clear'?'☀ はれ':'☁ くもり';
 $('#pyoro-diary-body').textContent=e.body;
 $('#pyoro-diary-prev').disabled=pyoroDiaryLoading||(pyoroDiaryIndex===pyoroDiaryEntries.length-1&&!pyoroDiaryHasMore);
 $('#pyoro-diary-latest').disabled=pyoroDiaryIndex===0;
 $('#pyoro-diary-next').disabled=pyoroDiaryIndex===0;
 paintDiaryCalendar('pyoro',pyoroDiaryEntries,pyoroDiaryIndex,pyoroDiaryHasMore,index=>{pyoroDiaryIndex=index;paintPyoroDiary();});
};
const loadPyoroDiary=async(reset=true)=>{
 if(pyoroDiaryLoading)return;
 pyoroDiaryLoading=true;
 try{
  const before=reset?'':pyoroDiaryEntries.at(-1)?.day;
  const path='/npcs/pyoro/diary'+(before?'?before='+encodeURIComponent(before):'');
  const {entries=[],hasMore=false}=await api(path);
  if(reset){pyoroDiaryEntries=entries;pyoroDiaryIndex=0;diaryCalendarMonths.pyoro=entries[0]?.day.slice(0,7)||null;}else pyoroDiaryEntries.push(...entries);
  pyoroDiaryHasMore=hasMore;
 }finally{pyoroDiaryLoading=false;paintPyoroDiary();}
};
bind('#pyoro-diary-prev',async()=>{
 if(pyoroDiaryLoading)return;
 if(pyoroDiaryIndex===pyoroDiaryEntries.length-1&&pyoroDiaryHasMore)await loadPyoroDiary(false);
 if(pyoroDiaryIndex<pyoroDiaryEntries.length-1)pyoroDiaryIndex++;
 paintPyoroDiary();
});
bind('#pyoro-diary-latest',()=>{pyoroDiaryIndex=0;diaryCalendarMonths.pyoro=pyoroDiaryEntries[0]?.day.slice(0,7)||null;paintPyoroDiary();});
bind('#pyoro-diary-next',()=>{pyoroDiaryIndex=Math.max(0,pyoroDiaryIndex-1);paintPyoroDiary();});
for(const [delta,part] of [[-1,'prev'],[1,'next']])bind('#pyoro-calendar-'+part,()=>{shiftDiaryMonth('pyoro',delta);paintPyoroDiary();});
bind('#pyoro-calendar-more',()=>loadPyoroDiary(false));
let pairMemoriesFrom='npc-diary';
const openPairMemories=async(npc)=>{
 pairMemoriesFrom=npc==='paper'?'npc-diary':'pyoro-diary';
 const paper=npc==='paper',list=$('#pair-memories-list');
 $('#pair-memories-heading').textContent=paper?'黄色い獣と赤色の獣の交流':'赤色の獣と黄色い獣の交流';
 $('#pair-memories-subtitle').textContent=paper?'黄色い獣の視点で振り返る出来事':'赤色の獣の視点で振り返る出来事';
 list.textContent='読み込み中……';show('pair-memories');
 try{
  const data=await api(paper?'/npcs/paper/interactions':'/npcs/pyoro/interactions');
  list.replaceChildren();
  for(const entry of data.interactions||[]){
   const scene=document.createElement('article');scene.className='scene';
   scene.textContent=[entry.day,entry.summary, paper?entry.paper_view:entry.pyoro_view].filter(Boolean).join('\n');
   list.append(scene);
  }
  if(!list.children.length)list.textContent='2匹の思い出はまだありません。';
 }catch(error){list.textContent=error.message||'交流を読み込めませんでした。';}
};
bind('#paper-interactions-open',()=>openPairMemories('paper'));
bind('#pyoro-interactions-open',()=>openPairMemories('pyoro'));
bind('#pair-memories-back',()=>show(pairMemoriesFrom));
bind('#pyoro-back',openHall);


async function openNpc(from='hall'){npcReturn=from;const {npc}=await api('/npcs/paper');currentNpc=npc;lastLocation=npc.state.location;profileScene=npc.scene;$('#life-action-result').classList.add('hidden');$('#npc-move-notice').classList.add('hidden');renderNpc(false);show('npc');profileTimer=setInterval(async()=>{if(document.hidden)return;try{const {npc:updated}=await api('/npcs/paper');const old=lastLocation;currentNpc=updated;lastLocation=updated.state.location;renderNpc(old!==updated.state.location);}catch{}},15000);}
function renderNpc(moved){const n=currentNpc;
  $('#npc-diary-section').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-after-rescue').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-life-actions').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-affinity').textContent='♥'.repeat(n.affinity)+'♡'.repeat(10-n.affinity);
  $('#npc-relationship').textContent=`あなたとの関係：${n.relationship}`;
  $('#npc-relationship-detail').textContent=n.relationship;renderFurnitureSkills('paper-skills',n);
  $('#npc-life-status').innerHTML=['energy','hunger','mood'].map((k)=>{const labels={energy:'元気',hunger:'空腹',mood:'気分'};const descriptions={energy:n.state.energyLabel,hunger:n.state.hungerLabel,mood:n.state.moodLabel};return `<div class="life-item"><span>${labels[k]}</span><strong>${safe(descriptions[k])}</strong></div>`;}).join('');
  $('#rest-btn').disabled=n.state.activity!=='awake';
  $('#wake-btn').disabled=n.state.activity!=='sleeping'||n.affinity<3||n.state.location==='room';
  $('#npc-live-state').innerHTML=`<div class="state-item"><span>現在地</span><strong>${safe(n.state.locationLabel)}</strong></div><div class="state-item"><span>活動状態</span><strong>${safe(n.state.activityLabel)}</strong></div>`;
  paintPaper('#npc-profile-image',n);
  $('#npc-scene').textContent=profileScene;
  $('#npc-bio').textContent=n.description;$('#npc-personality').textContent=n.personality;
  if(moved){$('#npc-move-notice').textContent=`黄色い獣は${n.state.locationLabel}へ移動しました。描写はプロフィールを開き直すと更新されます。` ;$('#npc-move-notice').classList.remove('hidden');}
  else if($('#npc-move-notice').classList.contains('hidden')) {} // 移動通知は開き直すまで残す
  $('#talk-btn').disabled=n.state.activity==='sleeping'||n.state.location==='room';
  $('#talk-btn').title=n.state.activity==='sleeping'?'黄色い獣は眠っています。':'';
  $('#room-btn').disabled=!n.roomLevel;
  $('#room-btn').classList.toggle('hidden',!n.roomLevel);
  $('#room-btn').title=n.roomLevel?'':'自室はまだありません。';
  $('#npc-back').textContent=npcReturn==='cave'?'← 洞窟に戻る':'← ホールに戻る';
}
const openConversation=async()=>{
  const {npc}=await api('/npcs/paper'); currentNpc=npc;
  updateConversationBackground();
  paintPaper('#conversation-paper-image',npc);
  $('#conversation-scene').textContent=npc.scene;
  $('#speech-line').textContent='「あっ、キミ！ なに おはなし する？」';
  $('#conversation-result').classList.add('hidden');
  const menu=await api('/npcs/paper/conversation/options');
  renderConversationChoices(menu.choices);
  $('#conversation-after-rescue').classList.toggle('hidden',!npc.diaryUnlocked);
  show('conversation');
  if(npc.diaryUnlocked){$('#npc-ai-send').disabled=true;$('#npc-ai-remaining').textContent='自由に話しかける（確認中）';refreshAiStatus().catch(()=>{ $('#npc-ai-remaining').textContent='自由に話しかける（確認できませんでした）'; });}
};
function renderConversationChoices(options){
  const box=$('#conversation-choices');box.replaceChildren();
  options.forEach(opt=>{
    const button=document.createElement('button');button.type='button';button.className='secondary';
    button.textContent=opt.disabled?'挨拶する（この時間帯は挨拶済み）':opt.label;
    button.disabled=!!opt.disabled;
    button.addEventListener('click',handler(async()=>{
      [...box.querySelectorAll('button')].forEach(b=>b.disabled=true);
      try{
        const data=await api('/npcs/paper/conversation','POST',{choice:opt.id});
        currentNpc=data.npc;updateConversationBackground();$('#conversation-scene').textContent=data.npc.scene;paintPaper('#conversation-paper-image',data.npc);
        $('#speech-line').textContent=data.response;
        // v0.18.5.21: 選択式会話の下に親密度の説明通知を出さない。
        // 会話の反応文と親密度の更新処理はそのまま維持する。
        $('#conversation-result').classList.add('hidden');
        renderConversationChoices(data.choices);
      }catch(err){
        try{const menu=await api('/npcs/paper/conversation/options');renderConversationChoices(menu.choices);}catch{}
        throw err;
      }
    }));box.append(button);
  });
}


// v0.12: AI自由会話は選択式会話と別枠。本文は本人だけの履歴として記録する。
let aiSending=false;
const showAiUsage=usage=>{
  $('#npc-ai-remaining').textContent=`自由に話しかける（${usage.used}/${usage.limit}回）`;
  const notice=$('#npc-ai-limit-notice');
  notice.textContent=usage.remaining<=0||usage.globalRemaining<=0?'今日はもうこれ以上難しいお話はできません。':'';
  notice.classList.toggle('hidden',!notice.textContent);
  const blocked=usage.remaining<=0||usage.globalRemaining<=0||currentNpc?.state?.activity==='sleeping';
  $('#npc-ai-send').disabled=aiSending||blocked;
};
const refreshAiStatus=async()=>{
  const data=await api('/npcs/paper/ai/status');showAiUsage(data.usage);
};
$('#npc-ai-form').addEventListener('submit',handler(async event=>{
  event.preventDefault();
  if(aiSending||$('#npc-ai-send').disabled)return;
  const message=$('#npc-ai-message').value.trim();
  if(!message){toast('話しかけたいことを書いてね。');return;}
  aiSending=true;$('#npc-ai-send').disabled=true;
  $('#npc-ai-result').classList.remove('hidden');
  $('#npc-ai-result').textContent='黄色い獣が おへんじを かんがえているよ…';
  let latestUsage=null;
  try{
    const result=await api('/npcs/paper/ai/chat','POST',{message});
    currentNpc=result.npc;
    updateConversationBackground();$('#conversation-scene').textContent=result.npc.scene;
    paintPaper('#conversation-paper-image',result.npc);
    $('#speech-line').textContent=result.response;
    $('#npc-ai-result').textContent='黄色い獣がお返事してくれたよ。';
    $('#npc-ai-message').value='';
    latestUsage=result.usage;
  }catch(error){
    $('#npc-ai-result').textContent=error.message||'AIとの通信がうまくいかなかったようです。';
    throw error;
  }finally{
    aiSending=false;
    if(latestUsage)showAiUsage(latestUsage);
    else try{await refreshAiStatus();}catch{$('#npc-ai-send').disabled=true;}
  }
}));
// 自由会話は最新20件を常時表示し、古い履歴のみ必要に応じて取得する。
let aiHistoryCursor=null, aiOlderLoading=false, aiHistoryGeneration=0;
const appendAiHistory=(list,entries)=>{
  for(const entry of entries){
    const block=document.createElement('article');block.className='history-entry';
    const t=document.createElement('time');t.textContent=`${jstDate(entry.createdAt)}`;
    const q=document.createElement('p');q.textContent=`あなた：${entry.message}`;
    const a=document.createElement('p');a.textContent=`黄色い獣：${entry.response}`;
    block.append(t,q,a);list.append(block);
  }
};
const renderAiHistory=async()=>{
  const generation=++aiHistoryGeneration;
  const list=$('#ai-history-list'), older=$('#ai-history-older');
  list.textContent='読み込み中…';older.open=false;older.classList.add('hidden');
  $('#ai-history-older-list').replaceChildren();$('#ai-history-more').classList.add('hidden');
  aiHistoryCursor=null;aiOlderLoading=false;
  try{
    const data=await api('/npcs/paper/ai/history?page=1');
    if(generation!==aiHistoryGeneration)return;
    if(!Array.isArray(data.history)||!Object.hasOwn(data,'nextCursor'))throw new Error('Workerの履歴APIを更新してください。');
    list.replaceChildren();
    if(!data.history.length){list.textContent='まだ自由会話の記録はありません。';return;}
    appendAiHistory(list,data.history);
    aiHistoryCursor=data.nextCursor;older.classList.toggle('hidden',!aiHistoryCursor);
    $('#ai-history-more').classList.toggle('hidden',!aiHistoryCursor);
  }catch(error){if(generation===aiHistoryGeneration)list.textContent='AI会話の履歴を読み込めませんでした。 '+error.message;}
};
const loadOlderAiHistory=async()=>{
  if(!aiHistoryCursor||aiOlderLoading)return;
  const generation=aiHistoryGeneration, list=$('#ai-history-older-list'), button=$('#ai-history-more');
  aiOlderLoading=true;button.disabled=true;button.textContent='読み込み中…';
  try{
    const data=await api('/npcs/paper/ai/history?page=1&before='+encodeURIComponent(aiHistoryCursor));
    if(generation!==aiHistoryGeneration)return;
    appendAiHistory(list,data.history);aiHistoryCursor=data.nextCursor;
    button.classList.toggle('hidden',!aiHistoryCursor);
  }catch(error){if(generation===aiHistoryGeneration)toast(error.message||'履歴を読み込めませんでした。');}
  finally{if(generation===aiHistoryGeneration){aiOlderLoading=false;button.disabled=false;button.textContent='さらに過去の履歴を読み込む';}}
};
$('#ai-history-older').addEventListener('toggle',()=>{if($('#ai-history-older').open&&!$('#ai-history-older-list').children.length)void loadOlderAiHistory();});
bind('#ai-history-more',loadOlderAiHistory);
const switchHistoryTab=(ai)=>{
  for(const [id,active] of [['ai',ai],['choice',!ai]]){
    const button=$('#history-tab-'+id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    $('#history-'+id+'-panel').classList.toggle('hidden',!active);
  }
};
bind('#history-tab-ai',()=>switchHistoryTab(true));
bind('#history-tab-choice',()=>switchHistoryTab(false));

// v0.11.3: 手渡した食べ物の判定・消費・空腹度更新はWorker/D1側で行う。
let feedingBusy=false;
// 食事画面への遷移元を保持し、会話の選択肢を残したまま戻る。
let feedingReturn='conversation';
const renderFeeding=(data,message='')=>{
  const npc=data.npc;
  $('#npc-feeding-hunger').textContent=npc.state.hungerLabel;
  $('#npc-feeding-location').textContent=`いまいる場所：${npc.state.locationLabel}・${npc.state.activityLabel}`;
  paintPaper('#npc-feeding-image',npc,data.expression);
  const result=$('#npc-feeding-result');result.classList.toggle('hidden',!message);result.textContent=message;
  for(const [kind,selector] of [['cooking','#npc-feeding-cooking'],['snack','#npc-feeding-snacks'],['meal','#npc-feeding-meals']]){
    const list=$(selector);list.replaceChildren();
    const items=data.items.filter(x=>kind==='cooking'?!!x.cooked:!x.cooked&&x.kind===kind);
    if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent=kind==='cooking'?'あげられる料理をまだ持っていません。':kind==='meal'?'あげられる素材をまだ持っていません。':'あげられるおやつをまだ持っていません。';list.append(p);continue;}
    for(const item of items){
      const card=document.createElement('div');card.className='feeding-item';
      const thumb=document.createElement('div');if(item.cooked){const img=document.createElement('img');img.src=encodeURI(item.image||`images/cooking/${item.id}.webp`);img.alt='';img.loading='lazy';img.onerror=()=>img.remove();thumb.append(img);}else thumb.innerHTML=matIcon(item.id);card.append(thumb);
      const info=document.createElement('div');info.className='feeding-item-info';
      const name=document.createElement('strong');name.textContent=item.name;info.append(name);
      const qty=document.createElement('p');qty.className='muted tiny';qty.textContent=`所持数 ×${item.quantity} ・ 満腹度 +${item.restore}`+(item.cooked?` ・ 腹持ち ${item.satietyMinutes}分`:'');info.append(qty);card.append(info);
      const button=document.createElement('button');button.type='button';button.className='secondary small';button.textContent='1個あげる';
      button.disabled=feedingBusy||!data.canFeed;
      button.addEventListener('click',handler(async()=>{
        if(feedingBusy)return;feedingBusy=true;
        document.querySelectorAll('#npc-feeding-page .feeding-item button').forEach(b=>b.disabled=true);
        try{
          const outcome=await api(item.cooked?'/cooking/feed':'/npcs/paper/feeding','POST',item.cooked?{npcId:'paper',recipeId:item.id}:{itemId:item.id});
          feedingBusy=false;
          const refreshed=await getPaperFeedingOptions();currentNpc=refreshed.npc;
          renderFeeding(refreshed,outcome.message);
        }catch(error){feedingBusy=false;const refreshed=await getPaperFeedingOptions();renderFeeding(refreshed);throw error;}
      }));card.append(button);list.append(card);
    }
  }
};
async function getPaperFeedingOptions(){const data=await api('/npcs/paper/feeding');if(frontCookingUnlocked){try{const cooked=await api('/cooking/feed-options?npcId=paper');data.items.push(...(cooked.items||[]).map(x=>({...x,cooked:true})));}catch(e){console.warn('料理の食事候補を取得できませんでした',e);}}return data;}
async function openNpcFeeding(){
  feedingReturn=document.querySelector('#conversation-page:not(.hidden)')?'conversation':'npc';
  const data=await getPaperFeedingOptions();
  renderFeeding(data);
  $('#npc-feeding-back').textContent=feedingReturn==='conversation'?'← お話に戻る':'← 黄色い獣のプロフィールへ';
  show('npc-feeding');
}

// v0.8: 共通受信箱。ホールからは全員分、プロフィールからは黄色い獣分を表示。
let giftBusy=false,giftReturn='hall',giftInventory=[];
const jstDate=text=>{if(!text)return '—';const raw=String(text).replace(' ','T');const date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)?raw:raw+'Z');return Number.isNaN(date.getTime())?'日時不明':new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date)+' JST';};
const giftDate=jstDate;
const giftCard=(title,desc)=>{const c=document.createElement('article');c.className='request-card';const strong=document.createElement('strong');strong.textContent=title;c.append(strong);if(desc){const p=document.createElement('p');p.className='muted tiny';p.textContent=desc;c.append(p);}return c;};
const giftEmpty=(target,text)=>{if(!target.children.length){const p=document.createElement('p');p.className='muted';p.textContent=text;target.append(p);}};
function addGiftRow(itemId){
 const box=$('#gift-send-rows');if(box.children.length>=10){toast('一度に送れるのは10種類までです。');return;}
 if(!giftInventory.length){toast('送れる素材をまだ持っていません。');return;}
 const row=document.createElement('div');row.className='gift-send-row';
 const sel=document.createElement('select');sel.className='gift-reply';sel.setAttribute('aria-label','贈る素材');
 for(const item of giftInventory){const opt=document.createElement('option');opt.value=item.id;opt.textContent=`${item.name}（所持 ${item.quantity}）`;sel.append(opt);}
 const qty=document.createElement('input');qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.setAttribute('aria-label','個数');
 const remove=document.createElement('button');remove.className='secondary small remove-gift-row';remove.type='button';remove.textContent='削除';remove.onclick=()=>row.remove();
 if(typeof itemId==='string')sel.value=itemId;
 row.append(sel,qty,remove);box.append(row);
}
$('#gift-add-row').addEventListener('click',addGiftRow);
$('#gift-send').addEventListener('click',handler(async()=>{
 if(giftBusy)return;
 const receiverId=$('#gift-receiver').value;
 const items=[...$('#gift-send-rows').children].map(row=>({itemId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value)}));
 if(!receiverId)throw new Error('贈る相手を選んでください。');
 if(!items.length)throw new Error('素材を一つ以上選んでください。');
 if(items.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<1))throw new Error('個数を確認してください。');
 if(new Set(items.map(x=>x.itemId)).size!==items.length)throw new Error('同じ素材は一行にまとめてください。');
 const counts=Object.fromEntries(giftInventory.map(x=>[x.id,x.quantity]));
 if(items.some(i=>i.quantity>counts[i.itemId]))throw new Error('所持数を超えて送ることはできません。');
 giftBusy=true;$('#gift-send').disabled=true;
 try{const result=await api('/gifts/send','POST',{receiverId,items,message:$('#gift-send-message').value});await openNpcGifts('hall',result.message);}finally{giftBusy=false;$('#gift-send').disabled=false;}
}));
let giftPickerTab='material';
function renderGiftPicker(){collectionTabBar('#gift-picker-tabs',collectionTabs,giftPickerTab,k=>{giftPickerTab=k;renderGiftPicker();});const q=$('#gift-picker-search').value.trim().toLowerCase();const root=$('#gift-picker-grid');root.replaceChildren();for(const item of giftInventory.filter(i=>collectionKind({...i,kind:i.kind||'material'})===giftPickerTab&&String(i.name).toLowerCase().includes(q))){const b=document.createElement('button');b.type='button';b.className='secondary';b.innerHTML=`${item.kind==='clothing'?`<img src="${safe(item.image)}" alt="" style="width:100%">`:matIcon(item.id)}<strong>${safe(item.name)}</strong><span>×${Number(item.quantity)}</span>`;b.onclick=()=>{const existing=[...$('#gift-send-rows').children].find(r=>r.querySelector('select').value===item.id);if(existing){existing.querySelector('input').focus();return;}addGiftRow(item.id);};root.append(b);}if(!root.children.length)root.textContent='贈ることができるアイテムはありません。';}
$('#gift-picker-search').addEventListener('input',renderGiftPicker);
function renderMailTabs(onlyNpc=false){const root=$('#mail-tabs');root.classList.toggle('hidden',onlyNpc);const common=$('#gifts-common-sections');const send=$('#mail-send-panel');const incoming=$('#resident-gifts-inbox');const received=$('#resident-gifts-history').closest('details');const receiving=onlyNpc||mailTab==='receive';$('#mail-npc-section').style.display=receiving?'':'none';incoming.style.display=receiving?'':'none';incoming.previousElementSibling.style.display=receiving?'':'none';received.style.display=receiving?'':'none';send.classList.toggle('hidden',receiving);if(!onlyNpc)collectionTabBar('#mail-tabs',[['receive','受信'],['send','住人へ贈る']],mailTab,k=>{mailTab=k;renderMailTabs();});}
async function openNpcGifts(from='hall',message=''){
 if(!message)mailTab='receive';
 giftReturn=from;
 const onlyNpc=from==='npc'||from==='pyoro';
 const data=await api(onlyNpc?`/npcs/${from==='pyoro'?'pyoro':'paper'}/gifts`:'/gifts');
 const npc=onlyNpc?data:data.npc;
 const red=onlyNpc?null:data.pyoro;
 const defaultSender=from==='pyoro'?'赤色の獣':'黄色い獣';
 const gifts={inbox:[...npc.inbox,...(red?.inbox||[])],history:[...npc.history,...(red?.history||[])],inventory:[...npc.inventory,...(red?.inventory||[])]};
 $('#mail-npc-section').classList.toggle('hidden',!onlyNpc&&!data.npcUnlocked&&!red);
 const inbox=$('#npc-gifts-inbox'),inventory=$('#npc-gifts-inventory'),history=$('#npc-gifts-history');
 const addGiftImage=(container,gift)=>{if(!gift.image)return;const img=document.createElement('img');img.className='npc-gift-image';img.alt=gift.name||'返礼品';img.loading='lazy';img.src=encodeURI(gift.image);img.onerror=()=>img.remove();container.insertBefore(img,container.firstChild);};
 const common=$('#gifts-common-sections');common.classList.toggle('hidden',onlyNpc);
 $('#gifts-heading').textContent=onlyNpc?'贈り物':'通信箱';
 $('#gifts-eyebrow').textContent=onlyNpc?(from==='pyoro'?'GIFTS FROM PYORO':'GIFTS FROM PAPER'):'YOUR MAILBOX';
 $('#npc-gift-section-heading').textContent='贈り物';
 $('#mail-npc-section .history-all-link').dataset.history=from==='pyoro'?'pyoro':from==='npc'?'npc':'all-npc';
 inbox.replaceChildren();inventory.replaceChildren();history.replaceChildren();
 const notification=$('#npc-gifts-message');notification.classList.toggle('hidden',!message);notification.textContent=message;
 for(const gift of gifts.inbox){
  const sender=gift.sender||defaultSender;const npcId=sender==='赤色の獣'?'pyoro':'paper';
  const card=giftCard(gift.ready?gift.name:`${sender}がお礼を準備中`,gift.ready?`贈り主：${sender}　・　受け取りできます`:`贈り主：${sender}　・　完成予定：${giftDate(gift.readyAt)}（日本時間）`);
  if(gift.ready){
   addGiftImage(card,gift);
   const desc=document.createElement('p');desc.textContent=gift.description;card.append(desc);
   const msg=document.createElement('p');msg.textContent=`${sender}「${gift.message}」`;card.append(msg);
   const sel=document.createElement('select');sel.className='gift-reply';sel.setAttribute('aria-label',`${sender}への返答`);
   for(const [id,label] of [['thanks','ありがとう！ 嬉しいよ！'],['effort','頑張って作ってくれたんだね']]){const opt=document.createElement('option');opt.value=id;opt.textContent=label;sel.append(opt);}
   const btn=document.createElement('button');btn.className='primary small';btn.textContent='返答して受け取る';
   btn.addEventListener('click',handler(async()=>{
    if(giftBusy)return;giftBusy=true;btn.disabled=true;
    try{const result=await api(`/npcs/${npcId}/gifts/claim`,'POST',{giftId:gift.id,replyChoice:sel.value});await openNpcGifts(giftReturn,`受け取りました：${result.gift.name}。${sender} ${result.reply}`);}finally{giftBusy=false;}
   }));card.append(sel,btn);
  }else{const note=document.createElement('p');note.className='muted';note.textContent=`${sender}が頑張って作っています。完成を待ってね。`;card.append(note);}
  inbox.append(card);
 }
 giftEmpty(inbox,'届いている贈り物はありません。');
 for(const item of gifts.inventory){const card=giftCard(`${item.name} ×${item.quantity}`,item.description);addGiftImage(card,item);inventory.append(card);}
 giftEmpty(inventory,'まだ記念品を受け取っていません。');
 for(const gift of [...gifts.history].sort((a,b)=>String(b.receivedAt||'').localeCompare(String(a.receivedAt||''))).slice(0,5)){
  const detail=document.createElement('details');detail.className='gift-history-entry';const title=document.createElement('summary');title.textContent=`${gift.name}｜${giftDate(gift.receivedAt)}`;detail.append(title);
  for(const str of [`説明：${gift.description}`,`贈り主：${gift.sender}`,`受け取った日：${giftDate(gift.receivedAt)}`,`メッセージ：${gift.message}`,`あなたの返答：${gift.replyChoice==='effort'?'頑張って作ってくれたんだね':gift.replyChoice==='thanks'?'ありがとう！ 嬉しいよ！':'記録なし'}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=str;detail.append(p);}
  history.append(detail);
 }
 giftEmpty(history,'まだ受け取り履歴はありません。');
 if(!onlyNpc){
  const incoming=$('#resident-gifts-inbox'),outgoing=$('#resident-gifts-outgoing'),received=$('#resident-gifts-history');
  incoming.replaceChildren();outgoing.replaceChildren();received.replaceChildren();$('#resident-gifts-pending').replaceChildren();
  let outCount=0,inCount=0;
  for(const g of [...data.transfers].sort((a,b)=>String(b.resolvedAt||b.createdAt||'').localeCompare(String(a.resolvedAt||a.createdAt||'')))){
   const summary=g.items.map(i=>`${i.name} ×${i.quantity}`).join('、');
   if(g.incoming&&g.status==='pending'){
    const card=giftCard(`${g.sender}からの贈り物`,summary);
    if(g.message){const d=document.createElement('details');const t=document.createElement('summary');t.textContent='メッセージを読む';d.append(t);const p=document.createElement('p');p.textContent=g.message;d.append(p);card.append(d);}
    const actions=document.createElement('div');actions.className='actions';
    for(const [action,label] of [['accept','受け取る'],['decline','辞退する']]){
     const btn=document.createElement('button');btn.className=action==='accept'?'primary small':'secondary small';btn.textContent=label;
     btn.addEventListener('click',handler(async()=>{if(giftBusy)return;giftBusy=true;btn.disabled=true;try{const result=await api('/gifts/resolve','POST',{giftId:g.id,action});await openNpcGifts('hall',result.message);}finally{giftBusy=false;}}));actions.append(btn);
    }card.append(actions);incoming.append(card);
   }
   if(!g.incoming&&g.status==='pending'){
    const pendingCard=giftCard(`${g.receiver}へ送信中（受取待ち）`,summary);
    if(g.message){const p=document.createElement('p');p.className='muted tiny';p.textContent=`添えたメッセージ：${g.message}`;pendingCard.append(p);}
    const btn=document.createElement('button');btn.className='secondary small';btn.textContent='送信を取り消す';btn.addEventListener('click',handler(async()=>{if(giftBusy)return;giftBusy=true;btn.disabled=true;try{const result=await api('/gifts/resolve','POST',{giftId:g.id,action:'cancel'});await openNpcGifts('hall',result.message);}finally{giftBusy=false;}}));pendingCard.append(btn);$('#resident-gifts-pending').append(pendingCard);
   }
   if(!g.incoming&&g.status!=='pending'&&outCount++<5){
    const label={pending:'受取待ち',accepted:'受取済み',declined:'辞退されました',cancelled:'取り消し'}[g.status]||g.status;
    const card=giftCard(`${g.receiver}へ贈った素材｜${label}`,summary);
    if(g.message){const p=document.createElement('p');p.className='muted tiny';p.textContent=`添えたメッセージ：${g.message}`;card.append(p);}
    outgoing.append(card);
   }
   if(g.incoming&&g.status==='accepted'&&inCount++<5){
    const card=document.createElement('details');card.className='gift-history-entry';
    const title=document.createElement('summary');title.textContent=`${summary}｜${giftDate(g.resolvedAt)}`;card.append(title);
    for(const str of [`贈り主：${g.sender}`,`受け取った日：${giftDate(g.resolvedAt)}`,`メッセージ：${g.message||'なし'}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=str;card.append(p);}
    received.append(card);
   }
  }
  giftEmpty(incoming,'住人から届いている贈り物はありません。');
  giftEmpty($('#resident-gifts-pending'),'送信中の贈り物はありません。');
  giftEmpty(outgoing,'送った贈り物はありません。');
  giftEmpty(received,'住人からの受け取り履歴はありません。');
  const recip=await api('/gifts/recipients');
  const select=$('#gift-receiver');select.replaceChildren();
  for(const r of recip.residents){const opt=document.createElement('option');opt.value=r.id;opt.textContent=r.name;select.append(opt);}
  if(!recip.residents.length){const opt=document.createElement('option');opt.value='';opt.textContent='ほかの住人がまだいません';select.append(opt);}
  giftInventory=(await api('/inventory')).items.filter(i=>i.quantity>0&&(i.kind==='clothing'||(materialById(i.id)&&materialById(i.id).transferable!==false)));
  $('#gift-send-rows').replaceChildren();$('#gift-send-message').value='';
  renderGiftPicker();
 }
 renderMailTabs(onlyNpc);
 show('npc-gifts');
}
bind('#open-gifts',()=>openNpcGifts('hall'));
bind('#open-npc-gifts',()=>openNpcGifts('npc'));
// v0.11.8.3: 通信箱の履歴詳細を同一タブ内の専用ページに表示。
// 認証トークンをURLに含めず、既存APIで全件をページ単位で取得する。
let giftHistoryLoadId=0;
async function openGiftHistoryPage(kind){
 const names={pyoro:'赤色の獣の贈り物の受け取り履歴','all-npc':'贈り物の受け取り履歴',npc:'贈り物の受け取り履歴',outgoing:'送った贈り物・取引履歴',incoming:'住人からの受け取り履歴'};
 if(!names[kind])return;
 const loadId=++giftHistoryLoadId;
 $('#gift-history-heading').textContent=names[kind];
 $('#gift-history-count').textContent='履歴を読み込み中…';
 const list=$('#gift-history-list');list.replaceChildren();
 show('gift-history');
 try{
  const records=[];let offset=0;
  while(true){
   const page=await api(`/gifts/history?type=${encodeURIComponent(kind)}&offset=${offset}`);
   if(loadId!==giftHistoryLoadId)return; // 別の画面へ戻った後は描画しない
   const batch=page.items||[];
   records.push(...batch);
   if(!page.hasMore||!batch.length)break;
   offset+=batch.length;
  }
  if(loadId!==giftHistoryLoadId)return;
  $('#gift-history-count').textContent=`${records.length}件の履歴`;
  if(!records.length){list.textContent='まだ履歴はありません。';return;}
  list.innerHTML=records.map((g)=>{
   if(['npc','pyoro','all-npc'].includes(kind))return `<article class="gift-history-full-entry"><strong>${safe(g.name)}</strong><p class="muted tiny">${safe(giftDate(g.receivedAt))} ｜ ${safe(g.sender||'黄色い獣')}</p><p>${safe(g.description||'')}</p><p>${safe(g.message||'')}</p></article>`;
   const text=(g.items||[]).map(i=>`${safe(i.name)} ×${Number(i.quantity)||0}`).join('、');
   const other=kind==='outgoing'?`相手：${safe(g.receiver)}`:`贈り主：${safe(g.sender)}`;
   const status={pending:'受取待ち',accepted:'受取済み',declined:'辞退されました',cancelled:'取り消し'}[g.status]||g.status;
   return `<article class="gift-history-full-entry"><strong>${text||'贈り物'}｜${safe(status)}</strong><p class="muted tiny">${other} ｜ ${safe(giftDate(g.resolvedAt||g.createdAt))}</p><p>${safe(g.message||'')}</p></article>`;
  }).join('');
 }catch(e){
  if(loadId!==giftHistoryLoadId)return;
  $('#gift-history-count').textContent='履歴を読み込めませんでした';
  list.textContent=e.message||'エラーが発生しました。';
 }
}
const backFromGiftHistory=()=>{giftHistoryLoadId++;show('npc-gifts');};
bind('#gift-history-back',backFromGiftHistory);
bind('#gift-history-bottom-back',backFromGiftHistory);
document.querySelectorAll('.history-all-link').forEach(btn=>btn.addEventListener('click',handler(()=>openGiftHistoryPage(btn.dataset.history))));
bind('#npc-gifts-back',async()=>{if(giftReturn==='npc')await openNpc(npcReturn);else if(giftReturn==='pyoro')await openPyoro();else await openHall();});
// v0.6 黄色い獣のお願い。表示情報はすべてサーバーから取得する。
let requestBusy=false;
// v0.18.7.11: 表示・納品操作を共有し、APIとNPCのセリフはそれぞれ維持する。
async function openNpcRequests(message=''){return renderNpcRequests('paper',message);}
async function renderNpcRequests(npcId,message=''){
  const isPaper=npcId==='paper',npcName=isPaper?'黄色い獣':'赤色の獣';
  const endpoint='/npcs/'+npcId+'/requests';
  const {requests}=await api(endpoint);
  const activeList=$(isPaper?'#npc-requests-active':'#pyoro-request-active');
  const availableList=$(isPaper?'#npc-requests-available':'#pyoro-request-offers');
  const historyList=$(isPaper?'#npc-requests-history':'#pyoro-request-history');
  const messageEl=$(isPaper?'#npc-requests-message':'#pyoro-request-message');
  activeList.replaceChildren();availableList.replaceChildren();historyList.replaceChildren();
  $(isPaper?'#npc-request-daily-status':'#pyoro-request-status').textContent=`今日の受注 ${requests.acceptedToday} / ${requests.dailyLimit} 件（あと ${requests.remainingToday} 件）`;
  $(isPaper?'#npc-request-daily-note':'#pyoro-request-daily-note').textContent=`日本時間 ${requests.day} の日替わり候補です。受注は1日3件まで。達成・キャンセルしても回数は戻りません。受注済みのお願いは翌日以降も続けられます。`;
  messageEl.textContent=message;messageEl.classList.toggle('hidden',!message);
  const dailyExhausted=requests.remainingToday<=0||requests.acceptedToday>=requests.dailyLimit;
  const candidates=dailyExhausted?[]:isPaper?[...requests.templates,...(requests.permanent||[])]:requests.offers;
  // 上限に達したら素材・常設・料理の候補欄全体を隠す。受注済みと履歴は残す。
  $('#'+npcId+'-request-offer-section').classList.toggle('hidden',dailyExhausted);
  $('#'+npcId+'-request-limit-note').classList.toggle('hidden',!dailyExhausted);
  const subHeading=(name,description)=>{const div=document.createElement('div');div.innerHTML=`<strong>${safe(name)}</strong><p class="muted tiny">${safe(description)}</p>`;return div;};
  for(const req of requests.active){
    const card=document.createElement('article');card.className='request-card';card.append(subHeading(req.title,'預けた素材は完了報告まで保管されます。'));
    const list=document.createElement('div');list.className='request-items';let ready=true;
    for(const item of req.items){
      if(item.remaining>0)ready=false;
      const row=document.createElement('div');row.className='request-item';
      const line=document.createElement('div');line.className='material-inline muted tiny';line.innerHTML=`${matIcon(item.id)}<span>${safe(item.name)}：${item.donated} / ${item.needed}（残り ${item.remaining}・持ち物 ${item.owned}）</span>`;
      row.append(line);
      if(item.remaining>0){
        const form=document.createElement('form');form.className='request-donate-form';
        const input=document.createElement('input');input.type='number';input.min='1';input.max=String(Math.min(item.remaining,item.owned));input.step='1';input.value=String(Math.min(5,item.remaining,item.owned)||1);input.setAttribute('aria-label',item.name+'の納品個数');
        const button=document.createElement('button');button.type='submit';button.className='secondary small';button.textContent='預ける';button.disabled=item.owned<1;
        appendDonationControls(form,input,button);
        form.addEventListener('submit',handler(async e=>{
          e.preventDefault();const quantity=Number(input.value);
          if(!Number.isSafeInteger(quantity)||quantity<1||quantity>item.remaining||quantity>item.owned)throw new Error('素材の個数を確認してください。');
          if(requestBusy)return;requestBusy=true;button.disabled=true;
          try{const data=await api(endpoint+'/donate','POST',{requestId:req.id,itemId:item.id,quantity});await renderNpcRequests(npcId,data.message);}finally{requestBusy=false;button.disabled=item.owned<1;}
        }));row.append(form);
      }
      list.append(row);
    }
    card.append(list);
    if(ready){const note=document.createElement('p');note.className='request-ready';note.textContent=`素材が揃ったよ！ ${npcName}本人に報告しよう。`;card.append(note);}
    const actions=document.createElement('div');actions.className='actions';
    const report=document.createElement('button');report.className='primary small';report.textContent=npcName+'に報告する';report.disabled=!ready;
    report.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;report.disabled=true;
      try{const data=await api(endpoint+'/resolve','POST',{requestId:req.id,action:'report'});await renderNpcRequests(npcId,data.message);}finally{requestBusy=false;report.disabled=!ready;}
    });
    const cancel=document.createElement('button');cancel.className='secondary small';cancel.textContent='お願いを取り消す';
    cancel.onclick=handler(async()=>{
      if(!confirm('このお願いを取り消しますか？ 預けた素材はすべて返却されます。'))return;
      if(requestBusy)return;requestBusy=true;cancel.disabled=true;
      try{const data=await api(endpoint+'/resolve','POST',{requestId:req.id,action:'cancel'});await renderNpcRequests(npcId,data.message);}finally{requestBusy=false;cancel.disabled=false;}
    });actions.append(report,cancel);card.append(actions);activeList.append(card);
  }
  if(!requests.active.length)activeList.innerHTML='<p class="muted">今、引き受けているお願いはありません。</p>';
  for(const t of candidates){
    const card=document.createElement('article');card.className='request-card';card.append(subHeading(`${t.mode==='permanent'?'［常設］':'［今日の候補］'}${t.items.some(i=>FOREST_MATERIALS.some(m=>m.id===i.id))?'［森］':''} ${t.title}`,t.description));
    const p=document.createElement('div');p.className='muted tiny';p.innerHTML='必要素材：'+t.items.map(i=>`<span class="material-found-item">${matIcon(i.id)}${safe(i.name)} ×${i.needed}</span>`).join('、');card.append(p);
    const button=document.createElement('button');button.className='secondary small';button.textContent='このお願いを引き受ける';button.disabled=!requests.canAccept;
    button.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;button.disabled=true;
      try{const data=await api(endpoint+'/accept','POST',{templateKey:t.key});await renderNpcRequests(npcId,data.message);}finally{requestBusy=false;button.disabled=!requests.canAccept;}
    });card.append(button);availableList.append(card);
  }
  if(!dailyExhausted&&!candidates.length)availableList.innerHTML='<p class="muted">今日の素材のお願いはありません。</p>';
  if(!dailyExhausted&&!requests.canAccept){const p=document.createElement('p');p.className='muted tiny';p.textContent='今日の受注上限、または同時受注3件の上限に達しています。';availableList.prepend(p);}
  for(const r of requests.history){const p=document.createElement('div');p.className='request-history-entry';p.textContent=`${r.title} — ${r.status==='completed'?'完了':'取り消し'}${(r.resolvedAt||r.createdAt||r.completedAt)?'（'+jstDate(r.resolvedAt||r.completedAt||r.createdAt)+'）':''}${r.affinityGain?'（親密度 +'+r.affinityGain+'pt）':''}`;historyList.append(p);}
  if(!requests.history.length)historyList.textContent='まだ履歴はありません。';
  await renderCookingRequestsInNpcPage(npcId,dailyExhausted);
  // 料理の受注済みがあれば、素材が空でも『お願いなし』と表示しない。
  if(!requests.active.length&&$('#'+npcId+'-cooking-active').children.length)activeList.replaceChildren();
  if(!requests.history.length&&$('#'+npcId+'-cooking-history').children.length)historyList.replaceChildren();
  show(isPaper?'npc-requests':'pyoro-requests');
}

// v0.11 言葉帳。全住人が共有する言葉だけを表示し、個別の関係履歴とは分けて保存。
let teachingWord=false;
const renderWordBook=(data)=>{
  $('#word-count').textContent=`（${data.total}こ）`;
  const list=$('#npc-words-list');list.replaceChildren();const olderList=$('#npc-words-list-older');olderList.replaceChildren();$('#word-learned-older').open=false;$('#word-learned-older').classList.toggle('hidden',data.words.length<=50);
  if(!data.words.length){const p=document.createElement('p');p.className='muted';p.textContent='まだおぼえた言葉はありません。最初の言葉を教えてみよう！';list.append(p);}
  for(const [i,w] of data.words.slice(0,100).entries()){
    const card=document.createElement('article');card.className='request-card';
    const name=document.createElement('strong');name.textContent=w.word;card.append(name);
    for(const detail of [`意味：${w.meaning}`,`使うとき：${w.usage}`,`教わった回数：${w.lessons}回 ／ 教えてくれた住人：${w.teachers}人`,`理解度：${'★'.repeat(w.understanding)}${'☆'.repeat(3-w.understanding)}`]){
      const p=document.createElement('p');p.className='muted tiny';p.textContent=detail;card.append(p);
    }
    const b=document.createElement('button');b.className='secondary small';b.textContent='この言葉を教え直す';
    b.addEventListener('click',()=>{$('#teach-word').value=w.word;$('#teach-meaning').value=w.meaning;$('#teach-usage').value=w.usage;show('npc-words');$('#teach-meaning').focus();window.scrollTo({top:0,behavior:'smooth'});});
    card.append(b);(i<50?list:olderList).append(card);
  }
  const hist=$('#npc-words-history');hist.replaceChildren();const olderHist=$('#npc-words-history-older');olderHist.replaceChildren();$('#word-lessons-older').open=false;$('#word-lessons-older').classList.toggle('hidden',data.history.length<=50);
  if(!data.history.length){const p=document.createElement('p');p.className='muted';p.textContent='まだ学習履歴はありません。';hist.append(p);}
  for(const [i,entry] of data.history.slice(0,100).entries()){const card=document.createElement('article');card.className='request-card';
    const title=document.createElement('strong');title.textContent=`${entry.word} ／ ${entry.teacher}`;card.append(title);
    for(const value of [`意味：${entry.meaning}`,`使い方：${entry.usage}`,`記録：${jstDate(entry.createdAt)}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=value;card.append(p);}
    (i<50?hist:olderHist).append(card);
  }
};
async function openNpcWords(message=''){
  const notice=$('#npc-words-message');notice.textContent=message;notice.classList.toggle('hidden',!message);
  show('npc-words');
}
bind('#open-npc-words',()=>openNpcWords());
bind('#npc-words-back',async()=>{show('conversation');await refreshAiStatus();});
function switchWordTab(learned){
  for(const [key,on] of [['learned',learned],['lessons',!learned]]){
    $('#word-tab-'+key).classList.toggle('active',on);$('#word-tab-'+key).setAttribute('aria-pressed',String(on));$('#word-'+key+'-panel').classList.toggle('hidden',!on);
  }
}
bind('#word-tab-learned',()=>switchWordTab(true));
bind('#word-tab-lessons',()=>switchWordTab(false));
bind('#open-word-history',async()=>{const data=await api('/npcs/paper/words');renderWordBook(data);switchWordTab(true);show('word-history');});
bind('#word-history-back',()=>show('npc-words'));
$('#teach-word-form').addEventListener('submit',handler(async event=>{
  event.preventDefault();if(teachingWord)return;teachingWord=true;
  const btn=$('#teach-word-submit');btn.disabled=true;
  try{
    const body={word:$('#teach-word').value,meaning:$('#teach-meaning').value,usage:$('#teach-usage').value};
    const data=await api('/npcs/paper/words/teach','POST',body);
    $('#teach-word-form').reset();await openNpcWords(`黄色い獣：${data.reply}`);
  }finally{teachingWord=false;btn.disabled=false;}
}));

bind('#open-npc-feeding',openNpcFeeding);
bind('#npc-feeding-back',async()=>{
  if(feedingReturn==='conversation'){
    // 会話画面の選択肢と台詞を保持し、食後のNPC画像だけ更新する。
    try{const {npc}=await api('/npcs/paper');currentNpc=npc;updateConversationBackground();$('#conversation-scene').textContent=npc.scene;paintPaper('#conversation-paper-image',npc);}catch{}
    show('conversation');
  }else await openNpc(npcReturn);
});
// v0.13: 全住人共通の日記。古いページは20件ずつ追加取得。
let diaryEntries=[],diaryIndex=0,diaryMore=false,diaryBusy=false;
function renderDiary(){
 const entry=diaryEntries[diaryIndex];
 $('#diary-empty').classList.toggle('hidden',!!entry);$('#diary-paper').classList.toggle('hidden',!entry);$('#diary-navigation').classList.toggle('hidden',!entry);
 if(!entry){paintDiaryCalendar('paper',diaryEntries,diaryIndex,diaryMore,()=>{});return;}
 const [year,month,day]=entry.day.split('-').map(Number),weekday='にち げつ か すい もく きん ど'.split(' ')[new Date(Date.UTC(year,month-1,day)).getUTCDay()];
 $('#diary-date').textContent=`${year}ねん ${month}がつ${day}にち ${weekday}ようび`;
 $('#diary-weather').textContent=entry.weather==='clear'?'☀ はれ':'☁ くもり';$('#diary-body').textContent=entry.body;
 $('#diary-prev').disabled=diaryBusy||diaryIndex>=diaryEntries.length-1&&!diaryMore;
 $('#diary-next').disabled=diaryIndex===0;$('#diary-latest').disabled=diaryIndex===0;
 paintDiaryCalendar('paper',diaryEntries,diaryIndex,diaryMore,index=>{diaryIndex=index;renderDiary();});
}
async function openDiary(){const result=await api('/npcs/paper/diary');diaryEntries=result.entries||[];diaryMore=!!result.hasMore;diaryIndex=0;diaryBusy=false;diaryCalendarMonths.paper=diaryEntries[0]?.day.slice(0,7)||null;renderDiary();show('npc-diary');}
bind('#open-npc-diary',openDiary);bind('#npc-diary-back',()=>openNpc(npcReturn));
bind('#diary-latest',()=>{diaryIndex=0;diaryCalendarMonths.paper=diaryEntries[0]?.day.slice(0,7)||null;renderDiary();});bind('#diary-next',()=>{diaryIndex=Math.max(0,diaryIndex-1);renderDiary();});
bind('#diary-prev',async()=>{if(diaryBusy)return;if(diaryIndex===diaryEntries.length-1&&diaryMore){diaryBusy=true;renderDiary();try{const r=await api('/npcs/paper/diary?before='+encodeURIComponent(diaryEntries.at(-1).day));diaryEntries.push(...r.entries);diaryMore=!!r.hasMore;}finally{diaryBusy=false;renderDiary();}}if(diaryIndex<diaryEntries.length-1)diaryIndex++;renderDiary();});

for(const [delta,part] of [[-1,'prev'],[1,'next']])bind('#paper-calendar-'+part,()=>{shiftDiaryMonth('paper',delta);renderDiary();});
bind('#paper-calendar-more',async()=>{if(diaryBusy||!diaryMore)return;diaryBusy=true;try{const r=await api('/npcs/paper/diary?before='+encodeURIComponent(diaryEntries.at(-1)?.day||''));diaryEntries.push(...(r.entries||[]));diaryMore=!!r.hasMore;}finally{diaryBusy=false;renderDiary();}});
bind('#open-npc-requests',()=>openNpcRequests());
bind('#npc-requests-back',()=>openNpc(npcReturn));

bind('#hall-paper-actor',()=>openNpc('hall'));
// 左端の茶色い扉をクリック・タップして洞窟へ移動。
// 扉の連打による重複GETを防ぐ。画像の外にもタップ可能な入口を置く。
let hallDoorBusy=false;
const enterHallCave=async()=>{if(hallDoorBusy)return;hallDoorBusy=true;const buttons=['#hall-cave-door','[data-door="cave"]'].map(x=>$(x)).filter(Boolean);buttons.forEach(b=>b.disabled=true);try{await openCave();}finally{hallDoorBusy=false;buttons.forEach(b=>b.disabled=false);}};
bind('#hall-cave-door',enterHallCave);
bind('#hall-forest-door',openForest);
bind('#forest-back',openHall);
let forestAreaId=1,forestGathering=false;
function showForestArea(id){
 const area=FOREST_AREAS.find(a=>a.id===id);if(!area)return;
 forestAreaId=id;$('#forest-area-title').textContent=area.name;$('#forest-area-img').src=area.image;$('#forest-area-desc').textContent=area.description;$('#forest-result').textContent='';
 // 洞窟と同じ区画ナビ。採取中は区画変更を無効化する。
 const navigation=$('#forest-sections');navigation.replaceChildren();
 for(const section of FOREST_AREAS){
   const btn=document.createElement('button');btn.type='button';btn.className='secondary small'+(section.id===id?' selected':'');
   btn.textContent=section.name;btn.setAttribute('aria-pressed',String(section.id===id));btn.disabled=forestGathering;
   btn.addEventListener('click',handler(()=>{if(!forestGathering&&section.id!==forestAreaId)showForestArea(section.id);}));navigation.append(btn);
 }
 const list=$('#forest-spots');list.replaceChildren();
 for(const spot of area.spots){const b=document.createElement('button');b.className='secondary';b.textContent=spot.name;b.disabled=forestGathering;b.addEventListener('click',handler(async()=>{
 if(forestGathering)return;forestGathering=true;list.querySelectorAll('button').forEach(x=>x.disabled=true);$('#forest-sections').querySelectorAll('button').forEach(x=>x.disabled=true);
 try{const r=await api('/forest/gather','POST',{areaId:id,spotId:spot.id});if(activePage==='forest-area'&&forestAreaId===id){const found=(r.items||[]).map(item=>`<span class="material-found-item">${matIcon(item.id)}<strong>${safe(item.name)} ×${Number(item.quantity)}</strong></span>`).join('、');$('#forest-result').innerHTML=`<div>${safe(r.message)}</div>${found?`<div>入手：${found}</div>`:''}`;}}
 finally{forestGathering=false;$('#forest-spots').querySelectorAll('button').forEach(x=>x.disabled=false);$('#forest-sections').querySelectorAll('button').forEach(x=>x.disabled=false);}
 }));list.append(b);}show('forest-area');
}
for(const a of FOREST_AREAS)bind('#forest-area-'+a.id,()=>showForestArea(a.id));
bind('#forest-area-hall',openHall);bind('#forest-inventory',()=>openInventory('forest-area'));

const buildMemoryTitles={hall_lounge:'ホールの拡張を企てる二匹',hall_stairs:'階段をつけようとする二匹',paper_room:'自分のおへやがほしい黄色い獣',pyoro_room:'オレもおへやがほしい'};
async function openForestMemories(){
 const {forest}=await api('/forest/status');
 if(!(forest.unlocked&&forest.seen&&forest.eligible)){toast('まだ思い出はありません。');return;}
 const [e,build]=await Promise.all([api('/sea/events'),api('/build/lounge')]);
 const add=(list,label,action)=>{const b=document.createElement('button');b.className='secondary';b.textContent=label+' →';b.onclick=handler(action);list.append(b);};
 const sections=['sea','front','moon','build'];
 for(const name of sections)$('#'+name+'-memory-buttons').replaceChildren();
 const seaList=$('#sea-memory-buttons');
 for(const [kind,label,seen] of [['green','緑の扉の向こう側',e.greenSeen],[e.isFinder?'discover':'meet',e.isFinder?'海から釣れた、へんなもの':'赤色の獣との出会い',e.encounterSeen]])if(seen)add(seaList,label,()=>showSeaEvent(kind,e,true));
 if(e.frontSeen)add($('#front-memory-buttons'),'正面の扉の向こう側',()=>showFrontEvent(true));
 if(e.moonSeen)add($('#moon-memory-buttons'),'月の扉の向こう側',()=>showMoonEvent(true));
 for(const q of build.quests||[]){const title=buildMemoryTitles[q.id];if(!title)continue;
  if(q.completedAt||(q.startedAt&&build.questId===q.id&&build.seen))add($('#build-memory-buttons'),title,()=>showBuildEvent({questId:q.id,title},false,true));
 }
 for(const name of sections){const section=$('#'+name+'-memories');section.classList.toggle('hidden',!$('#'+name+'-memory-buttons').childElementCount);}
 // 思い出を開くたびに、公開済みの分類を展開する。
 $('#forest-memories-page').querySelectorAll('details').forEach(section=>{section.open=true;});
 show('forest-memories');
}
bind('#forest-memory',openForestMemories);
bind('#forest-memories-back',openHall);
bind('#forest-memory-cave',async()=>{await openCave();if(activePage==='cave'){$('#cave-history').closest('details').open=true;$('#cave-history').scrollIntoView({block:'nearest'});}});
bind('#forest-memory-replay',async()=>{const {forest}=await api('/forest/status');if(forest.unlocked&&forest.seen&&forest.eligible)showForestEvent(true);else toast('まだ思い出はありません。');});
bind('#forest-event-finish',async()=>{if(forestFinishing)return;forestFinishing=true;const btn=$('#forest-event-finish');btn.disabled=true;try{if(forestReplay){await openForestMemories();}else{await api('/forest/event','POST');await openHall();}}finally{forestFinishing=false;btn.disabled=false;}});
bind('#refresh-hall',openHall);
bind('#open-inventory',()=>openInventory('hall'));
bind('#open-material-catalog',openMaterialCatalog);
bind('#material-catalog-back',openHall);
bind('#cave-inventory-btn',()=>openInventory('cave'));
bind('#cave-refresh',()=>refreshCaveStatus(true));
bind('#cave-map-return',()=>openCave());
bind('#cave-npc-visit',()=>openNpc('cave'));
bind('#cave-story-back',async()=>{if(mandatoryStory)throw new Error('最初の物語を最後まで読んでね。');await openCave(selectedCaveSection);});
bind('#cave-story-done',()=>openCave(activeCaveStory==='rescue'?null:selectedCaveSection));
bind('#inventory-back',async()=>{if(inventoryReturn==='cave')await openCave(selectedCaveSection);else if(inventoryReturn==='sea')await window.KAGARISO_SEA.open();else if(inventoryReturn==='forest-area')showForestArea(forestAreaId);else await openHall();});
$('#inventory-sort').addEventListener('change',renderInventoryItems);
$('#inventory-search').addEventListener('input',renderInventoryItems);
$('#inventory-source').addEventListener('change',renderInventoryItems);
for(const [selector,action] of [['#rest-btn','rest'],['#wake-btn','wake']]){bind(selector,async()=>{const data=await api('/npcs/paper/life/action','POST',{action});currentNpc=data.npc;const last=lastLocation;lastLocation=data.npc.state.location;renderNpc(last!==lastLocation);$('#life-action-result').textContent=data.message;$('#life-action-result').classList.remove('hidden');});}
bind('#talk-btn',openConversation);
bind('#room-btn',enterRoom);
bind('#private-room-back',openHall);
async function enterRoom(){await openPrivateRoom('paper');}
bind('#room-talk',openConversation);
bind('#conversation-close',()=>openHall());
let conversationHistoryReturn='npc';
const openConversationHistory=async(origin)=>{
  conversationHistoryReturn=origin;
  $('#conversation-history-back').textContent=origin==='conversation'?'← お話に戻る':'← プロフィールへ';
  const aiUnlocked=!!currentNpc?.diaryUnlocked;
  $('#history-tab-ai').classList.toggle('hidden',!aiUnlocked);
  switchHistoryTab(aiUnlocked);
  const list=$('#history-list');
  list.textContent='読み込み中…';
  $('#ai-history-list').textContent='読み込み中…';
  show('history');
  await Promise.all([
    aiUnlocked?renderAiHistory():Promise.resolve(),
    (async()=>{try{
      const {history}=await api('/npcs/paper/history');
      list.innerHTML=history.length?history.slice(0,20).map(h=>`<article class="history-entry"><time>${jstDate(safe(h.created_at))}</time><p>${safe(h.response)}</p><span class="muted">${h.affinity_change?'少し親しくなった':''}</span></article>`).join(''):'<p class="muted">まだ会話の記録がありません。</p>';
    }catch(error){list.textContent='選択式の履歴を読み込めませんでした。';}})()
  ]);
};
bind('#npc-ai-history-open',()=>openConversationHistory('conversation'));
bind('#history-btn',()=>openConversationHistory('npc'));
bind('#conversation-history-back',async()=>{
  if(conversationHistoryReturn==='conversation'){show('conversation');if(currentNpc?.diaryUnlocked)await refreshAiStatus();}
  else await openNpc(npcReturn);
});
document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',handler(async()=>{const page=el.dataset.back;if(page==='hall'){if(el.id==='npc-back'&&npcReturn==='cave')await openCave(selectedCaveSection);else await openHall();}else if(page==='npc')await openNpc(npcReturn);})));

// 管理者セッションは住人セッションと混在させない。
const adminApi=async(path,method='GET',body,overrideToken=null)=>{
  const auth=overrideToken===null?adminToken:overrideToken;
  const response=await fetch(`${API}/api/admin${path}`,{method,headers:{...(auth?{'Authorization':`Bearer ${auth}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({error:'応答を読み取れませんでした。'}));
  if(!response.ok){
    if(response.status===401&&path!=='/login'){clearActivity();clearOverview();statsSeq++;statsData=null;$('#stats-content').replaceChildren();$('#stats-resident').replaceChildren(new Option('全住人',''));$('#stats-scope').textContent='';adminToken='';sessionStorage.removeItem(ADMIN_SESSION_KEY);show('admin-login');}
    throw new Error(data.error||'管理者の操作に失敗しました。');
  }
  return data;
};
const adminReturn=async()=>{clearAdminRecovery();if(token)await openHall();else show('auth');};
bind('#open-admin-login',async()=>{
  if(adminToken){try{await adminApi('/me');await openAdminEditor();return;}catch{}}
  show('admin-login');
});
bind('#admin-login-back',adminReturn);
bind('#admin-editor-back',adminReturn);
$('#admin-login-form').addEventListener('submit',handler(async e=>{
  e.preventDefault();const btn=$('#admin-login-submit');btn.disabled=true;
  try{
    const result=await adminApi('/login','POST',{loginId:$('#admin-login-id').value,password:$('#admin-login-password').value},'');
    adminToken=result.token;sessionStorage.setItem(ADMIN_SESSION_KEY,adminToken);
    $('#admin-login-form').reset();await openAdminEditor();
  }finally{btn.disabled=false;}
}));
$('#admin-setup-form').addEventListener('submit',handler(async e=>{
  e.preventDefault();const result=await adminApi('/bootstrap','POST',{
    setupKey:$('#admin-setup-key').value,loginId:$('#admin-setup-id').value,
    displayName:$('#admin-setup-name').value,password:$('#admin-setup-password').value
  },'');$('#admin-setup-form').reset();toast(result.message);
}));
bind('#admin-logout',async()=>{clearAdminRecovery();
  try{await adminApi('/logout','POST',{});}finally{adminToken='';clearActivity();clearOverview();statsSeq++;statsData=null;$('#stats-content').replaceChildren();$('#stats-resident').replaceChildren(new Option('全住人',''));$('#stats-scope').textContent='';$('#stats-from').value='';$('#stats-to').value='';statsSort.clear();questData=null;questPlan=[];questDirty=false;sessionStorage.removeItem(ADMIN_SESSION_KEY);show('admin-login');}
});
const adminConditionOptions=[['any','条件なし'],['hungry','空腹'],['not_hungry','空腹でない'],['full','満腹'],['sleepy','眠そう'],['resting','休憩中'],['awake','活動中'],['happy','ご機嫌'],['angry','不機嫌'],['sad','悲しい'],['hall','ホール'],['cave','洞窟'],['morning','朝'],['day','昼'],['night','夜'],['affinity3','♡3以上'],['affinity5','♡5以上'],['weather_verified','天気連動（未対応）']];
const adminCategoryOptions=[['daily','日常'],['food','食べ物'],['explore','探索'],['social','住人との交流'],['health','体調'],['weather','天気'],['chat','雑談'],['special','感情・特別'],['play','遊び'],['memory','思い出'],['personality','NPC固有'],['language','言葉'],['sleep','睡眠'],['mood','気分'],['location','場所'],['relationship','関係性']];
const makeSelectOptions=(entries,selected)=>entries.map(([value,label])=>`<option value="${safe(value)}" ${value===selected?'selected':''}>${safe(label)}</option>`).join('');
const blankAdminTopic=()=>({id:null,npcId:'paper',category:'daily',label:'',condition:'any',minAffinity:1,weight:1,enabled:true,revision:0,replies:[{when:'any',text:''}]});
const adminList=()=>{
  const q=$('#admin-topic-search').value.trim().toLowerCase();
  const filtered=adminTopicsCache.filter(t=>!q||`${t.label} ${t.category} ${t.id}`.toLowerCase().includes(q));
  $('#admin-topic-count').textContent=`${filtered.length}件 / 全${adminTopicsCache.length}件`;
  const box=$('#admin-topic-list');box.replaceChildren();
  for(const topic of filtered){
    const btn=document.createElement('button');btn.type='button';btn.className='secondary small admin-topic-button';
    btn.textContent=`${topic.enabled?'':'［無効］'}${topic.label}`;
    if(topic.id===adminSelected?.id)btn.classList.add('admin-selected');
    btn.addEventListener('click',()=>{adminSelected=structuredClone(topic);adminEditForm();adminList();});
    box.append(btn);
  }
};
const adminReplies=()=>{
  const list=$('#admin-replies');list.replaceChildren();
  adminSelected.replies.forEach((reply,index)=>{
    const item=document.createElement('div');item.className='admin-reply-row';
    const condition=document.createElement('select');condition.innerHTML=makeSelectOptions(adminConditionOptions,reply.when);
    condition.value=reply.when;condition.addEventListener('change',()=>{reply.when=condition.value;adminPreview();});
    const field=document.createElement('textarea');field.rows=2;field.maxLength=260;field.value=reply.text;
    field.addEventListener('input',()=>{reply.text=field.value;adminPreview();});
    const del=document.createElement('button');del.className='secondary small';del.type='button';del.textContent='この返答を削除';
    del.disabled=adminSelected.replies.length===1;
    del.addEventListener('click',()=>{adminSelected.replies.splice(index,1);adminReplies();adminPreview();});
    item.append(condition,field,del);list.append(item);
  });
};
const adminPreview=()=>{
  $('#admin-topic-preview').textContent=`住人：「${adminSelected.label||'（質問）'}」\n黄色い獣：「${adminSelected.replies[0]?.text||'（返答）'}」`;
};
const adminEditForm=()=>{
  const t=adminSelected||blankAdminTopic();adminSelected=t;
  $('#admin-topic-label').value=t.label;
  $('#admin-topic-category').value=t.category;
  $('#admin-topic-condition').value=t.condition;
  $('#admin-topic-affinity').value=t.minAffinity;
  $('#admin-topic-weight').value=t.weight;
  $('#admin-topic-enabled').checked=t.enabled;
  $('#admin-topic-id').textContent=t.id?`ID: ${t.id} ／ 改訂 ${t.revision}`:'新しい会話';
  adminReplies();adminPreview();
};
const appendDonationControls=(form,input,submit)=>{
 form.classList.add('rate-donation');const make=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='secondary small';b.textContent=label;b.disabled=Number(input.max)<1;b.onclick=()=>{input.value=String(Math.max(1,Math.min(Number(input.max),fn(Number(input.value)||1))));input.dispatchEvent(new Event('input',{bubbles:true}));};return b;};
 form.append(make('−10',v=>v-10),input,make('＋10',v=>v+10),make('最大',()=>Number(input.max)),submit);
};
const openAdminEditor=async()=>{
 $('#admin-clothing-panel').classList.add('hidden');
 clearAdminRecovery();$('#admin-recovery-panel').classList.add('hidden');
 $('#admin-sea-panel').classList.add('hidden');
 $('#admin-pyoro-panel').classList.add('hidden');
 $('#admin-stats-panel').classList.add('hidden');
 $('#admin-quest-panel').classList.add('hidden');
 $('#admin-material-panel').classList.add('hidden');
 $('#admin-ai-panel').classList.add('hidden');
 $('#admin-gifts-panel').classList.add('hidden');
 $('#admin-requests-panel').classList.add('hidden');
 $('#admin-conversations-panel').classList.remove('hidden');
  const me=await adminApi('/me');
  $('#admin-logged-name').textContent=me.admin.displayName;syncAdminNpc();
  const data=await adminApi('/topics?npc=paper');adminTopicsCache=data.topics||[];
  adminSelected=structuredClone(adminTopicsCache.find(t=>t.id===adminSelected?.id)||adminTopicsCache[0]||blankAdminTopic());
  adminEditForm();adminList();show('admin-editor');
  if($('#admin-npc-target').value==='pyoro')await pyoroAdminShow(pyoroAdminSection);
};
$('#admin-topic-search').addEventListener('input',adminList);
bind('#admin-topic-new',()=>{adminSelected=blankAdminTopic();adminEditForm();adminList();});
bind('#admin-topic-refresh',openAdminEditor);
bind('#admin-reply-add',()=>{
  if(adminSelected.replies.length>=8)throw new Error('返答は8種類までです。');
  adminSelected.replies.push({when:'any',text:''});adminReplies();adminPreview();
});
$('#admin-topic-edit-form').addEventListener('submit',handler(async e=>{
  e.preventDefault();const t=adminSelected;
  const payload={id:t.id||undefined,npcId:'paper',revision:t.revision,
    label:$('#admin-topic-label').value,category:$('#admin-topic-category').value,
    condition:$('#admin-topic-condition').value,minAffinity:Number($('#admin-topic-affinity').value),
    weight:Number($('#admin-topic-weight').value),enabled:$('#admin-topic-enabled').checked,
    replies:t.replies.map(x=>({when:x.when,text:x.text}))};
  const btn=$('#admin-save-topic');btn.disabled=true;
  try{
    const result=await adminApi('/topics/save','POST',payload);
    adminSelected=result.topic;
    const i=adminTopicsCache.findIndex(x=>x.id===result.topic.id);
    if(i>=0)adminTopicsCache[i]=result.topic;else adminTopicsCache.push(result.topic);
    adminTopicsCache.sort((a,b)=>a.id.localeCompare(b.id));
    adminEditForm();adminList();toast('会話を保存しました。');
  }finally{btn.disabled=false;}
}));
bind('#admin-show-history',async()=>{
  const {history}=await adminApi('/audit');
  const list=$('#admin-edit-history');list.replaceChildren();
  if(!history.length){list.textContent='まだ編集履歴がありません。';return;}
  history.forEach(x=>{
    const p=document.createElement('p');p.className='muted tiny';
    p.textContent=`${jstDate(x.at)} ／ ${x.admin} ／ ${x.action} ／ ${x.label||x.id}`;list.append(p);
  });
});


// v0.11.6 管理者専用「お願いエディター」。管理者ログインをそのまま利用。
const ADMIN_MATERIALS=[
  ['C026','廃木材'],['C002','金属スクラップ'],['C008','洞窟キノコ'],['C001','ごつごつした石'],['C003','湿った粘土'],['C004','赤錆鉱石'],['C005','青白い水晶'],['C006','呼吸する石'],
  ['C009','岩陰の豆'],['C010','白い根菜'],['C011','鈴鳴り苔'],['C012','眠り茸'],['C013','逆さに咲く花'],['C014','洞窟鳥の卵'],['C015','洞窟鳥の羽根'],['C016','抜け落ちた牙'],['C017','脱皮した透明な皮'],['C018','洞窟獣の柔らかな毛'],['C021','岩蜜'],['C022','甘い地底果汁'],['C020','夜光の雫'],['C025','折れた木の棒'],['C027','丈夫な地下蔓'],['C028','色褪せた布'],['C029','しなやかな根木'],['C023','光る石'],['C019','誰のものでもない卵'],['C024','いつまでも冷たい水']
];
for(const m of MATERIALS)if(m.transferable!==false&&!ADMIN_MATERIALS.some(x=>x[0]===m.id))ADMIN_MATERIALS.push([m.id,m.name]);
const blankAdminRequest=()=>({key:null,npcId:'paper',title:'',description:'',acceptText:'えへへ！ ありがとぉ！',completeText:'やったぁ！ ありがとぉ！',difficulty:2,minSection:1,mode:'daily',giftKind:'food',enabled:true,revision:0,items:[{id:'C008',needed:3}]});
const adminRequestListRender=()=>{
  const q=$('#admin-request-search').value.trim().toLowerCase();
  const filtered=adminRequestsCache.filter(r=>!q||`${r.title} ${r.key}`.toLowerCase().includes(q));
  $('#admin-request-count').textContent=`${filtered.length} / ${adminRequestsCache.length}件`;
  const list=$('#admin-request-list');list.replaceChildren();
  for(const r of filtered){
    const b=document.createElement('button');b.type='button';b.className='secondary small admin-topic-button';
    b.textContent=`${r.enabled?'':'［無効］'}${r.mode==='permanent'?'［常設］':''}★${r.difficulty} ${r.title}`;
    if(r.key===adminRequestSelected?.key)b.classList.add('admin-selected');
    b.onclick=()=>{adminRequestSelected=structuredClone(r);adminRequestForm();adminRequestListRender();};list.append(b);
  }
};
const adminRequestItems=()=>{
  const list=$('#admin-request-items');list.replaceChildren();
  adminRequestSelected.items.forEach((item,i)=>{
    const div=document.createElement('div');div.className='admin-request-item-row';
    const sel=document.createElement('select');sel.innerHTML=makeSelectOptions(ADMIN_MATERIALS,item.id);sel.value=item.id;
    sel.onchange=()=>{item.id=sel.value;};
    const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max='30';qty.value=item.needed;
    qty.onchange=()=>{item.needed=Number(qty.value);};
    const del=document.createElement('button');del.type='button';del.className='secondary small';del.textContent='削除';del.disabled=adminRequestSelected.items.length<=1;
    del.onclick=()=>{adminRequestSelected.items.splice(i,1);adminRequestItems();};
    div.append(sel,qty,del);list.append(div);
  });
};
const adminRequestForm=()=>{
  const r=adminRequestSelected||blankAdminRequest();adminRequestSelected=r;
  $('#admin-request-title').value=r.title;$('#admin-request-description').value=r.description;
  $('#admin-request-accept').value=r.acceptText;$('#admin-request-complete').value=r.completeText;
  $('#admin-request-difficulty').value=r.difficulty;$('#admin-request-section').value=r.minSection;
  $('#admin-request-mode').value=r.mode;$('#admin-request-gift').value=r.giftKind;
  $('#admin-request-enabled').checked=r.enabled;
  $('#admin-request-id').textContent=r.key?`ID ${r.key} ／ 改訂 ${r.revision}`:'新しいお願い';
  adminRequestItems();
};
const loadAdminRequestEditor=async()=>{
  const result=await adminApi('/requests?npc=paper');adminRequestsCache=result.requests||[];
  adminRequestSelected=structuredClone(adminRequestsCache.find(x=>x.key===adminRequestSelected?.key)||adminRequestsCache[0]||blankAdminRequest());
  adminRequestForm();adminRequestListRender();
};
bind('#admin-show-request-editor',async()=>{
 $('#admin-stats-panel').classList.add('hidden');
 $('#admin-quest-panel').classList.add('hidden');
 $('#admin-material-panel').classList.add('hidden');
 $('#admin-ai-panel').classList.add('hidden');
  $('#admin-gifts-panel').classList.add('hidden');$('#admin-requests-panel').classList.remove('hidden');$('#admin-conversations-panel').classList.add('hidden');
  await loadAdminRequestEditor();
});
bind('#admin-show-dialogue-editor',()=>{
 $('#admin-stats-panel').classList.add('hidden');
 $('#admin-quest-panel').classList.add('hidden');
 $('#admin-material-panel').classList.add('hidden');
 $('#admin-ai-panel').classList.add('hidden');
  $('#admin-gifts-panel').classList.add('hidden');$('#admin-requests-panel').classList.add('hidden');$('#admin-conversations-panel').classList.remove('hidden');
});
$('#admin-request-search').addEventListener('input',adminRequestListRender);
bind('#admin-request-new',()=>{adminRequestSelected=blankAdminRequest();adminRequestForm();adminRequestListRender();});
bind('#admin-request-refresh',loadAdminRequestEditor);
bind('#admin-request-add-item',()=>{
  if(adminRequestSelected.items.length>=6){toast('素材は6種類までです。');return;}
  const used=new Set(adminRequestSelected.items.map(x=>x.id));
  const found=ADMIN_MATERIALS.find(x=>!used.has(x[0]));
  if(found){adminRequestSelected.items.push({id:found[0],needed:3});adminRequestItems();}
});
$('#admin-request-edit-form').addEventListener('submit',handler(async e=>{
  e.preventDefault();const r=adminRequestSelected;
  const payload={key:r.key||undefined,npcId:'paper',revision:r.revision,title:$('#admin-request-title').value,description:$('#admin-request-description').value,acceptText:$('#admin-request-accept').value,completeText:$('#admin-request-complete').value,difficulty:Number($('#admin-request-difficulty').value),minSection:Number($('#admin-request-section').value),mode:$('#admin-request-mode').value,giftKind:$('#admin-request-gift').value,enabled:$('#admin-request-enabled').checked,items:r.items.map(x=>({id:x.id,needed:x.needed}))};
  const btn=$('#admin-request-save');btn.disabled=true;
  try{const result=await adminApi('/requests/save','POST',payload);adminRequestSelected=result.request;await loadAdminRequestEditor();toast('お願いを保存しました。');}finally{btn.disabled=false;}
}));
bind('#admin-request-show-history',async()=>{
  const {history}=await adminApi('/requests/audit');const list=$('#admin-request-history');list.replaceChildren();
  if(!history.length){list.textContent='まだ編集履歴がありません。';return;}
  history.forEach(x=>{const p=document.createElement('p');p.className='muted tiny';p.textContent=`${jstDate(x.at)} ／ ${x.admin} ／ ${x.action} ／ ${x.title||x.key}`;list.append(p);});
});

// v0.11.7: 返礼品エディター。画像ファイルは公開GitHubに置き、登録された相対パスを表示。
let adminGiftCache=[],adminGiftSelected=null;
const newAdminGift=()=>({itemId:'',npcId:'paper',name:'',description:'',image:'',giftKind:'food',weight:1,enabled:true,revision:0});
const adminGiftListRender=()=>{
 const q=$('#admin-gift-search').value.trim().toLowerCase(),list=$('#admin-gift-list');list.replaceChildren();
 const rows=adminGiftCache.filter(g=>!q||`${g.itemId} ${g.name}`.toLowerCase().includes(q));
 $('#admin-gift-count').textContent=`${rows.length} / ${adminGiftCache.length}件`;
 rows.forEach(g=>{const b=document.createElement('button');b.type='button';b.className='secondary small admin-topic-button';b.textContent=`${g.enabled?'':'［無効］'}${g.name} (${g.itemId})`;if(g.itemId===adminGiftSelected?.itemId)b.classList.add('admin-selected');b.onclick=()=>{adminGiftSelected=structuredClone(g);adminGiftForm();adminGiftListRender();};list.append(b);});
};
const adminGiftPreview=()=>{
 const path=$('#admin-gift-image').value.trim(),img=$('#admin-gift-preview-img');
 img.classList.toggle('hidden',!path);if(path){img.src=encodeURI(path);img.onerror=()=>img.classList.add('hidden');}
 $('#admin-gift-preview-title').textContent=$('#admin-gift-name').value||'返礼品名';
};
const adminGiftForm=()=>{
 const g=adminGiftSelected||newAdminGift();adminGiftSelected=g;
 $('#admin-gift-id').value=g.itemId;$('#admin-gift-id').readOnly=!!g.revision;
 $('#admin-gift-name').value=g.name;$('#admin-gift-description').value=g.description;
 $('#admin-gift-image').value=g.image;$('#admin-gift-kind').value=g.giftKind;
 $('#admin-gift-weight').value=g.weight;$('#admin-gift-enabled').checked=g.enabled;
 $('#admin-gift-revision').textContent=g.revision?`改訂 ${g.revision}`:'新しい返礼品';adminGiftPreview();
};
const loadAdminGiftEditor=async()=>{
 const result=await adminApi('/gifts?npc=paper');adminGiftCache=result.gifts||[];
 adminGiftSelected=structuredClone(adminGiftCache.find(g=>g.itemId===adminGiftSelected?.itemId)||adminGiftCache[0]||newAdminGift());
 adminGiftForm();adminGiftListRender();
};
bind('#admin-show-gift-editor',async()=>{
 $('#admin-stats-panel').classList.add('hidden');
 $('#admin-quest-panel').classList.add('hidden');
 $('#admin-material-panel').classList.add('hidden');
 $('#admin-ai-panel').classList.add('hidden');
 $('#admin-conversations-panel').classList.add('hidden');$('#admin-requests-panel').classList.add('hidden');$('#admin-gifts-panel').classList.remove('hidden');
 await loadAdminGiftEditor();
});
$('#admin-gift-search').addEventListener('input',adminGiftListRender);
for(const field of ['#admin-gift-image','#admin-gift-name'])$(field).addEventListener('input',adminGiftPreview);
bind('#admin-gift-new',()=>{adminGiftSelected=newAdminGift();adminGiftForm();adminGiftListRender();});
bind('#admin-gift-refresh',loadAdminGiftEditor);
$('#admin-gift-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();const g=adminGiftSelected;
 const payload={npcId:'paper',itemId:$('#admin-gift-id').value.trim(),revision:g.revision,name:$('#admin-gift-name').value,
 description:$('#admin-gift-description').value,image:$('#admin-gift-image').value.trim(),giftKind:$('#admin-gift-kind').value,
 weight:Number($('#admin-gift-weight').value),enabled:$('#admin-gift-enabled').checked};
 const b=$('#admin-gift-save');b.disabled=true;
 try{const r=await adminApi('/gifts/save','POST',payload);adminGiftSelected=r.gift;await loadAdminGiftEditor();toast('返礼品を保存しました。');}finally{b.disabled=false;}
}));
bind('#admin-gift-show-history',async()=>{
 const {history}=await adminApi('/gifts/audit'),list=$('#admin-gift-history');list.replaceChildren();
 if(!history.length){list.textContent='まだ編集履歴がありません。';return;}
 history.forEach(x=>{const p=document.createElement('p');p.className='muted tiny';p.textContent=`${jstDate(x.at)} ／ ${x.admin} ／ ${x.action} ／ ${x.name||x.itemId}`;list.append(p);});
});

// v0.15.1: 通知は本人のブラウザに保存。受信データや既読状態は変更しない。
const notificationKey=()=>`kagariso-notify-v1:${resident?.id||''}`;
function notificationPrefs(){try{return {npc:true,resident:true,cave:true,greenhouse:true,...JSON.parse(localStorage.getItem(notificationKey())||'{}')};}catch{return {npc:true,resident:true,cave:true,greenhouse:true};}}
function pushGameNotice(message,action,goLabel="確認する",closeLabel="閉じる"){
 const stack=$('#game-notifications');const card=document.createElement('div');card.className='game-notification';
 const title=document.createElement('div');title.textContent=message;title.setAttribute('role','status');
 const close=document.createElement('button');close.type='button';close.className='secondary small';close.textContent=closeLabel;close.onclick=()=>card.remove();
 card.append(title);const actions=document.createElement('div');actions.className='actions';
 if(action){const go=document.createElement('button');go.type='button';go.className='secondary small';go.textContent=goLabel;go.onclick=handler(async()=>{card.remove();await action();});actions.append(go);}
 actions.append(close);card.append(actions);stack.append(card);while(stack.children.length>4)stack.firstElementChild.remove();setTimeout(()=>card.remove(),15000);
}
let noticeBusy=false;
async function checkGameNotifications(){
 if(!token||!resident||document.hidden||noticeBusy||['auth','recovery','admin-login','admin-editor',''].includes(activePage))return;
 noticeBusy=true;const session=token,id=resident.id;
 try{
  const data=await api('/notifications');if(token!==session||resident?.id!==id||document.hidden)return;
  $('#pyoro-gifts-open').textContent='赤色の獣のプレゼントを見る'+(data.pyoro?.length?'（'+data.pyoro.length+'件）':'');
  const badge=$('#gift-ready-badge');badge.textContent=data.readyCount?`(${data.readyCount})`:'';badge.classList.toggle('hidden',!data.readyCount);
  const key=notificationKey()+':seen';let seen=[];try{seen=JSON.parse(localStorage.getItem(key)||'[]');}catch{}if(!Array.isArray(seen))seen=[];
  const known=new Set(seen),prefs=notificationPrefs();
  if(data.build?.startedAt){
    const k=`kagariso-build:${id}:`;
    for(const q of data.build.quests||[]){
      for(const [type,stamp,message] of [['start',q.startedAt,q.id==='hall_stairs'?'二匹の獣が二階について相談しています！':q.id==='hall_lounge'?'二匹の獣がホールの拡張を相談しています！':'獣のおへやについて新しい相談があります！'],['complete',q.completedAt,buildCompleteByQuest[q.id]?.title||'共同クエストが完成しました！']]){
        const noticeKey=k+q.id+':'+type;
        if(stamp&&localStorage.getItem(noticeKey)!==stamp){localStorage.setItem(noticeKey,stamp);pushGameNotice(message,openHall,'ホールへ','あとで行く');}
      }
    }
    if(activePage==='hall')renderPrivateRoomLinks(data.build);
    if(hallBuildLevel!==data.build.level){hallBuildLevel=data.build.level;updateHallBackground();updateConversationBackground();}
    if(activePage==='hall'&&!buildBusy&&(String(data.build.questId||'')!==buildQuestKey||(data.build.progress??0)!==buildLastProgress||(data.build.completedAt??null)!==buildLastCompletedAt||(data.build.active&&$('#hall-build').classList.contains('hidden')))&&!$('#hall-build').contains(document.activeElement)){renderHallBuild(await api('/build/lounge'));}
  }
  // v0.18.7.1: 月の扉は住人全員の共同達成。解放時刻ごとに本人の端末に一度知らせる。
  // 通知履歴は住人ID別で管理し、既存の贈り物・探索通知を妨げない。
  if(data.moon?.unlockedAt){
    const moonKey=`kagariso-moon-unlocked-v0.18.7.1:${id}`;
    if(localStorage.getItem(moonKey)!==data.moon.unlockedAt){
      localStorage.setItem(moonKey,data.moon.unlockedAt);
      pushGameNotice('誰かが料理50種類を完成させた！ ホールの月の扉が開いたようです。',openMoonDoor,'話を聞く','あとで行く');
      if(activePage==='hall'){
        moonDoorUnlocked=true;
        positionHallCaveDoor();
        const moonCard=$('#doors').querySelector('[data-door-card="moon"]');
        if(moonCard){moonCard.querySelector('.tag')?.remove(); const name=moonCard.querySelector('.door-card-copy strong'); if(name)name.textContent='商店';
          if(!moonCard.querySelector('[data-door="moon"]')){
            const b=document.createElement('button');b.type='button';b.className='secondary small';b.dataset.door='moon';b.textContent='商店へ';b.addEventListener('click',handler(openMoonDoor));moonCard.append(b);
          }
        }
      }
    }
  }
  // 共同納品達成を住人ごと・端末ごとに一度通知する。
  if(data.lentFlower?.completedAt && prefs.cave){
    const flowerKey=`kagariso-lent-flower-completed:${id}`;
    if(localStorage.getItem(flowerKey)!==data.lentFlower.completedAt){
      pushGameNotice('逆さに咲く花が1,000個集まりました！ 商人があなたを待っています。',openMoonDoor,'商人に会いに行く','あとで行く');
      localStorage.setItem(flowerKey,data.lentFlower.completedAt);
    }
  }
  // 温室の収穫可能通知：住人本人の栽培1回につき1度。
  if(data.greenhouse?.readyCycleId&&prefs.greenhouse){
    const ghNoticeKey=`kagariso-gh-ready:${id}`;
    if(localStorage.getItem(ghNoticeKey)!==data.greenhouse.readyCycleId){
      pushGameNotice('温室の花が咲きました！ 収穫できるようになりました。',openGreenhouse,'温室へ','あとで行く');
      localStorage.setItem(ghNoticeKey,data.greenhouse.readyCycleId);
    }
  }
  if(data.forest?.unlocked&&data.forest.eligible&&!data.forest.seen){
    if(activePage==='hall'){updateForestHall(data.forest);showForestEvent(false);}
    else if(!['forest-event','forest'].includes(activePage)&&prefs.cave){
      const k=id+':'+data.forest.unlockedAt;
      if(forestNoticeKey!==k){forestNoticeKey=k;pushGameNotice('ホールで何かが起きたようです。黄色い獣が、白い扉の前で何かを見つけたようです。',openHall,'ホールへ戻る','探索を続ける');}
    }
  }

  for(const kind of ['npc','resident']){
   const fresh=data[kind].filter(g=>!known.has(kind+':'+g.id));
   for(const g of fresh)known.add(kind+':'+g.id);
   if(fresh.length&&prefs[kind]&&activePage!=='npc-gifts'){
    const title=kind==='npc'?'黄色い獣から':fresh.length===1?`${fresh[0].sender}さんから`:'住人から';
    pushGameNotice(`${title}贈り物が${fresh.length>1?fresh.length+'件':''}届きました！`,()=>openNpcGifts('hall'));
   }
  }
  const red=data.pyoro||[];const freshRed=red.filter(g=>!known.has('pyoro:'+g.id));
  if(freshRed.length&&prefs.npc&&activePage!=='npc-gifts')pushGameNotice('赤色の獣から贈り物が届きました！',()=>openNpcGifts('pyoro'));
  // 未受取のIDだけ保持。受け取り済みを削除した後に同じIDが再登場することはない。
  localStorage.setItem(key,JSON.stringify(['npc','resident','pyoro'].flatMap(kind=>(data[kind]||[]).map(g=>kind+':'+g.id))));
 }finally{noticeBusy=false;}
}
const openNoticeSettings=()=>{const prefs=notificationPrefs();for(const kind of ['npc','resident','cave','greenhouse'])$('#notify-'+kind).checked=prefs[kind];$('#notification-settings').showModal();};
bind('#open-notification-settings',openNoticeSettings);
bind('#close-notification-settings',()=>$('#notification-settings').close());
for(const kind of ['npc','resident','cave','greenhouse'])$('#notify-'+kind).addEventListener('change',()=>{const prefs=notificationPrefs();prefs[kind]=$('#notify-'+kind).checked;localStorage.setItem(notificationKey(),JSON.stringify(prefs));});
setInterval(()=>{if(!document.hidden)refreshCaveStatus().catch(console.warn);},15000);
setInterval(()=>checkGameNotifications().catch(console.warn),30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCaveStatus().catch(console.warn);checkGameNotifications().catch(console.warn);}});
(async()=>{if(token){try{await openHall();}catch(e){toast(e.message);show('auth');}}else show('auth');})();

// v0.12.1 AI人格管理・名前の明示登録
let aiProfileRevision=0;
const aiProfileFields=['personality','speech','firstPerson','secondPerson','likes','dislikes','avoid','name','description','profilePersonality','extraPrompt','hungerMinutes','sleepStart','sleepEnd','restStart'];
const editorNpc=()=>$('#admin-npc-target').value;
let aiLoadedNpc=null;
const loadAiProfile=async()=>{
 const npc=editorNpc();aiLoadedNpc=null;$('#ai-profile-test-result').textContent='';$('#ai-profile-audit-list').replaceChildren();const {profile}=await adminApi('/ai-profile?npcId='+npc);if(npc!==editorNpc())return;aiLoadedNpc=npc;aiProfileRevision=profile.revision;$('#ai-profile-target').textContent='対象NPC：'+(npc==='paper'?'黄色い獣（paper）':'赤色の獣（pyoro）');
 $('#ai-profile-revision').textContent=`改訂 ${profile.revision}`;
 for(const k of aiProfileFields)$('#ai-profile-'+k).value=profile[k];
 $('#ai-profile-examples').value=profile.examples.map(e=>e.user+'\t'+e.assistant).join('\n');
};
bind('#admin-show-ai-editor',async()=>{
 for(const id of ['admin-stats-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-material-panel','admin-quest-panel'])$('#'+id).classList.add('hidden');
 $('#admin-pyoro-panel').classList.add('hidden');$('#admin-sea-panel').classList.add('hidden');$('#admin-recovery-panel').classList.add('hidden');$('#admin-ai-panel').classList.remove('hidden');await loadAiProfile();
});
bind('#ai-profile-reload',loadAiProfile);
$('#ai-profile-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();if(aiLoadedNpc!==editorNpc())return;const body={revision:aiProfileRevision,npcId:aiLoadedNpc};for(const k of aiProfileFields)body[k]=$('#ai-profile-'+k).value;
 body.examples=$('#ai-profile-examples').value.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const [user,...parts]=line.split('\t');return {user,assistant:parts.join('\t')};});
 await adminApi('/ai-profile/save','POST',body);await loadAiProfile();toast('AI人格を保存しました。');
}));
$('#ai-profile-test-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;
 try{const r=await adminApi('/ai-profile/test','POST',{npcId:editorNpc(),message:$('#ai-profile-test-message').value});$('#ai-profile-test-result').textContent=r.response;}finally{b.disabled=false;}
}));
bind('#ai-profile-audit',async()=>{const {history}=await adminApi('/ai-profile/audit?npcId='+editorNpc());const el=$('#ai-profile-audit-list');el.replaceChildren();for(const row of history){const p=document.createElement('p');p.textContent=`改訂 ${row.revision} ／ ${row.display_name} ／ ${jstDate(row.created_at)}`;el.append(p);}});
$('#npc-name-form').addEventListener('submit',handler(async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{const r=await api('/npcs/paper/ai/name','POST',{nickname:$('#npc-name-input').value});$('#speech-line').textContent=r.response;$('#npc-name-input').value='';toast('呼び名を教えました。');}finally{b.disabled=false;}}));

let rateAreas=[],rateData=null,rateLoadVersion=0,rateCoverage=null;
const rateArea=()=>rateAreas.find(a=>a.id===Number($('#rates-area').value));
const rateSpotOptions=()=>{$('#rates-spot').replaceChildren(...rateArea().spots.map(s=>new Option(s.name,s.id)));};
// v0.15.4: pool membership, search, rarity filter and live candidate preview.
const rateLocations=(id)=>{const sid=Number($('#rates-area').value),spot=$('#rates-spot').value;return (rateCoverage?.locations||[]).map(l=>l.sectionId===sid&&l.spotId===spot?{...l,groups:rateData.groups}:l).filter(l=>Object.values(l.groups).some(g=>g.some(m=>m.id===id&&m.value>0))).map(l=>l.label);};
const rateWarnings=()=>{
 const sid=Number($('#rates-area').value),spot=$('#rates-spot').value;
 const locations=(rateCoverage?.locations||[]).map(l=>l.sectionId===sid&&l.spotId===spot?{...l,groups:rateData.groups}:l);
 const obtainable=(id,max)=>locations.some(l=>l.sectionId<=max&&Object.entries(l.groups).some(([k,g])=>g.some(m=>m.id===id&&m.value>0&&(k!=='chest'||m.sections.some(s=>s<=Math.min(max,5))))));
 const warnings=[];for(const r of rateCoverage?.required||[])if(!obtainable(r.item_id,r.section_id))warnings.push(`${materialById(r.item_id)?.name||r.item_id}：第${r.section_id}区画までの未完了納品に必要`);
 for(const id of rateCoverage?.requests||[])if(!obtainable(id,105))warnings.push(`${materialById(id)?.name||id}：お願いに必要`);
 return [...new Set(warnings)];
};
const renderRates=()=>{
 const list=$('#rates-list');list.replaceChildren();if(!rateData)return;
 $('#rates-revision').textContent=`改訂 ${rateData.revision}（0は初期設定）`;
 for(const [key,items] of Object.entries(rateData.groups)){
 const section=document.createElement('section');section.className='rate-group';const h=document.createElement('h3');h.textContent={normal:'通常採取（重み）',rare:Number($('#rates-area').value)>100?'★5（上から順に判定・最初の当選を採用）':'★5（1回の採取あたりの独立確率）',chest:'宝箱（重み）'}[key];section.append(h);
 const fields=[];for(const m of items){const row=document.createElement('div');row.className='rate-row';const label=document.createElement('label');label.textContent=m.name+' '+ '★'.repeat(m.rarity);const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.01';input.required=true;input.value=m.value;label.append(input);const pct=document.createElement('span');const remove=document.createElement('button');remove.type='button';remove.className='secondary small';remove.textContent='除外';remove.onclick=()=>{rateData.groups[key]=items.filter(x=>x.id!==m.id);renderRates();};row.append(label,pct,remove);section.append(row);fields.push({m,input,pct});}
 const recalc=()=>{const sum=fields.reduce((a,f)=>a+Number(f.input.value||0),0);for(const f of fields){const v=Number(f.input.value||0);f.pct.textContent=(key==='rare'?v:sum?100*v/sum:0).toFixed(2)+'%'+(key==='chest'?'（全候補時）':key==='normal'?'（通常枠内）':'');}};
 for(const f of fields)f.input.addEventListener('input',()=>{f.m.value=Number(f.input.value);recalc();});recalc();
 const add=document.createElement('div');add.className='rate-add';const search=document.createElement('input');search.type='search';search.placeholder='素材名で検索';search.setAttribute('aria-label','素材名で検索');const stars=document.createElement('select');stars.replaceChildren(new Option('すべてのレア度',''),...[1,2,3,4,5].map(n=>new Option('★'+n,n)));const select=document.createElement('select');select.setAttribute('aria-label','追加する素材');const preview=document.createElement('div');preview.className='rate-preview';const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='＋ 素材を追加';
 const updatePreview=()=>{const m=rateData.catalog.find(x=>x.id===select.value);preview.replaceChildren();button.disabled=!m;if(!m)return;const img=materialById(m.id)?.image;if(img){const el=document.createElement('img');el.src=img;el.alt='';el.className='material-thumb';preview.append(el);}const text=document.createElement('div');text.textContent=m.name+' ／ 登録先：'+(rateLocations(m.id).join('、')||'なし');preview.append(text);};
 const filter=()=>{const q=search.value.trim().toLowerCase();const options=rateData.catalog.filter(m=>(key==='rare'?m.rarity===5:m.rarity<5)&&!items.some(x=>x.id===m.id)&&(!stars.value||m.rarity===Number(stars.value))&&m.name.toLowerCase().includes(q));select.replaceChildren(...options.map(m=>new Option(m.name+'（★'+m.rarity+'）',m.id)));updatePreview();};
 search.oninput=filter;stars.onchange=filter;select.onchange=updatePreview;button.onclick=()=>{const m=rateData.catalog.find(x=>x.id===select.value);if(m&&!items.some(x=>x.id===m.id)){items.push({...m,value:key==='rare'?1:10,defaultValue:key==='rare'?1:10});renderRates();}};add.append(search,stars,select,preview,button);section.append(add);filter();list.append(section);
 }
};
const loadRates=async()=>{const seq=++rateLoadVersion;rateData=null;renderRates();const [data,coverage]=await Promise.all([adminApi('/material-rates?section='+encodeURIComponent($('#rates-area').value)+'&spot='+encodeURIComponent($('#rates-spot').value)),adminApi('/material-rates/coverage')]);if(seq!==rateLoadVersion)return;rateData=data;rateCoverage=coverage;renderRates();};
bind('#admin-show-material-editor',async()=>{for(const id of ['admin-stats-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel','admin-quest-panel'])$('#'+id).classList.add('hidden');$('#admin-material-panel').classList.remove('hidden');rateAreas=(await adminApi('/material-rates/areas')).areas;$('#rates-area').replaceChildren(...rateAreas.map(a=>new Option(a.name,a.id)));rateSpotOptions();await loadRates();});
$('#rates-area').addEventListener('change',handler(async()=>{rateSpotOptions();await loadRates();}));$('#rates-spot').addEventListener('change',handler(loadRates));bind('#rates-reload',loadRates);bind('#rates-reset',()=>{if(!rateData)return;rateData.groups=JSON.parse(JSON.stringify(rateData.initialGroups));renderRates();});
$('#rates-form').addEventListener('submit',handler(async e=>{e.preventDefault();if(!rateData)return;const sectionId=Number($('#rates-area').value),spotId=$('#rates-spot').value;const b=e.currentTarget.querySelector('button[type=submit]');b.disabled=true;try{const rates=Object.fromEntries(Object.entries(rateData.groups).map(([k,items])=>[k,Object.fromEntries(items.map(m=>[m.id,m.value]))]));const warnings=rateWarnings();if(warnings.length&&!window.confirm('入手困難になる可能性のある必要素材：\n'+warnings.join('\n')+'\nそれでも保存しますか？'))return;await adminApi('/material-rates/save','POST',{sectionId,spotId,revision:rateData.revision,rates});await loadRates();toast('出現頻度を保存しました。');}finally{b.disabled=false;}}));
bind('#rates-audit',async()=>{const {history}=await adminApi('/material-rates/audit');$('#rates-audit-list').replaceChildren(...history.map(r=>{const p=document.createElement('p');p.textContent=`${r.section_id>100?"森 "+(r.section_id-100):"洞窟 "+r.section_id} / ${r.spot_id} / 改訂 ${r.revision} / ${r.display_name} / ${jstDate(r.created_at)}`;return p;}));});

// v0.15.6: next reset quest plan, separate from current live progression.
let questData=null,questPlan=[],questDirty=false,questLoading=false;
const questArea=()=>Number($('#quest-area').value);
const questName=id=>questData?.catalog.find(m=>m.id===id)?.name||id;
const questWarnings=()=>questPlan.flatMap(r=>{
 const m=questData.catalog.find(m=>m.id===r.id);if(!m)return [`${r.id}：不明な素材`];
 const possible=questData.coverage.some(l=>l.sectionId<=r.sectionId&&Object.entries(l.groups).some(([k,items])=>items.some(x=>x.id===r.id&&x.value>0&&(k!=='chest'||m.sections.some(s=>s<=r.sectionId)))));
 return [...(!possible?[`第${r.sectionId}区画までに ${m.name} を入手できません。`]:[]),...(m.rarity===5?[`第${r.sectionId}区画：${m.name} は★5素材です。`]:[])];
});
const questTotals=()=>{
 const total=rows=>rows.reduce((n,r)=>n+Number(r.needed||0),0);
 $('#quest-summary').textContent=`この区画：${total(questPlan.filter(r=>r.sectionId===questArea())).toLocaleString()}個 ／ 全区画：${total(questPlan).toLocaleString()}個（初期値 ${total(questData.baseline).toLocaleString()}個）`;
 const warnings=questWarnings();$('#quest-warnings').textContent=warnings.join('\n');
 $('#quest-status').textContent=`改訂 ${questData.revision} ／ ${questDirty?'未保存の変更あり':'保存済みの表示'} ／ 現在の進行：第${questData.progress.section}区画${questData.progress.rescued?'・出口解放済み':''}`;
};
const renderQuest=()=>{
 if(!questData)return;const sectionId=questArea(),rows=questPlan.filter(r=>r.sectionId===sectionId);
 const list=$('#quest-list');list.replaceChildren();
 for(const r of rows){const row=document.createElement('div');row.className='quest-row';const label=document.createElement('div');label.innerHTML=matIcon(r.id)+`<span>${safe(questName(r.id))}（★${questData.catalog.find(m=>m.id===r.id)?.rarity||'?'}）</span>`;
 const input=document.createElement('input');input.type='number';input.min='1';input.max='100000';input.step='1';input.value=r.needed;input.setAttribute('aria-label',questName(r.id)+' 必要数');input.addEventListener('input',()=>{r.needed=input.value===''?0:Number(input.value);questDirty=true;questTotals();});
 const remove=document.createElement('button');remove.type='button';remove.className='secondary small';remove.textContent='除外';remove.onclick=()=>{questPlan=questPlan.filter(x=>x!==r);questDirty=true;renderQuest();};row.append(label,input,remove);list.append(row);}
 const available=questData.catalog.filter(m=>!rows.some(r=>r.id===m.id));$('#quest-add-item').replaceChildren(...available.map(m=>new Option(`${m.name}（★${m.rarity}）`,m.id)));$('#quest-add').disabled=!available.length;
 $('#quest-live').replaceChildren(...questData.live.filter(r=>r.sectionId===sectionId).map(r=>{const p=document.createElement('p');p.textContent=`${questName(r.id)}：${r.donated} / ${r.needed}個`;return p;}));questTotals();
};
const setQuestData=data=>{const old=questArea();questData=data;questPlan=structuredClone(data.plan);questDirty=false;$('#quest-area').replaceChildren(...data.areas.map(a=>new Option(a.name,a.id)));if(data.areas.some(a=>a.id===old))$('#quest-area').value=String(old);$('#quest-history').replaceChildren(...data.history.map(h=>{const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=`改訂 ${h.revision} ／ ${h.display_name||'管理者'} ／ ${jstDate(h.created_at)}`;p.textContent=JSON.parse(h.plan_json).map(r=>`第${r.sectionId}区画 ${questName(r.id)}：${r.needed}個`).join('\n');p.style.whiteSpace='pre-line';d.append(s,p);return d;}));renderQuest();};
const loadQuest=async()=>{if(questLoading)return;questLoading=true;try{setQuestData(await adminApi('/cave-quest'));}finally{questLoading=false;}};
bind('#admin-show-quest-editor',async()=>{for(const id of ['admin-stats-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel','admin-material-panel'])$('#'+id).classList.add('hidden');$('#admin-quest-panel').classList.remove('hidden');if($('#quest-kind').value==='build'){if(!buildEditorDirty)await loadBuildEditor();}else if(!questData||!questDirty)await loadQuest();});
$('#quest-area').addEventListener('change',renderQuest);
bind('#quest-add',()=>{if(!questData||questLoading)return;const id=$('#quest-add-item').value;if(id&&!questPlan.some(r=>r.sectionId===questArea()&&r.id===id)){questPlan.push({sectionId:questArea(),id,needed:10});questDirty=true;renderQuest();}});
const scaleQuest=all=>{if(!questData||questLoading)return;const n=Number($('#quest-factor').value);if(!Number.isFinite(n)||n<0.1||n>10){toast('倍率は0.1〜10です。');return;}if(!confirm(`現在の編集値を ${n} 倍しますか？`))return;for(const r of questPlan)if(all||r.sectionId===questArea())r.needed=Math.max(1,Math.min(100000,Math.round(r.needed*n)));questDirty=true;renderQuest();};
bind('#quest-scale-area',()=>scaleQuest(false));bind('#quest-scale-all',()=>scaleQuest(true));
bind('#quest-reset',()=>{if(!questData||questLoading||!confirm('この区画をエディター導入時の必要数に戻しますか？'))return;questPlan=[...questPlan.filter(r=>r.sectionId!==questArea()),...structuredClone(questData.baseline.filter(r=>r.sectionId===questArea()))];questDirty=true;renderQuest();});
bind('#quest-reload',async()=>{if(!questDirty||confirm('未保存の変更を破棄しますか？'))await loadQuest();});
bind('#quest-save',async()=>{if(!questData||questLoading)return;if(questPlan.some(r=>!Number.isInteger(r.needed)||r.needed<1||r.needed>100000)||questData.areas.some(a=>!questPlan.some(r=>r.sectionId===a.id))){toast('各区画に1種類以上、必要数は整数1〜100000個で設定してください。');return;}const warnings=questWarnings();if(warnings.length&&!confirm(warnings.join('\n')+'\n次回用として保存しますか？'))return;questLoading=true;const b=$('#quest-save');b.disabled=true;try{setQuestData(await adminApi('/cave-quest/save','POST',{revision:questData.revision,plan:questPlan}));toast('次回用設定を保存しました。現在の進捗は変更していません。');}finally{questLoading=false;b.disabled=false;}});


let buildEditorData=null,buildEditorRows=[],buildEditorDirty=false,buildEditorLoading=false,buildEditorSelected='';
const buildEditorQuest=()=>buildEditorData?.quests.find(q=>q.id===buildEditorSelected);
function renderBuildEditor(){const q=buildEditorQuest();if(!q)return;const locked=!!q.completed_at||buildEditorLoading;const name=id=>buildEditorData.catalog.find(m=>m.id===id)?.name||id;
 $('#build-editor-status').textContent=(q.completed_at?'達成済み':q.started_at?'進行中':'未開始')+' ／ 改訂 '+q.revision+(buildEditorDirty?' ／ 未保存':'');
 const list=$('#build-editor-rows');list.replaceChildren();for(const r of buildEditorRows){const row=document.createElement('div');row.className='quest-row';const label=document.createElement('span');label.textContent=name(r.id)+'（納品 '+(r.donated||0)+'）';const input=document.createElement('input');input.type='number';input.min=Math.max(1,r.donated||0);input.max=100000;input.value=r.needed;input.disabled=locked;input.setAttribute('aria-label',name(r.id)+' 必要数');input.oninput=()=>{r.needed=Number(input.value);buildEditorDirty=true;$('#build-editor-status').textContent='未保存の変更あり';};const remove=document.createElement('button');remove.type='button';remove.className='secondary small';remove.textContent='除外';remove.disabled=locked||r.donated>0;remove.onclick=()=>{buildEditorRows=buildEditorRows.filter(x=>x!==r);buildEditorDirty=true;renderBuildEditor();};row.append(label,input,remove);list.append(row);}
 const available=buildEditorData.catalog.filter(m=>!buildEditorRows.some(r=>r.id===m.id));$('#build-editor-item').replaceChildren(...available.map(m=>new Option(m.name,m.id)));$('#build-editor-item').disabled=locked;$('#build-editor-add').disabled=locked||!available.length;$('#build-editor-save').disabled=locked||buildEditorLoading;
 $('#build-editor-history').replaceChildren(...buildEditorData.history.filter(h=>h.quest_id===q.id).map(h=>{const p=document.createElement('p');p.textContent='改訂 '+h.revision+' ／ '+jstDate(h.created_at)+' ／ '+JSON.parse(h.plan_json).map(r=>name(r.id)+' '+r.needed+'個').join('、');return p;}));}
function selectBuildEditor(id){buildEditorSelected=id;const q=buildEditorQuest();buildEditorRows=(q?.requirements||[]).map(r=>({id:r.item_id,needed:r.needed,donated:r.donated}));buildEditorDirty=false;renderBuildEditor();}
async function loadBuildEditor(){if(buildEditorLoading)return;buildEditorLoading=true;try{buildEditorData=await adminApi('/build-quest');const sel=$('#build-editor-quest');sel.replaceChildren(...buildEditorData.quests.map(q=>new Option(q.stage+'｜'+q.title+(q.completed_at?'（達成済）':q.started_at?'（進行中）':''),q.id)));sel.value=buildEditorData.quests.some(q=>q.id===buildEditorSelected)?buildEditorSelected:(buildEditorData.quests.find(q=>!q.started_at)?.id||buildEditorData.quests[0]?.id||'');selectBuildEditor(sel.value);}finally{buildEditorLoading=false;renderBuildEditor();}}
$('#quest-kind').addEventListener('change',handler(async()=>{const build=$('#quest-kind').value==='build';$('#cave-editor-view').classList.toggle('hidden',build);$('#build-editor-view').classList.toggle('hidden',!build);if(build&&!buildEditorData)await loadBuildEditor();}));
$('#build-editor-quest').addEventListener('change',()=>{if(buildEditorDirty&&!confirm('未保存の変更を破棄しますか？')){$('#build-editor-quest').value=buildEditorSelected;return;}selectBuildEditor($('#build-editor-quest').value);});
bind('#build-editor-add',()=>{const id=$('#build-editor-item').value;if(id&&!buildEditorRows.some(r=>r.id===id)){buildEditorRows.push({id,needed:10,donated:0});buildEditorDirty=true;renderBuildEditor();}});
bind('#build-editor-reload',async()=>{if(!buildEditorDirty||confirm('未保存の変更を破棄しますか？'))await loadBuildEditor();});
bind('#build-editor-save',async()=>{const q=buildEditorQuest();if(!q||q.completed_at||buildEditorLoading)return;if(!buildEditorRows.length||buildEditorRows.some(r=>!Number.isSafeInteger(r.needed)||r.needed<Math.max(1,r.donated||0)||r.needed>100000)||buildEditorRows.length>100){toast('素材は1〜100種類、必要数は納品済み数以上（最大100000個）に設定してください。');return;}buildEditorLoading=true;renderBuildEditor();try{buildEditorData=await adminApi('/build-quest/save','POST',{questId:q.id,revision:q.revision,requirements:buildEditorRows.map(({id,needed})=>({id,needed}))});selectBuildEditor(q.id);toast('クエストの設定を保存しました。');}finally{buildEditorLoading=false;renderBuildEditor();}});

// v0.15.10: 読み取り専用の探索分析。設定値と過去の実績は区別する。
let statsData=null,statsSeq=0;
const statsSort=new Map();
const statsCompare=(a,b)=>{const parse=x=>{const t=String(x).replace(/,/g,'').replace(/^[★]/,'').replace(/%$/,'');return /^-?\d+(?:\.\d+)?$/.test(t)?Number(t):null;};const x=parse(a),y=parse(b);return x!==null&&y!==null?x-y:String(a).localeCompare(String(b),'ja',{numeric:true});};
// CSVはUTF-8 BOM付き。数式として解釈される文字列を無害化する。
const statsCsvCell=value=>{let t=String(value??'');if(/^[\s]*[=+@-]/.test(t)||/^[\t\r\n]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
const statsDownload=(table,title)=>{const global=title.startsWith('区画進捗');const scope=global?['全期間','全住人','全区画','全採取場所']:[`${statsData.filters?.from||'開始'}〜${statsData.filters?.to||'現在'}`,statsData.residents.find(r=>r.id===statsData.filters?.resident)?.name||'全住人',$('#stats-area').selectedOptions[0]?.textContent||'全区画',$('#stats-spot').selectedOptions[0]?.textContent||'全採取場所'];const lines=[...table.rows].map((r,i)=>[...r.cells].map(c=>c.dataset.export??c.textContent.trim()).concat(i===0?['集計期間（JST）','住人条件','区画条件','場所条件']:scope).map(statsCsvCell).join(','));const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`kagariso_${title.replace(/[\\/:*?"<>|]/g,"_")}_${statsData.filters?.from||'開始'}-${statsData.filters?.to||'現在'}_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);};
const statsBars=(title,rows)=>{const max=Math.max(1,...rows.map(r=>r[1]));return `<section class="stats-chart"><h3>${safe(title)}</h3>${rows.length?rows.map(([name,n])=>`<div class="stats-bar-row"><span>${safe(name)}</span><div class="stats-track"><div style="width:${100*n/max}%"></div></div><b>${Number(n).toLocaleString('ja-JP')}</b></div>`).join(''):'<p>記録なし</p>'}</section>`;};
const statsTable=(title,headers,rows)=>{const pref=statsSort.get(title);const sorted=[...rows];if(pref)sorted.sort((a,b)=>statsCompare(a[pref.col],b[pref.col])*pref.dir);return `<details open><summary>${safe(title)}</summary><button class="secondary small stats-export" type="button" data-title="${safe(title)}">CSV出力</button><div class="stats-scroll"><table><thead><tr>${headers.map((x,i)=>`<th aria-sort="${pref?.col===i?(pref.dir===1?'ascending':'descending'):'none'}" data-export="${safe(x)}"><button type="button" class="stats-sort" data-title="${safe(title)}" data-col="${i}">${safe(x)} ${pref?.col===i?(pref.dir===1?'▲':'▼'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(r=>`<tr>${r.map(x=>`<td>${safe(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;};
const statsSum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
const statsSpan=(a,b)=>{if(!a||!b)return '不明';const n=Math.max(0,Math.round((Date.parse(b.replace(' ','T')+'Z')-Date.parse(a.replace(' ','T')+'Z'))/60000));return `${Math.floor(n/60)}時間${n%60}分`;};
const statsSpots=()=>{const area=statsData?.areas.find(a=>a.id===Number($('#stats-area').value));$('#stats-spot').replaceChildren(new Option('全採取場所',''),...(area?.spots||[]).map(s=>new Option(s.name,s.id)));};
const renderStats=()=>{
 const d=statsData;if(!d)return;const section=Number($('#stats-area').value),spot=$('#stats-spot').value;
 const filter=r=>(!section||r.section_id===section)&&(!spot||r.spot_id===spot);
 const a=d.attempts.filter(filter),detail=d.details.filter(filter),legacy=d.legacy.filter(filter),g=[...detail,...legacy],don=d.donations.filter(r=>!section||r.section_id===section);
 const n=statsSum(a,'attempts'),people=new Set([...a.map(x=>x.resident_id),...(!spot?don.map(x=>x.resident_id):[])]),start=d.firstAt,areaName=id=>d.areas.find(x=>x.id===id)?.name||id;
 const pct=(x,y)=>y?(100*x/y).toFixed(2)+'%':'—';const num=x=>Number(x).toLocaleString('ja-JP');
 const peopleRows=d.residents.filter(r=>people.has(r.id)).map(r=>[r.name,num(statsSum(a.filter(x=>x.resident_id===r.id),'attempts')),spot?'—':num(statsSum(don.filter(x=>x.resident_id===r.id),'quantity'))]);
 const materials=d.catalog.map(m=>{const rows=g.filter(x=>x.item_id===m.id);return [m.name,'★'+m.rarity,num(statsSum(rows,'quantity')),pct(statsSum(rows,'hits'),n),spot?'—':num(statsSum(don.filter(x=>x.item_id===m.id),'quantity'))];});
 const milestones=d.areas.map(ar=>{const exact=d.milestones.find(x=>x.section_id===ar.id)?.created_at;const last=ar.id===5&&d.progress?.rescued?d.progress.updated_at:null;const t=exact||last;return [ar.name,num(statsSum(d.requirements.filter(x=>x.section_id===ar.id),'needed')),num(statsSum(d.requirements.filter(x=>x.section_id===ar.id),'donated')),num(statsSum(d.plan.filter(x=>x.sectionId===ar.id),'needed')),t?jstDate(t):'未記録',t?statsSpan(start,t):'—'];});
 const rateRows=[];for(const ar of d.areas.filter(x=>!section||x.id===section))for(const s of ar.spots.filter(x=>!spot||x.id===spot)){const local=a.filter(x=>x.section_id===ar.id&&x.spot_id===s.id),count=statsSum(local,'attempts');const rare=s.groups.rare,none=rare.reduce((v,r)=>v*(1-r.value/100),1),normal=s.groups.normal,weight=statsSum(normal,'value');for(const m of d.catalog){const r=rare.find(x=>x.id===m.id),q=normal.find(x=>x.id===m.id);if(!r&&!q&&!s.groups.chest.some(x=>x.id===m.id))continue;const hits=statsSum(g.filter(x=>x.section_id===ar.id&&x.spot_id===s.id&&x.item_id===m.id),'hits');const direct=r?r.value:weight?100*none*.74*(q?.value||0)/weight:0;rateRows.push([ar.name+' / '+s.name,m.name,direct.toFixed(2)+'%',pct(hits,count),num(count)]);}}
 const live=statsSum(d.requirements,'needed'),next=statsSum(d.plan,'needed');const rescued=d.rescuedAt;
 const dayMap=new Map();for(const r of (d.daily||[]).filter(filter))dayMap.set(r.day,(dayMap.get(r.day)||0)+Number(r.attempts));
 const dayRows=[...dayMap].sort((a,b)=>a[0].localeCompare(b[0]));
 const charts=`<div class="stats-charts">${statsBars('区画別採取回数',d.areas.filter(x=>!section||x.id===section).map(x=>[x.name,statsSum(a.filter(y=>y.section_id===x.id),'attempts')]))}${statsBars('素材獲得数 上位10件',d.catalog.map(m=>[m.name,statsSum(g.filter(x=>x.item_id===m.id),'quantity')]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,10))}${statsBars('日別採取回数（直近30活動日・JST）',dayRows.slice(-30))}${statsBars('採取結果別', [['通常・希少素材','item'],['宝箱','chest'],['イベント','event'],['空振り','empty']].map(([label,key])=>[label,statsSum(a.filter(x=>x.outcome===key),'attempts')]))}</div>`;
 $('#stats-scope').textContent=`適用中：${d.filters?.from||'開始'} ～ ${d.filters?.to||'現在'} / ${d.residents.find(x=>x.id===d.filters?.resident)?.name||'全住人'}（JST）`;

 $('#stats-content').innerHTML=`<p class="stats-note">旧ログは複数獲得時の先頭素材のみ（全体で ${num(d.legacyCount)} 件の旧方式獲得ログ）。獲得数・獲得率は記録上の下限です。納品は採取場所で絞れないため、場所指定時は非表示。</p><div class="stats-kpis">${[['参加住人',people.size+'人'],['採取回数',num(n)+'回'],['獲得記録数',num(statsSum(g,'quantity'))+'個'],['共同納品',spot?'—':num(statsSum(don,'quantity'))+'個'],['素材獲得のあった採取',pct(statsSum(a.filter(x=>['item','chest'].includes(x.outcome)),'attempts'),n)],['現行→次回必要数（全体）',num(live)+' → '+num(next)]].map(([k,v])=>`<div><small>${safe(k)}</small><strong>${safe(v)}</strong></div>`).join('')}</div><p>必要総数の比率：${live?(next/live).toFixed(2):'—'}倍。前回5人・約5時間を基準とした10人での目安：${live?(2.5*next/live).toFixed(1):'—'}時間（人数・採取効率が比例する仮定。実測値ではありません）。</p><p>全期間の最初の採取 ${safe(jstDate(start))} ／ 最初の救出物語 ${safe(jstDate(rescued))} ／ 経過 ${safe(statsSpan(start,rescued))}（全体指標・実働時間ではありません）</p>`+charts+statsTable('日別採取回数（JST）',['日付','採取回数'],dayRows)+statsTable('区画進捗（全区画・期間／住人指定対象外）',['区画','必要数','納品済','次回必要数','開拓完了日時','開始からの経過'],milestones)+statsTable('住人別（管理者専用）',['住人','採取回数','納品個数'],peopleRows)+statsTable('素材別',['素材','レア度','獲得記録数','記録上の獲得率','納品数'],materials)+`<p class="stats-note">設定率は現在の通常・★5抽選のみ（宝箱を含まない）。実績は宝箱も含む選択期間の記録。途中の設定変更や旧ログがあるので単純比較はできません。</p>`+statsTable('採取場所別・設定と実績',['場所','素材','現在の直接採取率','記録上の獲得率','採取回数'],rateRows);
 const sea=statsSeaData;
 if(sea){const n=sea.summary;
  $('#stats-content').insertAdjacentHTML('beforeend',
    `<section class="stats-chart"><h3>海・釣りの実績</h3><p class="stats-note">現在の期間・住人条件に連動。開始した挑戦を集計（進行中・中断を含む）。成功率は成功／（成功＋失敗）で計算。</p>`+
    `<div class="stats-kpis">${[['挑戦',n.attempts],['成功',n.won],['失敗',n.lost],['中断',n.cancelled],['進行中',n.active],['みみず使用',n.worm]].map(([k,v])=>`<div><small>${safe(k)}</small><strong>${v}</strong></div>`).join('')}</div>`+
    statsTable('海・レア度別釣果',['レア度','成功回数'],sea.rarities.map(r=>['★'+r.rarity,r.count]))+
    statsTable('海・釣果別',['釣果','成功回数'],sea.catches.map(r=>[r.name,r.count]))+
    '</section>');
 }
};
let statsSeaData=null;
const loadStats=async()=>{const seq=++statsSeq,b=$('#stats-refresh');b.disabled=true;try{const query=new URLSearchParams({from:$('#stats-from').value,to:$('#stats-to').value,resident:$('#stats-resident').value});const [d,sea]=await Promise.all([adminApi('/cave-statistics?'+query),adminApi('/sea-statistics?'+query)]);if(seq!==statsSeq||!adminToken)return;statsSeaData=sea;const old=$('#stats-area').value,spot=$('#stats-spot').value;statsData=d;$('#stats-resident').replaceChildren(new Option('全住人',''),...d.residents.map(r=>new Option(r.name,r.id)));$('#stats-resident').value=d.filters?.resident||'';$('#stats-area').replaceChildren(new Option('全区画','0'),...d.areas.map(x=>new Option(x.name,x.id)));$('#stats-area').value=old||'0';statsSpots();if([...$('#stats-spot').options].some(x=>x.value===spot))$('#stats-spot').value=spot;renderStats();}finally{b.disabled=false;}};
bind('#admin-show-stats',async()=>{for(const id of ['admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel','admin-material-panel','admin-quest-panel'])$('#'+id).classList.add('hidden');$('#admin-stats-panel').classList.remove('hidden');showStatsTab('overview');await loadOverview();});
bind('#stats-refresh',loadStats);
bind('#stats-reset',async()=>{$('#stats-from').value='';$('#stats-to').value='';$('#stats-resident').value='';$('#stats-area').value='0';statsSpots();statsSort.clear();await loadStats();});
$('#stats-content').addEventListener('click',handler(async e=>{const b=e.target.closest('button');if(!b||!statsData||!adminToken)return;if(b.classList.contains('stats-export'))statsDownload(b.parentElement.querySelector('table'),b.dataset.title);if(b.classList.contains('stats-sort')){const title=b.dataset.title,col=Number(b.dataset.col),prev=statsSort.get(title);statsSort.set(title,{col,dir:prev?.col===col?-prev.dir:1});renderStats();}}));
$('#stats-area').addEventListener('change',()=>{statsSpots();renderStats();});$('#stats-spot').addEventListener('change',renderStats);

// v0.15.10: separate activity analytics tab; no changes to gameplay or stored data.
let activityData=null,activitySeq=0;
const activityLabels={gather:'採取',donate:'共同納品操作',chat:'選択式会話',ai:'自由会話記録',feed:'食事',lesson:'言葉の学習',request:'お願い受注',complete:'お願い達成',cancel:'お願い取消',requestDonate:'お願い納品操作',npcGift:'NPC返礼品受取',send:'住人への贈り物送付',receive:'住人からの贈り物受取'};
const clearActivity=()=>{activitySeq++;activityData=null;$('#activity-content').replaceChildren();$('#activity-resident').replaceChildren(new Option('全住人',''));$('#activity-npc').replaceChildren(new Option('全NPC',''));$('#activity-scope').textContent='';};
const activitySum=(rows)=>rows.reduce((s,r)=>s+Number(r.count||0),0);
const activityRows=d=>Object.entries(activityLabels).flatMap(([key,label])=>(d[key]||[]).filter(r=>!d.filters.npc||r.npc_id===d.filters.npc).map(r=>({...r,key,label})));
const renderActivity=()=>{
 const d=activityData;if(!d)return;
 const events=activityRows(d),scope=d.filters,names=new Map(d.residents.map(r=>[r.id,r.name])),npcNames=new Map(d.npcs.map(r=>[r.id,r.name]));
 const people=d.residents.filter(r=>!scope.resident||r.id===scope.resident),npcs=d.npcs.filter(n=>!scope.npc||n.id===scope.npc);
 const days=[...new Set(events.map(r=>r.day))].filter(Boolean).sort();const active=new Set(events.map(r=>r.resident_id));
 const metrics=Object.keys(activityLabels).filter(k=>!scope.npc||!['gather','donate','send','receive'].includes(k));
 const totals=metrics.map(k=>[activityLabels[k],activitySum(events.filter(r=>r.key===k))]);
 const byPerson=people.map(p=>{const e=events.filter(r=>r.resident_id===p.id);return [p.name,new Set(e.map(r=>r.day)).size,...metrics.map(k=>activitySum(e.filter(r=>r.key===k))),jstDate(e.map(r=>r.last_at).sort().at(-1))];});
 const daily=days.map(day=>{const e=events.filter(r=>r.day===day);return [day,new Set(e.map(r=>r.resident_id)).size,...metrics.map(k=>activitySum(e.filter(r=>r.key===k)))];});
 const rel=d.relationships.filter(r=>r.first_met_at),affRows=rel.map(r=>[names.get(r.resident_id)||'不明',npcNames.get(r.npc_id)||r.npc_id,Number(r.affinity_points||0),Number(r.affinity||1)]);
 const npcRows=npcs.map(n=>{const e=events.filter(r=>r.npc_id===n.id),r=rel.filter(x=>x.npc_id===n.id);return [n.name,new Set(e.map(x=>x.resident_id)).size,...['chat','ai','feed','lesson','request','complete','cancel','npcGift'].map(k=>activitySum(e.filter(x=>x.key===k))),r.length?r.reduce((s,x)=>s+Number(x.affinity||1),0)/r.length:null,d.names.filter(x=>x.npc_id===n.id).length];});
 const quotaRows=d.quota.map(r=>[r.day,names.get(r.resident_id)||'不明',npcNames.get(r.npc_id)||r.npc_id,Number(r.used)]);
 $('#activity-scope').textContent=`適用中：${scope.from||'開始'} ～ ${scope.to||'現在'} / ${names.get(scope.resident)||'全住人'} / ${npcNames.get(scope.npc)||'全NPC'}（JST）`;
 const kpis=[['登録住人（現在・全体）',d.residents.length+'人'],['活動記録のある住人',active.size+'人'],['選択式会話',activitySum(events.filter(r=>r.key==='chat'))+'回'],['自由会話記録',activitySum(events.filter(r=>r.key==='ai'))+'件'],['AI使用枠消費',d.quota.reduce((s,r)=>s+Number(r.used),0)+'回'],['食事',activitySum(events.filter(r=>r.key==='feed'))+'回']];
 $('#activity-content').innerHTML=`<p class="stats-note">活動人数は選択期間に記録がある住人の重複なし人数。ログイン人数・滞在時間ではありません。NPC指定時は探索・住人間贈り物を除外。採取や納品と会話の操作数は所要時間を表しません。</p><div class="stats-kpis">${kpis.map(([k,v])=>`<div><small>${safe(k)}</small><strong>${safe(v)}</strong></div>`).join('')}</div><div class="stats-charts">${statsBars('機能別操作数',totals)}${statsBars('日別活動住人数（直近30活動日）',daily.slice(-30).map(r=>[r[0],r[1]]))}${statsBars('親密度分布（現在・出会い済み関係）',Array.from({length:10},(_,i)=>['♥'+(i+1),rel.filter(r=>Number(r.affinity)===i+1).length]))}</div>`+statsTable('住人別活動',['住人','活動日数',...metrics.map(k=>activityLabels[k]),'期間内最終活動（JST）'],byPerson)+statsTable('日別活動（JST）',['日付','活動住人数',...metrics.map(k=>activityLabels[k])],daily)+statsTable('NPC別交流（親密度・名前は現在値）',['NPC','交流住人数','選択式会話','自由会話記録','食事','言葉学習','お願い受注','達成','取消','返礼品受取','平均親密度','名前を覚えた住人数'],npcRows.map(r=>r.map((x,i)=>i===10?(x===null?'—':Number(x).toFixed(2)):x)))+statsTable('現在の親密度（期間指定対象外）',['住人','NPC','親密度ポイント','親密度レベル'],affRows)+`<p class="stats-note">自由会話記録には定型の名前応答も含まれます。AI使用枠消費は呼び出し成功回数ではなく、失敗や定型応答も含む枠の予約記録です。名前は現在覚えている人数のみ。会話本文・名前の内容は取得しません。</p>`+statsTable('AI使用枠（日別・住人別）',['日付（JST）','住人','NPC','使用枠'],quotaRows)+`<p class="stats-note">以下のNPC自律活動は住人指定の対象外です。</p>`+statsTable('NPC日記生成（住人条件対象外）',['日付（JST）','NPC','生成方式','件数'],d.diaries.map(r=>[r.day,npcNames.get(r.npc_id)||r.npc_id,r.source==='ai'?'AI':'定型',r.count]))+statsTable('NPC自律行動（住人条件対象外）',['日付（JST）','NPC','行動','記録数'],d.life.map(r=>[r.day,npcNames.get(r.npc_id)||r.npc_id,r.action,Number(r.count)]));
};
const loadActivity=async()=>{const seq=++activitySeq,b=$('#activity-refresh');b.disabled=true;try{const query=new URLSearchParams({from:$('#activity-from').value,to:$('#activity-to').value,resident:$('#activity-resident').value,npc:$('#activity-npc').value});const d=await adminApi('/activity-statistics?'+query);if(seq!==activitySeq||!adminToken)return;activityData=d;$('#activity-resident').replaceChildren(new Option('全住人',''),...d.residents.map(r=>new Option(r.name,r.id)));$('#activity-npc').replaceChildren(new Option('全NPC',''),...d.npcs.map(n=>new Option(n.name,n.id)));$('#activity-resident').value=d.filters.resident;$('#activity-npc').value=d.filters.npc;renderActivity();}finally{b.disabled=false;}};
const activityDownload=(table,title)=>{const d=activityData,f=d.filters,autonomous=title.includes('住人条件対象外'),snapshot=title.startsWith('現在の親密度');const scope=[snapshot?'現在（期間対象外）':`${f.from||'開始'}〜${f.to||'現在'}`,autonomous?'対象外':d.residents.find(r=>r.id===f.resident)?.name||'全住人',d.npcs.find(n=>n.id===f.npc)?.name||'全NPC'];const lines=[...table.rows].map((r,i)=>[...r.cells].map(c=>c.dataset.export??c.textContent.trim()).concat(i===0?['集計期間（JST）','住人条件','NPC条件']:scope).map(statsCsvCell).join(','));const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`kagariso_${title.replace(/[\\/:*?"<>|]/g,'_')}_${f.from||'開始'}-${f.to||'現在'}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
bind('#activity-refresh',loadActivity);
bind('#activity-reset',async()=>{for(const id of ['activity-from','activity-to','activity-resident','activity-npc'])$('#'+id).value='';await loadActivity();});
bind('#stats-tab-explore',async()=>{showStatsTab('explore');await loadStats();});
bind('#stats-tab-activity',async()=>{showStatsTab('activity');await loadActivity();});
$('#activity-content').addEventListener('click',handler(async e=>{const b=e.target.closest('button');if(!b||!activityData||!adminToken)return;if(b.classList.contains('stats-export'))activityDownload(b.parentElement.querySelector('table'),b.dataset.title);if(b.classList.contains('stats-sort')){const title=b.dataset.title,col=Number(b.dataset.col),prev=statsSort.get(title);statsSort.set(title,{col,dir:prev?.col===col?-prev.dir:1});renderActivity();}}));


// v0.15.10: 総合分析。既存の管理者APIのみを使用し、本文や個人の学習内容は取得しない。
let overviewData=null,overviewSeq=0,overviewSheets=[];
const showStatsTab=tab=>{for(const t of ['overview','explore','activity']){$('#stats-'+t+'-view').classList.toggle('hidden',t!==tab);$('#stats-tab-'+t).setAttribute('aria-pressed',String(t===tab));}};
const clearOverview=()=>{overviewSeq++;overviewData=null;overviewSheets=[];$('#overview-content').replaceChildren();$('#overview-resident').replaceChildren(new Option('全住人',''));$('#overview-scope').textContent='';$('#overview-excel').disabled=true;$('#overview-refresh').disabled=false;$('#overview-from').value='';$('#overview-to').value='';};
const renderOverview=()=>{
 const d=overviewData?.activity,c=overviewData?.cave,forest=overviewData?.forest,sea=overviewData?.sea,food=overviewData?.food;if(!d||!c||!forest||!sea||!food)return;
 const events=activityRows(d),f=d.filters,people=d.residents.filter(r=>!f.resident||r.id===f.resident),names=new Map(d.residents.map(r=>[r.id,r.name])),npcNames=new Map(d.npcs.map(r=>[r.id,r.name]));
 const keys=Object.keys(activityLabels),days=[...new Set(events.map(r=>r.day))].filter(Boolean).sort(),active=new Set(events.map(r=>r.resident_id));
 const count=(rows,k)=>activitySum(rows.filter(r=>r.key===k));
 const totals=keys.map(k=>[activityLabels[k],count(events,k),new Set(events.filter(r=>r.key===k).map(r=>r.resident_id)).size]);
 const hourly=Array.from({length:7},()=>Array.from({length:24},()=>new Set()));
 for(const r of events){if(!r.day||r.hour===null||!Number.isInteger(r.hour)||r.hour<0||r.hour>23)continue;const weekday=(new Date(r.day+'T00:00:00Z').getUTCDay()+6)%7;if(Number.isInteger(weekday))hourly[weekday][r.hour].add(r.resident_id);}
 const week=['月','火','水','木','金','土','日'],heat=hourly.map((row,i)=>[week[i],...row.map(s=>s.size)]),max=Math.max(1,...heat.flatMap(r=>r.slice(1)));
 const daily=days.map(day=>{const e=events.filter(r=>r.day===day);return [day,new Set(e.map(r=>r.resident_id)).size,...keys.map(k=>count(e,k))];});
 const byPerson=people.map(p=>{const e=events.filter(r=>r.resident_id===p.id);return [p.name,new Set(e.map(r=>r.day)).size,...keys.map(k=>count(e,k)),jstDate(e.map(r=>r.last_at).sort().at(-1))];});
 const npcRows=d.npcs.map(n=>{const e=events.filter(r=>r.npc_id===n.id),rel=d.relationships.filter(r=>r.npc_id===n.id&&r.first_met_at);return [n.name,new Set(e.map(r=>r.resident_id)).size,...keys.filter(k=>!['gather','donate','send','receive'].includes(k)).map(k=>count(e,k)),rel.length?Math.round(rel.reduce((s,r)=>s+Number(r.affinity||1),0)/rel.length*100)/100:'—',d.names.filter(r=>r.npc_id===n.id).length];});
 const rel=d.relationships.filter(r=>r.first_met_at),aff=rel.map(r=>[names.get(r.resident_id)||'不明',npcNames.get(r.npc_id)||r.npc_id,Number(r.affinity_points||0),Number(r.affinity||1)]);
 const g=[...c.details,...c.legacy],mat=c.catalog.map(m=>[m.name,m.rarity,statsSum(g.filter(r=>r.item_id===m.id),'quantity'),statsSum(c.donations.filter(r=>r.item_id===m.id),'quantity')]);
 const areas=c.areas.map(a=>[a.name,statsSum(c.attempts.filter(r=>r.section_id===a.id),'attempts'),statsSum(c.donations.filter(r=>r.section_id===a.id),'quantity')]);
 const quest=c.areas.map(a=>[a.name,statsSum(c.requirements.filter(r=>r.section_id===a.id),'needed'),statsSum(c.requirements.filter(r=>r.section_id===a.id),'donated'),statsSum(c.plan.filter(r=>r.sectionId===a.id),'needed')]);
 const quota=d.quota.map(r=>[r.day,names.get(r.resident_id)||'不明',npcNames.get(r.npc_id)||r.npc_id,Number(r.used)]);
 const kpis=[['登録住人（現在・全体）',d.residents.length],['活動住人',active.size],['活動日数',days.length],['採取回数',count(events,'gather')],['釣り挑戦',sea.summary.attempts],['釣り成功',sea.summary.won],['釣り失敗',sea.summary.lost],['選択式会話',count(events,'chat')],['自由会話記録',count(events,'ai')],['AI使用枠消費',statsSum(d.quota,'used')],['食事',count(events,'feed')],['お願い達成',count(events,'complete')]];
 const scope=`${f.from||'開始'} ～ ${f.to||'現在'} / ${names.get(f.resident)||'全住人'}（JST）`;
 $('#overview-scope').textContent='適用中：'+scope;
 overviewSheets=[['集計条件',['項目','値'],[['期間開始（JST）',f.from||'開始'],['期間終了（JST）',f.to||'現在'],['住人',names.get(f.resident)||'全住人'],['出力基準','操作記録。実働時間・ログイン数ではない'],['時刻ヒートマップ','曜日×時刻の期間内ユニーク住人数'],['現況指標','登録数・親密度・クエストは現在値'],['NPC自律活動','住人条件対象外'],['旧素材記録','複数獲得の先頭のみのことがある'],['出力日時',jstDate(new Date().toISOString())]]],['総合サマリー',['指標','値'],kpis],['機能別利用',['機能','操作記録数','利用住人数'],totals],['曜日時間帯',['曜日',...Array.from({length:24},(_,i)=>i+'時')],heat],['日別活動',['日付','活動住人数',...keys.map(k=>activityLabels[k])],daily],['住人別活動',['住人','活動日数',...keys.map(k=>activityLabels[k]),'最終活動（JST）'],byPerson],['NPC別交流',['NPC','交流住人数',...keys.filter(k=>!['gather','donate','send','receive'].includes(k)).map(k=>activityLabels[k]),'平均親密度（現在）','名前を覚えた住人数（現在）'],npcRows],['親密度（現在）',['住人','NPC','ポイント','レベル'],aff],['洞窟・素材別',['素材','レア度','獲得個数','納品個数'],mat],['洞窟・区画別',['区画','採取回数','納品個数'],areas],['クエスト（全体現在）',['区画','必要数','納品済','次回必要数'],quest],['AI使用枠',['日付','住人','NPC','使用枠'],quota],['日記（住人条件外）',['日付','NPC','生成方式','件数'],d.diaries.map(r=>[r.day,npcNames.get(r.npc_id)||r.npc_id,r.source==='ai'?'AI':'定型',Number(r.count)])],['自律生活（住人条件外）',['日付','NPC','行動','件数'],d.life.map(r=>[r.day,npcNames.get(r.npc_id)||r.npc_id,r.action,Number(r.count)])]];
 // Separate forest sheets preserve cave-specific quest and legacy statistics.
 const forestRows=forest.rows,forestMat=forest.catalog.map(m=>[m.name,m.rarity,statsSum(forestRows.filter(r=>r.item_id===m.id),'quantity'),statsSum(forestRows.filter(r=>r.item_id===m.id),'hits')]);
 const forestAreas=forest.areas.map(a=>[a.name,statsSum(forestRows.filter(r=>r.area_id===a.id),'hits'),statsSum(forestRows.filter(r=>r.area_id===a.id),'quantity')]);
 const forestSpots=forest.areas.flatMap(a=>a.spots.map(sp=>{const rows=forestRows.filter(r=>r.area_id===a.id&&r.spot_id===sp.id);return [a.name,sp.name,statsSum(rows,'hits'),statsSum(rows,'quantity')];}));
 const forestOdds=forest.areas.flatMap(a=>a.spots.flatMap(sp=>{const rows=forestRows.filter(r=>r.area_id===a.id&&r.spot_id===sp.id),n=statsSum(rows,'hits'),normal=sp.groups.normal,rare=sp.groups.rare,sum=normal.reduce((v,m)=>v+m.value,0);let survival=1;const odds=new Map();for(const m of rare){odds.set(m.id,survival*m.value/100);survival*=1-m.value/100;}for(const m of normal)odds.set(m.id,sum?survival*m.value/sum:0);const ids=new Set([...odds.keys(),...rows.map(r=>r.item_id)]);return [...ids].map(id=>[a.name,sp.name,forest.catalog.find(m=>m.id===id)?.name||id,((odds.get(id)||0)*100).toFixed(2)+'%',n?(100*statsSum(rows.filter(r=>r.item_id===id),'hits')/n).toFixed(2)+'%':'—',n]);}));
 overviewSheets.push(['森・素材別',['素材','レア度','獲得個数','獲得回数'],forestMat],['森・区画別',['区画','採取回数','獲得個数'],forestAreas],['森・採取場所別',['区画','採取場所','採取回数','獲得個数'],forestSpots],['森・設定と実績',['区画','採取場所','素材','現在の設定率','記録上の獲得率','採取回数'],forestOdds]);
 const seaNames=new Map(d.residents.map(r=>[r.id,r.name]));
 const foodRows=food.foods.map(x=>[x.npcId==='paper'?'黄色い獣':'赤色の獣',x.name,x.kind==='meal'?'ごはん':'おやつ',x.restore,x.enabled?'有効':'無効']);
 overviewSheets.push(['食材の回復量（現在）',['NPC','食材','区分','空腹度の回復','状態'],foodRows]);
 overviewSheets.push(['海・釣り概要',['項目','回数'],[
 ['挑戦',sea.summary.attempts],['成功',sea.summary.won],['失敗',sea.summary.lost],['中断',sea.summary.cancelled],['進行中',sea.summary.active],['みみず使用挑戦',sea.summary.worm],['挑戦住人数',sea.summary.uniqueResidents],
 ['成功率（決着済み成功・失敗のみ）',sea.summary.won+sea.summary.lost?+(100*sea.summary.won/(sea.summary.won+sea.summary.lost)).toFixed(2):0]]],
 ['海・住人別',['住人','挑戦','成功','失敗','中断','進行中','みみず使用'],sea.residents.map(r=>[seaNames.get(r.residentId)||'不明',r.attempts,r.won,r.lost,r.cancelled,r.active,r.worm])],
 ['海・日別',['日付（JST）','挑戦','成功','失敗','中断','進行中','みみず使用'],sea.daily.map(r=>[r.day,r.attempts,r.won,r.lost,r.cancelled,r.active,r.worm])],
 ['海・釣果レア度',['レア度','成功回数'],sea.rarities.map(r=>['★'+r.rarity,r.count])],
 ['海・釣果別',['釣果','成功回数'],sea.catches.map(r=>[r.name,r.count])]);
 const heatHtml=`<section class="stats-chart overview-heat"><h3>曜日・時間帯別の活動住人数（JST）</h3><p class="stats-note">期間中に各曜日・時間帯で1回以上操作した住人の重複なし人数。ログイン・滞在時間ではありません。</p><div class="stats-scroll"><table><thead><tr><th>曜日</th>${Array.from({length:24},(_,i)=>`<th>${i}時</th>`).join('')}</tr></thead><tbody>${heat.map(r=>`<tr><th>${r[0]}</th>${r.slice(1).map(n=>`<td style="background:rgba(217,179,126,${n/max*.72});color:${n/max>.65?'#191a2b':'inherit'}">${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
 $('#overview-content').innerHTML=`<p class="stats-note">食材回復量は現在の設定値であり、日付・住人による絞り込みの対象外です。料理の腹持ち効果は正面の扉で実装予定（未有効）。</p><p class="stats-note">探索・交流の横断集計。操作回数は機能によって所要時間が異なります。住人条件は現在の登録数・共同開拓全体・NPC自律活動には適用されません。</p><div class="stats-kpis">${kpis.map(([k,v])=>`<div><small>${safe(k)}</small><strong>${v.toLocaleString('ja-JP')}</strong></div>`).join('')}</div><div class="stats-charts">${statsBars('機能別利用住人数',totals.map(r=>[r[0],r[2]]))}${statsBars('NPC交流操作数（採取除外）',totals.filter(r=>!['採取','共同納品操作','住人への贈り物送付','住人からの贈り物受取'].includes(r[0])).map(r=>r.slice(0,2)))}${statsBars('日別活動住人数（直近30活動日）',daily.slice(-30).map(r=>r.slice(0,2)))}${statsBars('日別AI使用枠（直近30活動日）',[...new Set(quota.map(r=>r[0]))].sort().slice(-30).map(day=>[day,quota.filter(r=>r[0]===day).reduce((s,r)=>s+r[3],0)]))}</div>${heatHtml}<p class="stats-note">親密度は現在値。素材獲得記録は旧ログの不足を含む場合があります。自由会話記録とAI使用枠は別指標です。</p>`+overviewSheets.slice(2).filter(([title])=>title!=='曜日時間帯').map(([title,h,r])=>statsTable('総合：'+title,h,r)).join('');
 $('#overview-excel').disabled=false;
};
const loadOverview=async()=>{const seq=++overviewSeq,b=$('#overview-refresh');b.disabled=true;$('#overview-excel').disabled=true;overviewData=null;overviewSheets=[];$('#overview-content').replaceChildren();$('#overview-scope').textContent='集計中…';try{const q=new URLSearchParams({from:$('#overview-from').value,to:$('#overview-to').value,resident:$('#overview-resident').value});const [activity,cave,forest,sea,food]=await Promise.all([adminApi('/activity-statistics?'+q+'&hourly=1'),adminApi('/cave-statistics?'+q),adminApi('/forest-statistics?'+q),adminApi('/sea-statistics?'+q),adminApi('/food-reference')]);if(seq!==overviewSeq||!adminToken)return;overviewData={activity,cave,forest,sea,food};$('#overview-resident').replaceChildren(new Option('全住人',''),...activity.residents.map(r=>new Option(r.name,r.id)));$('#overview-resident').value=activity.filters.resident;renderOverview();}catch(e){if(seq===overviewSeq)$('#overview-scope').textContent='集計できませんでした。';throw e;}finally{if(seq===overviewSeq)b.disabled=false;}};
bind('#stats-tab-overview',async()=>{showStatsTab('overview');await loadOverview();});bind('#overview-refresh',loadOverview);bind('#overview-reset',async()=>{for(const id of ['overview-from','overview-to','overview-resident'])$('#'+id).value='';await loadOverview();});
$('#overview-content').addEventListener('click',handler(async e=>{const b=e.target.closest('button');if(!b||!overviewData||!adminToken)return;if(b.classList.contains('stats-sort')){const title=b.dataset.title,col=Number(b.dataset.col),prev=statsSort.get(title);statsSort.set(title,{col,dir:prev?.col===col?-prev.dir:1});renderOverview();}if(b.classList.contains('stats-export')){const table=b.parentElement.querySelector('table'),f=overviewData.activity.filters;const lines=[...table.rows].map((r,i)=>[...r.cells].map(c=>c.dataset.export??c.textContent.trim()).concat(i===0?['集計期間（JST）','住人条件']: [b.dataset.title.includes('全体現在')||b.dataset.title.includes('親密度')?'現在':`${f.from||'開始'}〜${f.to||'現在'}`,b.dataset.title.includes('住人条件外')||b.dataset.title.includes('全体現在')?'対象外':overviewData.activity.residents.find(x=>x.id===f.resident)?.name||'全住人']).map(statsCsvCell).join(','));saveOverviewFile(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),b.dataset.title.replace(/[\\/:*?"<>|]/g,'_')+'.csv');}}));
// XLSX（Office Open XML）を外部ライブラリなしで構築。セルは数値または明示的な文字列で、数式は生成しない。
const overviewXml=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const overviewZip=files=>{const enc=new TextEncoder(),parts=[],central=[];let offset=0,centralSize=0;const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};for(const [name,xml] of files){const n=enc.encode(name),data=enc.encode(xml),sum=crc(data);const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);parts.push(h,data);const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);central.push(ch);centralSize+=ch.length;offset+=h.length+data.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});};
const overviewWorkbook=sheets=>{const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rn='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pn='http://schemas.openxmlformats.org/package/2006/relationships',ct='http://schemas.openxmlformats.org/package/2006/content-types';const head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};const files=[['[Content_Types].xml',head+`<Types xmlns="${ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels',head+`<Relationships xmlns="${pn}"><Relationship Id="rId1" Type="${rn}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',head+`<workbook xmlns="${ns}" xmlns:r="${rn}"><sheets>${sheets.map(([name],i)=>`<sheet name="${overviewXml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],['xl/_rels/workbook.xml.rels',head+`<Relationships xmlns="${pn}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rn}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rn}/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',head+`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF29283C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]];sheets.forEach(([name,headers,rows],i)=>{const pref=statsSort.get('総合：'+name),sorted=[...rows];if(pref)sorted.sort((a,b)=>statsCompare(a[pref.col],b[pref.col])*pref.dir);const all=[headers,...sorted],range=`A1:${col(headers.length-1)}${all.length}`;files.push([`xl/worksheets/sheet${i+1}.xml`,head+`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${headers.map((h,j)=>`<col min="${j+1}" max="${j+1}" width="${Math.min(40,Math.max(12,String(h).length*2+4,j===0?25:12))}" customWidth="1"/>`).join('')}</cols><sheetData>${all.map((r,j)=>`<row r="${j+1}">${r.map((x,k)=>{const ref=col(k)+(j+1);return typeof x==='number'&&Number.isFinite(x)?`<c r="${ref}"><v>${x}</v></c>`:`<c r="${ref}"${j===0?' s="1"':''} t="inlineStr"><is><t xml:space="preserve">${overviewXml(x)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><autoFilter ref="${range}"/></worksheet>`]);});return overviewZip(files);};
const saveOverviewFile=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);};
bind('#overview-excel',()=>{if(!overviewData||!adminToken||!overviewSheets.length)return;const f=overviewData.activity.filters;overviewSheets[0][2].find(r=>r[0]==='出力日時')[1]=jstDate(new Date().toISOString());saveOverviewFile(overviewWorkbook(overviewSheets),`kagariso_総合分析_${f.from||'開始'}-${f.to||'現在'}_${new Date(Date.now()+9*3600000).toISOString().slice(0,19).replace(/[:T]/g,'-')}_JST.xlsx`);});


// v0.17.0.9: A dedicated red-beast editor safely coexists with the original paper editor.
let pyoroAdminLoadedNpc=null;
let pyoroAdminSection='topics',pyoroAdminRows=[],pyoroAdminSelected=null;
const pyoroAdminSections=new Set(['topics','requests','gifts','foods','profile']);
const pyoroAdminInput=(key,v,multiline=false,opts={})=>{
 const id='pyoro-field-'+key, label=opts.label||key;
 if(opts.checkbox)return `<label class="admin-enabled"><input id="${id}" type="checkbox" ${v?'checked':''}> ${safe(label)}</label>`;
 if(opts.select)return `<label for="${id}">${safe(label)}</label><select id="${id}">${opts.select.map(([val,name])=>`<option value="${safe(val)}" ${val===v?'selected':''}>${safe(name)}</option>`).join('')}</select>`;
 const settings=opts.number?`type="number" min="${opts.min??1}" max="${opts.max??99}"`:'type="text"';
 const html=multiline?`<textarea id="${id}" rows="${opts.rows||3}" maxlength="${opts.maxlength||3000}" required>${safe(v??'')}</textarea>`:`<input id="${id}" ${settings} value="${safe(v??'')}" maxlength="${opts.maxlength||500}" required>`;
 return `<label for="${id}">${safe(label)}</label>${html}`;
};
const pyoroAdminValue=(k)=>$('#pyoro-field-'+k).value;
const pyoroAdminCheckbox=(k)=>$('#pyoro-field-'+k).checked;
const pyoroAdminFields=()=>{
 const r=pyoroAdminSelected,el=$('#pyoro-admin-fields');
 if(!r){el.textContent='設定を選んでください。';$('#pyoro-admin-save').disabled=true;return;}
 $('#pyoro-admin-save').disabled=false;
 let html=pyoroAdminSection==='foods'?`<h3>${safe(r.name)}</h3>`:`<p class="muted tiny">ID: ${safe(r.id)}</p>`;
 const grid=(...fields)=>'<div class="admin-fields-grid">'+fields.map(f=>'<div>'+f+'</div>').join('')+'</div>';
 const readonly=(label,value)=>`<label>${safe(label)}</label><input type="text" value="${safe(value)}" disabled>`;
 if(pyoroAdminSection==='topics'){
  html+=pyoroAdminInput('label',r.label,false,{label:'住人の選択肢',maxlength:90})+grid(readonly('カテゴリ','日常（現在は固定）'),pyoroAdminInput('condition',r.condition||'any',false,{label:'話題の出現条件',select:adminConditionOptions}),pyoroAdminInput('minAffinity',r.minAffinity||1,false,{label:'必要な親密度（♡）',number:true,min:1,max:10}),pyoroAdminInput('weight',r.weight||1,false,{label:'抽選の重み（1〜10）',number:true,min:1,max:10}));
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'抽選対象として有効にする',checkbox:true});
  html+='<div class="section-top"><h3>赤色の獣の返答と条件</h3><p class="muted tiny">「条件なし」の返答を最低1つ用意してね。</p></div><div id="pyoro-reply-list"></div><button type="button" id="pyoro-add-reply" class="secondary small">＋ 返答を追加</button><div id="pyoro-topic-preview" class="admin-preview"></div>';
 }
 if(pyoroAdminSection==='requests'){
  html+=pyoroAdminInput('title',r.title,false,{label:'お願いの名前'})+pyoroAdminInput('description',r.description,true,{label:'お願いの説明',maxlength:400});
  html+=pyoroAdminInput('acceptText',r.acceptText||'「お、おう！ じゃあ、おまえにたのむぞ！」',true,{label:'引き受けたときの台詞',rows:2,maxlength:260})+pyoroAdminInput('completeText',r.completeText||'「おぉ！ ありがとな！ ……おれいは、ちゃんとつくってからわたすからな！」',true,{label:'達成したときの台詞',rows:2,maxlength:260});
  html+=grid(readonly('難易度','未対応'),readonly('必要な洞窟エリア','未対応'),readonly('出現形式','日替わり抽選（固定）'),pyoroAdminInput('giftKind',r.giftKind,false,{label:'お礼の種類',select:[['food','食べ物'],['craft','工作'],['decoration','装飾']]}));
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'お願いの候補として有効',checkbox:true});
  html+='<h3>必要素材（最大6種類）</h3><p class="muted tiny">受注中のお願いは、必要素材を変更できません。</p>';
  html+='<div id="pyoro-admin-materials"></div><button type="button" class="secondary small" id="pyoro-admin-add-material">＋ 素材を追加</button>';
 }
 if(pyoroAdminSection==='gifts'){
  html=readonly('返礼品ID（変更不可）',r.id)+pyoroAdminInput('name',r.name,false,{label:'返礼品の名前',maxlength:90})+pyoroAdminInput('description',r.description,true,{label:'説明文',maxlength:500});
  html+=pyoroAdminInput('image',r.image,false,{label:'画像のパス（GitHubに先に配置）',maxlength:160});
  html+='<p class="muted tiny">画像は images/gifts/pyoro/ にWebPで配置してね。</p><div class="admin-gift-preview"><img id="pyoro-gift-preview-img" alt="画像プレビュー"><strong id="pyoro-gift-preview-title"></strong></div>';
  html+=grid(readonly('お礼の系統',({food:'食べ物',craft:'工作',decoration:'装飾'})[r.giftKind]||r.giftKind),readonly('品質',r.quality==='good'?'成功作':'失敗作'),readonly('抽選の重み','未対応（成功率80％・失敗率20％固定）'),readonly('抽選対象として有効','固定'));
 }
 if(pyoroAdminSection==='foods'){
  html+=`<p class="muted tiny">区分：${r.kind==='meal'?'ごはん':'おやつ'}（${r.source==='recipe'?'料理':'素材'}・区分は変更不可）</p>`;
  html+=pyoroAdminInput('restore',r.restore,false,{label:'空腹度の回復量',number:true,min:1,max:100});
  html+=pyoroAdminInput('reply',r.reply,true,{label:'食べたときの返答',maxlength:260});
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'この食材を有効にする',checkbox:true});
 }
 if(pyoroAdminSection==='profile'){
  html+=pyoroAdminInput('name',r.name,false,{label:'表示名'})+pyoroAdminInput('description',r.description,true,{label:'プロフィールの説明',maxlength:500});
  html+=pyoroAdminInput('personality',r.personality,true,{label:'プロフィールの性格',maxlength:600});
  html+=pyoroAdminInput('prompt',r.prompt,true,{label:'基本人格・口調（現在は一括編集）',rows:8,maxlength:3000});
  html+='<p class="muted tiny">一人称・二人称・好み・会話のお手本は現在この文章で管理します。個別編集と人格テストは未対応です。</p><h3>生活リズム（日本時間）</h3>';
  html+=pyoroAdminInput('hungerMinutes',Math.round(Number(r.hungerIntervalMs||180000)/60000),false,{label:'空腹度が+1になるまで（分）',number:true,min:1,max:60});
  html+=pyoroAdminInput('sleepStart',r.sleepStart??23,false,{label:'睡眠開始時刻（時）',number:true,min:0,max:23});
  html+=pyoroAdminInput('sleepEnd',r.sleepEnd??7,false,{label:'起床時刻（時）',number:true,min:0,max:23});
  html+=pyoroAdminInput('restStart',r.restStart??19,false,{label:'休憩開始時刻（時）',number:true,min:0,max:23});
  html+=`<p class="muted tiny">現在の生活状態：${safe(r.life?`空腹 ${r.life.hunger} / 体力 ${r.life.energy} / 機嫌 ${r.life.mood} / ${r.life.activity}`:'発見前のため未開始')}。この画面から現在値を初期化しません。</p>`;
 }
 el.innerHTML=html;
 if(pyoroAdminSection==='gifts'){const preview=()=>{const img=$('#pyoro-gift-preview-img'),path=pyoroAdminValue('image').trim();img.classList.toggle('hidden',!path);if(path){img.onerror=()=>img.classList.add('hidden');img.src=encodeURI(path);}$('#pyoro-gift-preview-title').textContent=pyoroAdminValue('name')||'返礼品名';};for(const k of ['image','name'])$('#pyoro-field-'+k).addEventListener('input',preview);preview();}
 if(pyoroAdminSection==='topics'){
  r.replies=r.replies||[{when:'any',text:r.response||''}];
  const list=$('#pyoro-reply-list'),add=$('#pyoro-add-reply');const preview=()=>{$('#pyoro-topic-preview').textContent=`住人：「${pyoroAdminValue('label')||'（質問）'}」\n赤色の獣：${r.replies[0]?.text||'（返答）'}`;};$('#pyoro-field-label').addEventListener('input',preview);
  const draw=()=>{list.replaceChildren();r.replies.forEach((reply,i)=>{const row=document.createElement('div');row.className='admin-reply-row';const select=document.createElement('select');select.innerHTML=makeSelectOptions(adminConditionOptions,reply.when);select.value=reply.when;select.onchange=()=>{reply.when=select.value;preview();};const text=document.createElement('textarea');text.value=reply.text;text.rows=2;text.maxLength=260;text.required=true;text.oninput=()=>{reply.text=text.value;preview();};const del=document.createElement('button');del.type='button';del.className='secondary small';del.textContent='この返答を削除';del.disabled=r.replies.length<=1;del.onclick=()=>{r.replies.splice(i,1);draw();};row.append(select,text,del);list.append(row);});add.disabled=r.replies.length>=8;preview();};
  draw();add.onclick=()=>{if(r.replies.length<8){r.replies.push({when:'any',text:''});draw();}};
 }
 if(pyoroAdminSection==='requests'){
  const list=$('#pyoro-admin-materials');
  const draw=()=>{list.replaceChildren();r.items.forEach((item,i)=>{const row=document.createElement('div');row.className='admin-request-item-row';const sel=document.createElement('select');sel.dataset.pyoroMaterialId=i;sel.innerHTML=makeSelectOptions(ADMIN_MATERIALS,item.id);if(!Array.from(sel.options).some(o=>o.value===item.id))sel.add(new Option(item.id,item.id));sel.value=item.id;sel.onchange=()=>item.id=sel.value;const qty=document.createElement('input');qty.type='number';qty.min=1;qty.max=99;qty.required=true;qty.value=item.needed;qty.dataset.pyoroMaterialNeeded=i;qty.oninput=()=>item.needed=Number(qty.value);const del=document.createElement('button');del.type='button';del.className='secondary small';del.textContent='削除';del.disabled=r.items.length<=1;del.onclick=()=>{r.items.splice(i,1);draw();};row.append(sel,qty,del);list.append(row);});$('#pyoro-admin-add-material').disabled=r.items.length>=6;};
  draw();$('#pyoro-admin-add-material').onclick=()=>{if(r.items.length<6){r.items.push({id:ADMIN_MATERIALS.find(x=>!r.items.some(i=>i.id===x[0]))?.[0]||ADMIN_MATERIALS[0][0],needed:1});draw();}};
 }
};
const pyoroAdminList=()=>{
 const list=$('#pyoro-admin-list'),q=$('#pyoro-admin-search').value.trim().toLowerCase();list.replaceChildren();
 const visible=pyoroAdminRows.filter(r=>`${r.id} ${r.name||r.label||r.title||''}`.toLowerCase().includes(q));
 $('#pyoro-admin-count').textContent=`${visible.length} / ${pyoroAdminRows.length}件`;
 visible.forEach(r=>{const b=document.createElement('button');b.className='secondary small admin-topic-button';b.type='button';b.textContent=`${r.enabled===0||r.enabled===false?'［無効］':''}${r.name||r.label||r.title||r.id}${pyoroAdminSection==='gifts'?' ('+r.id+')':''}`;
 if(pyoroAdminSelected?.id===r.id&&pyoroAdminSelected?.source===r.source)b.classList.add('admin-selected');b.onclick=()=>{pyoroAdminSelected=structuredClone(r);pyoroAdminFields();pyoroAdminList();};list.append(b);});
};
const pyoroAdminLoad=async()=>{
 const section=pyoroAdminSection,npc=editorNpc();const data=await adminApi(section==='foods'?'/npc-foods?npcId='+npc:'/pyoro/config?section='+encodeURIComponent(section));
 if(npc!==editorNpc()||(npc!=='pyoro'&&section!=='foods')||section!==pyoroAdminSection||$('#admin-pyoro-panel').classList.contains('hidden'))return;
 pyoroAdminLoadedNpc=npc;pyoroAdminRows=data.items||[];
 pyoroAdminSelected=structuredClone(pyoroAdminRows.find(r=>r.id===pyoroAdminSelected?.id&&r.source===pyoroAdminSelected?.source)||pyoroAdminRows[0]||null);
 $('#pyoro-admin-title').textContent={topics:'会話内容の編集',requests:'お願いの編集',gifts:'返礼品の編集',foods:'食事・おやつの編集',profile:'AI人格エディター'}[pyoroAdminSection];
 $('#pyoro-admin-search-label').textContent={topics:'話題を検索',requests:'お願いを検索',gifts:'返礼品を検索',foods:'食材を検索',profile:'設定を検索'}[pyoroAdminSection];
 $('#pyoro-admin-search').placeholder={topics:'質問・IDで検索',requests:'依頼名で検索',gifts:'名前・返礼品IDで検索',foods:'食材名・料理名で検索',profile:''}[pyoroAdminSection];
 $('#pyoro-admin-save').textContent={topics:'変更を保存',requests:'お願いを保存',gifts:'返礼品を保存',foods:'設定を保存',profile:'人格設定を保存'}[pyoroAdminSection];
 $('#pyoro-admin-save').classList.toggle('admin-request-save',['requests','gifts'].includes(pyoroAdminSection));
 $('#pyoro-admin-sidebar').classList.toggle('hidden',pyoroAdminSection==='profile');$('#pyoro-admin-layout').classList.toggle('profile-layout',pyoroAdminSection==='profile');$('#pyoro-profile-refresh').classList.toggle('hidden',pyoroAdminSection!=='profile');
 $('#pyoro-admin-new-topic').classList.toggle('hidden',!['topics','requests'].includes(pyoroAdminSection));$('#pyoro-admin-new-topic').textContent=pyoroAdminSection==='requests'?'＋ 新しいお願い':'＋ 新しい話題';
 $('#pyoro-admin-note').textContent={topics:'話題はランダム3択から表示されます。',requests:'受注中の必要素材・返礼品ジャンルは変更できません。',gifts:'6種類の成功作・失敗作を個別に編集できます。ID・品質・制作確率は固定です。',foods:'選択中のNPCの食材・料理の回復量、返答、有効状態を編集します。',profile:'赤色の獣のプロフィールとAI人格を編集します。現在の生活状態は変更しません。'}[pyoroAdminSection];
 $('#pyoro-admin-history-title').textContent={topics:'管理者の編集履歴（直近100件）',requests:'お願い編集履歴（直近100件）',gifts:'返礼品編集履歴（直近100件）',foods:'編集履歴',profile:'編集履歴'}[pyoroAdminSection];
 pyoroAdminList();pyoroAdminFields();
};
const pyoroAdminShow=async(section='topics')=>{
 if(!pyoroAdminSections.has(section))return;
 pyoroAdminLoadedNpc=null;pyoroAdminSection=section;pyoroAdminSelected=null;$('#pyoro-admin-search').value='';$('#pyoro-admin-audit').replaceChildren();$('#admin-sea-panel').classList.add('hidden');$('#admin-recovery-panel').classList.add('hidden');clearAdminRecovery();
 for(const id of ['admin-stats-panel','admin-quest-panel','admin-material-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel'])$('#'+id).classList.add('hidden');
 $('#admin-pyoro-panel').classList.remove('hidden');
 await pyoroAdminLoad();
};
const syncAdminNpc=()=>{const red=$('#admin-npc-target').value==='pyoro';$('#admin-current-npc').textContent=red?'赤色の獣':'黄色い獣';$('#admin-show-pyoro-foods').classList.remove('hidden');};
$('#admin-npc-target').addEventListener('change',handler(async()=>{
 syncAdminNpc();if(!$('#admin-clothing-panel').classList.contains('hidden'))return;if(!$('#admin-ai-panel').classList.contains('hidden')){await loadAiProfile();return;}if(!$('#admin-pyoro-panel').classList.contains('hidden')&&pyoroAdminSection==='foods'){await pyoroAdminShow('foods');return;}if($('#admin-npc-target').value==='pyoro'){const section=!$('#admin-requests-panel').classList.contains('hidden')?'requests':!$('#admin-gifts-panel').classList.contains('hidden')?'gifts':!$('#admin-ai-panel').classList.contains('hidden')?'profile':'topics';await pyoroAdminShow(section);}
 else{const section=pyoroAdminSection;await openAdminEditor();const button={requests:'admin-show-request-editor',gifts:'admin-show-gift-editor',profile:'admin-show-ai-editor'}[section];if(button)$('#'+button).click();}
}));
// Prevent the original paper-only editors from running when editing pyoro.
const pyoroAdminRoute={
 'admin-show-dialogue-editor':'topics','admin-show-request-editor':'requests',
 'admin-show-gift-editor':'gifts','admin-show-pyoro-foods':'foods'
};
for(const [id,section] of Object.entries(pyoroAdminRoute)){
 $('#'+id).addEventListener('click',e=>{
  if($('#admin-npc-target').value!=='pyoro'&&section!=='foods'){$('#admin-pyoro-panel').classList.add('hidden');return;}
  e.stopImmediatePropagation();e.preventDefault();
  pyoroAdminShow(section).catch(error=>toast(error.message||'読み込めませんでした。'));
 },true);
}
for(const id of ['admin-show-material-editor','admin-show-quest-editor','admin-show-stats']){
 $('#'+id).addEventListener('click',()=>$('#admin-pyoro-panel').classList.add('hidden'));
}
bind('#pyoro-profile-refresh',pyoroAdminLoad);
$('#pyoro-admin-search').addEventListener('input',pyoroAdminList);
bind('#pyoro-admin-refresh',pyoroAdminLoad);
bind('#pyoro-admin-new-topic',()=>{
 const id='topic_'+Date.now().toString(36);
 pyoroAdminSelected=pyoroAdminSection==='requests'?{id:'request_'+Date.now().toString(36),title:'',description:'',giftKind:'food',enabled:1,items:[{id:ADMIN_MATERIALS[0][0],needed:1}]}:{id,label:'',response:'',enabled:1};
 pyoroAdminFields();pyoroAdminList();
});
$('#pyoro-admin-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();if(!pyoroAdminSelected)return;
 const body={section:pyoroAdminSection,id:pyoroAdminSelected.id};
 if(pyoroAdminSection==='topics')Object.assign(body,{label:pyoroAdminValue('label'),replies:pyoroAdminSelected.replies,condition:pyoroAdminValue('condition'),minAffinity:Number(pyoroAdminValue('minAffinity')),weight:Number(pyoroAdminValue('weight')),enabled:pyoroAdminCheckbox('enabled')});
 if(pyoroAdminSection==='requests')Object.assign(body,{title:pyoroAdminValue('title'),description:pyoroAdminValue('description'),acceptText:pyoroAdminValue('acceptText'),completeText:pyoroAdminValue('completeText'),giftKind:pyoroAdminValue('giftKind'),enabled:pyoroAdminCheckbox('enabled'),items:(pyoroAdminSelected.items||[]).map((x,i)=>({id:$(`[data-pyoro-material-id="${i}"]`).value.trim(),needed:Number($(`[data-pyoro-material-needed="${i}"]`).value)}))});
 if(pyoroAdminSection==='gifts')Object.assign(body,{name:pyoroAdminValue('name'),description:pyoroAdminValue('description'),image:pyoroAdminValue('image')});
 if(pyoroAdminSection==='foods'&&pyoroAdminLoadedNpc!==editorNpc())return;
 if(pyoroAdminSection==='foods')Object.assign(body,{npcId:editorNpc(),source:pyoroAdminSelected.source,restore:Number(pyoroAdminValue('restore')),reply:pyoroAdminValue('reply'),enabled:pyoroAdminCheckbox('enabled')});
 if(pyoroAdminSection==='profile')Object.assign(body,{name:pyoroAdminValue('name'),description:pyoroAdminValue('description'),personality:pyoroAdminValue('personality'),prompt:pyoroAdminValue('prompt'),hungerMinutes:Number(pyoroAdminValue('hungerMinutes')),sleepStart:Number(pyoroAdminValue('sleepStart')),sleepEnd:Number(pyoroAdminValue('sleepEnd')),restStart:Number(pyoroAdminValue('restStart'))});
 const b=$('#pyoro-admin-save');b.disabled=true;
 try{await adminApi(body.section==='foods'?'/npc-foods/save':'/pyoro/config/save','POST',body);await pyoroAdminLoad();toast('NPCの設定を保存しました。');}
 finally{b.disabled=false;}
}));
bind('#pyoro-admin-audit-refresh',async()=>{
 const {history}=await adminApi('/pyoro/audit');
 $('#pyoro-admin-audit').replaceChildren(...history.filter(x=>pyoroAdminSection!=='foods'||(x.section==='foods'&&(String(x.target_id).startsWith(editorNpc()+'/')||(editorNpc()==='pyoro'&&!String(x.target_id).includes('/'))))).map(x=>{const p=document.createElement('p');p.className='pyoro-audit-row';p.textContent=`${x.created_at} ／ ${x.section} ／ ${x.target_id}`;return p;}));
});

// v0.17.1 海の難易度・ぴょろ発見イベントの管理者操作
let adminSeaState=null;
const seaDifficultyFields=[
 {key:'weight',label:'重み',min:0,max:10000,step:1},
 {key:'rings',label:'リング',min:1,max:3,step:1},
 {key:'period',label:'秒',min:800,max:8000,step:100},
 {key:'blue',label:'水色',min:15,max:160,step:1},
 {key:'star',label:'星',min:0,max:160,step:1},
 {key:'chance',label:'星率',min:0,max:100,step:1}
];
const renderAdminSea=()=>{
 if(!adminSeaState)return;
 const s=adminSeaState;
 $('#admin-sea-status').textContent=`設定リビジョン ${s.revision}。進行中の釣りには変更を適用しません。`;
 const body=$('#admin-sea-rows');body.replaceChildren();
 for(let i=1;i<=5;i++){
  const tr=document.createElement('tr');const label=document.createElement('th');label.textContent='★'.repeat(i);tr.append(label);
  for(const def of seaDifficultyFields){
   const td=document.createElement('td'),input=document.createElement('input');input.type='number';
   input.min=def.min;input.max=def.max;input.step=def.step;
   input.id=`sea-diff-${i}-${def.key}`;
   input.value=def.key==='weight'?s.weights[i-1]:def.key==='period'?(s.presets[i].period/1000):s.presets[i][def.key];
   if(def.key==='period'){input.min='.8';input.max='8';input.step='.1';}
   input.setAttribute('aria-label',`★${i} ${def.label}`);
   td.append(input);tr.append(td);
  }body.append(tr);
 }
 $('#admin-sea-target').value=s.target;
 $('#admin-sea-target').min=Math.max(2,s.progress+1);
 $('#admin-sea-target').disabled=s.discovered;
 $('#admin-sea-progress').textContent=`現在の全住人共通進捗：${s.progress}回 ／ 目標 ${s.target}回。過去の加算は消えません。`;
 $('#admin-sea-discovery-state').textContent=s.discovered?'発見済み（発見者の記録は永続保持）':s.activated?'発見イベント：有効（ゲージが満ちた最初の住人が発見者になります）':'発見イベント：無効（ゲージは目標の1つ前で停止）';
 const btn=$('#admin-sea-enable');btn.disabled=s.discovered;btn.textContent=s.discovered?'発見済み（切替不可）':s.activated?'発見イベントを一時停止する':'発見イベントを有効化する';
};
const reloadAdminSea=async()=>{adminSeaState=await adminApi('/sea/difficulty');renderAdminSea();};
// v0.17.1.7: 管理者による住人復旧コード再発行。
let adminRecoverySecret='';
const clearAdminRecovery=()=>{
  adminRecoverySecret='';
  $('#admin-recovery-code').textContent='';
  $('#admin-recovery-code-owner').textContent='';
  $('#admin-recovery-result').classList.add('hidden');
};
const loadAdminRecoveryResidents=async()=>{
  const data=await adminApi('/residents/recovery');
  const select=$('#admin-recovery-resident'),selected=select.value;
  select.replaceChildren(new Option('住人を選択してください',''),...(data.residents||[]).map(r=>new Option(r.name,r.id)));
  if([...select.options].some(o=>o.value===selected))select.value=selected;
};
$('#admin-show-recovery').addEventListener('click',handler(async()=>{
  clearAdminRecovery();
  for(const id of ['admin-sea-panel','admin-pyoro-panel','admin-stats-panel','admin-quest-panel','admin-material-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel'])$('#'+id).classList.add('hidden');
  $('#admin-recovery-panel').classList.remove('hidden');
  $('#admin-recovery-confirm').value='';
  await loadAdminRecoveryResidents();
}));
// 別の管理画面へ移ったら新しいコードを画面・メモリから消す。
for(const el of document.querySelectorAll('.admin-editor-switch button:not(#admin-show-recovery)')){
  el.addEventListener('click',()=>{$('#admin-recovery-panel').classList.add('hidden');clearAdminRecovery();},true);
}
$('#admin-recovery-resident').addEventListener('change',()=>{$('#admin-recovery-confirm').value='';clearAdminRecovery();});
bind('#admin-recovery-reload',async()=>{clearAdminRecovery();await loadAdminRecoveryResidents();});
bind('#admin-recovery-clear',clearAdminRecovery);
bind('#admin-recovery-copy',async()=>{
  if(!adminRecoverySecret)throw new Error('コピーできるコードがありません。');
  await navigator.clipboard.writeText(adminRecoverySecret);toast('新しい復旧コードをコピーしました。');
});
$('#admin-recovery-form').addEventListener('submit',handler(async e=>{
  e.preventDefault();
  const select=$('#admin-recovery-resident'),confirmationName=$('#admin-recovery-confirm').value.trim();
  if(!select.value)throw new Error('住人を選択してください。');
  if(confirmationName!==select.selectedOptions[0].textContent)throw new Error('確認用の住人名が一致しません。');
  if(!confirm(`${confirmationName} さんの復旧コードを再発行しますか？\n以前のコードは使用できなくなります。`))return;
  const button=$('#admin-recovery-reissue');button.disabled=true;
  clearAdminRecovery();
  try{
    const result=await adminApi('/residents/recovery/reissue','POST',{residentId:select.value,confirmationName});
    adminRecoverySecret=result.recoveryCode;
    $('#admin-recovery-code-owner').textContent=result.resident.name;
    $('#admin-recovery-code').textContent=adminRecoverySecret;
    $('#admin-recovery-result').classList.remove('hidden');
    $('#admin-recovery-confirm').value='';
    toast('復旧コードを再発行しました。');
  }finally{button.disabled=false;}
}));
bind('#admin-show-sea-editor',async()=>{
 for(const id of ['admin-pyoro-panel','admin-stats-panel','admin-quest-panel','admin-material-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel'])$('#'+id).classList.add('hidden');
 $('#admin-sea-panel').classList.remove('hidden');await reloadAdminSea();
});
for(const el of document.querySelectorAll('.admin-editor-switch button:not(#admin-show-sea-editor)')){
 el.addEventListener('click',()=>$('#admin-sea-panel').classList.add('hidden'),true);
}
bind('#admin-sea-reload',reloadAdminSea);
$('#admin-sea-form').addEventListener('submit',handler(async(event)=>{
 event.preventDefault();if(!adminSeaState)return;
 const weights=[],presets={};
 for(let i=1;i<=5;i++){
  const get=k=>Number($(`#sea-diff-${i}-${k}`).value);
  weights.push(get('weight'));
  presets[i]={rings:get('rings'),period:Math.round(get('period')*1000),blue:get('blue'),star:get('star'),chance:get('chance')};
 }
 const button=$('#admin-sea-save');button.disabled=true;
 try{
  adminSeaState=await adminApi('/sea/difficulty/save','POST',{revision:adminSeaState.revision,weights,presets,target:Number($('#admin-sea-target').value)});
  renderAdminSea();toast('海の難易度を保存しました。');
 }finally{button.disabled=false;}
}));
bind('#admin-sea-enable',async()=>{
 if(!adminSeaState||adminSeaState.discovered)return;
 const activate=!adminSeaState.activated;
 const question=activate?`赤色の獣の発見を有効化します。現在 ${adminSeaState.progress}/${adminSeaState.target} 回です。住人が次の有効タップで発見する可能性があります。よろしいですか？`:'発見イベントを一時停止しますか？ 進捗は残ります。';
 if(!window.confirm(question))return;
 const b=$('#admin-sea-enable');b.disabled=true;
 try{adminSeaState=await adminApi('/sea/discovery/switch','POST',{enable:activate});renderAdminSea();toast(activate?'発見イベントを有効にしました。':'発見イベントを停止しました。');}
 finally{b.disabled=false;}
});


// Clothing editor and read-only recipe preview (crafting engine follows separately).
const clothingStepLabels={cut:'裁断',sew:'裁縫',dye:'染色',button:'装飾・ボタン付け',finish:'仕上げ',weave:'機織り',embroidery:'刺繍'};
let clAdminData={recipes:[],materials:[],history:[]},clRevision=0;
const clGet=id=>$('#cl-'+id);
function clPreview(){const image=clGet('image').value;const el=clGet('preview');el.style.display=/^images\/[A-Za-z0-9_./-]+\.(webp|png|jpg|jpeg)$/i.test(image)&&!image.includes('..')?'block':'none';if(el.style.display==='block')el.src=image;else el.removeAttribute('src');}
function clMaterialRow(data={}){const row=document.createElement('div');row.className='admin-reply-row';const sel=document.createElement('select');sel.replaceChildren(new Option('素材を選択',''),...clAdminData.materials.map(m=>new Option(m.name+'（'+m.id+'）',m.id)));sel.value=data.id||'';sel.required=true;const n=document.createElement('input');n.type='number';n.min=1;n.max=10000;n.required=true;n.value=data.quantity||1;n.setAttribute('aria-label','必要数');const del=document.createElement('button');del.type='button';del.className='secondary small';del.textContent='削除';del.onclick=()=>row.remove();row.append(sel,n,del);clGet('materials').append(row);}
function clStepRow(data={}){const row=document.createElement('div');row.className='admin-reply-row';const sel=document.createElement('select');sel.replaceChildren(...Object.entries(clothingStepLabels).map(([k,v])=>new Option(v,k)));sel.value=data.type||'sew';const diff=document.createElement('select');diff.replaceChildren(...[1,2,3,4,5].map(n=>new Option('難易度 '+n,n)));diff.value=data.difficulty||1;const controls=document.createElement('div');for(const [label,action] of [['↑',()=>{if(row.previousElementSibling)row.parentNode.insertBefore(row,row.previousElementSibling);}],['↓',()=>{if(row.nextElementSibling)row.parentNode.insertBefore(row.nextElementSibling,row);}],['削除',()=>row.remove()]]){const b=document.createElement('button');b.type='button';b.className='secondary small';b.textContent=label;b.onclick=action;controls.append(b);}row.append(sel,diff,controls);clGet('steps').append(row);}
const clLocalDate=v=>v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,16):'';
function clSelect(r){clRevision=r?.revision||0;clGet('id').value=r?.id||'';clGet('id').readOnly=!!r;clGet('name').value=r?.name||'';clGet('category').value=r?.category||'';clGet('image').value=r?.image||'';clGet('description').value=r?.description||'';clGet('published').checked=!!r?.published;clGet('limited').checked=!!r?.limited;clGet('start').value=clLocalDate(r?.startsAt);clGet('end').value=clLocalDate(r?.endsAt);clGet('period').classList.toggle('hidden',!r?.limited);clGet('materials').replaceChildren();clGet('steps').replaceChildren();(r?.ingredients||[{}]).forEach(clMaterialRow);(r?.steps||[{type:'sew',difficulty:1}]).forEach(clStepRow);clGet('admin-status').textContent=r?`リビジョン ${r.revision} ／ ${r.available?'公開中':'非公開・期間外'}`:'新規登録（初期状態は非公開）';clPreview();}
function clList(selected=''){const q=clGet('admin-search').value.toLowerCase().trim();clGet('admin-list').replaceChildren(new Option('服を選択',''),...clAdminData.recipes.filter(r=>[r.name,r.id,r.category].some(v=>v.toLowerCase().includes(q))).map(r=>new Option(`${r.available?'公開中':'非公開・期間外'}｜${r.name} (${r.id})`,r.id)));clGet('admin-list').value=selected;clGet('audit').replaceChildren(...clAdminData.history.map(r=>{const p=document.createElement('p');p.textContent=`${r.recipe_id} / rev.${r.revision} / ${r.created_at} UTC`;return p;}));}
async function clLoad(selected=''){clAdminData=await adminApi('/clothing');clList(selected);clSelect(clAdminData.recipes.find(r=>r.id===selected));}
$('.admin-editor-switch').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id!=='admin-show-clothing')$('#admin-clothing-panel').classList.add('hidden');},true);
bind('#admin-show-clothing',async()=>{for(const p of document.querySelectorAll('#admin-editor-page section[id^="admin-"]'))if(p.id!=='admin-clothing-panel')p.classList.add('hidden');for(const id of ['admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel','admin-material-panel','admin-quest-panel','admin-stats-panel','admin-sea-panel','admin-pyoro-panel','admin-recovery-panel'])$('#'+id)?.classList.add('hidden');$('#admin-clothing-panel').classList.remove('hidden');await clLoad();});
bind('#cl-admin-new',()=>{clGet('admin-list').value='';clSelect();});bind('#cl-admin-reload',()=>clLoad(clGet('id').value));bind('#cl-add-material',()=>{if(clGet('materials').children.length<30)clMaterialRow();});bind('#cl-add-step',()=>{if(clGet('steps').children.length<20)clStepRow();});
clGet('admin-search').addEventListener('input',()=>clList(clGet('id').value));clGet('admin-list').addEventListener('change',()=>clSelect(clAdminData.recipes.find(r=>r.id===clGet('admin-list').value)));clGet('image').addEventListener('input',clPreview);clGet('limited').addEventListener('change',()=>clGet('period').classList.toggle('hidden',!clGet('limited').checked));
clGet('admin-form').addEventListener('submit',handler(async e=>{e.preventDefault();const button=clGet('save');button.disabled=true;try{const id=clGet('id').value.trim();const date=k=>clGet(k).value?new Date(clGet(k).value+':00+09:00').toISOString():null;const body={id,revision:clRevision,name:clGet('name').value,category:clGet('category').value,description:clGet('description').value,image:clGet('image').value,published:clGet('published').checked,limited:clGet('limited').checked,startsAt:date('start'),endsAt:date('end'),ingredients:[...clGet('materials').children].map(r=>({id:r.querySelector('select').value,quantity:Number(r.querySelector('input').value)})),steps:[...clGet('steps').children].map(r=>({type:r.querySelectorAll('select')[0].value,difficulty:Number(r.querySelectorAll('select')[1].value)}))};clAdminData=await adminApi('/clothing/save','POST',body);clGet('admin-search').value='';clList(id);clSelect(clAdminData.recipes.find(r=>r.id===id));toast('服飾レシピを保存しました。');}finally{button.disabled=false;}}));
// v0.20.8.12 Clothing workshop. Images are returned only after a successful attempt.
let clothBusy=false, clothFilter='all';
async function openClothingRecipes(){
 const root=$('#clothing-recipes');root.textContent='読み込み中…';const {recipes}=await api('/clothing/recipes');root.replaceChildren();
 const title=document.createElement('p');title.className='clothing-progress';title.textContent=`レシピ：${recipes.length}種類`;root.append(title);
 const controls=document.createElement('div');controls.className='catalog-controls recipe-controls';const filter=document.createElement('select');filter.replaceChildren(new Option('すべて','all'),new Option('作成可能','ready'));filter.value=clothFilter;const search=document.createElement('input');search.placeholder='服の名前を検索';filter.id='cloth-filter';search.id='cloth-search';for(const [label,control] of [['作成状態',filter],['名前で検索',search]]){const group=document.createElement('div');const caption=document.createElement('label');caption.htmlFor=control.id;caption.textContent=label;group.append(caption,control);controls.append(group);}root.append(controls);
 const grid=document.createElement('div');grid.className='cloth-grid';root.append(grid);
 function wasCreated(r){return !!(r.created||r.found||r.discovered||r.hasCreated||r.createdAt||r.firstCreatedAt||r.timesCreated>0||r.totalCreated>0||r.times>0||r.count>0);}
 function render(){grid.replaceChildren();for(const r of recipes){const ready=r.ingredients.every(m=>m.owned>=m.quantity);if((filter.value==='ready'&&!ready)||!r.name.includes(search.value.trim()))continue;const b=document.createElement('button');b.type='button';b.className='secondary cloth-recipe';if(wasCreated(r)&&r.image){b.classList.add('cloth-recipe-created');b.style.setProperty('--cloth-bg',`url("${String(r.image).replace(/"/g,'\\"')}")`);}b.disabled=!ready;b.innerHTML=`<strong>${safe(r.name)}</strong>${r.limited?'<small>期間限定</small>':''}<span>${r.ingredients.map(m=>`<span class="${m.owned<m.quantity?'cloth-short':''}">${safe(m.name)} ×${m.quantity} <small>(${m.owned})</small></span>`).join('')}</span>`;b.onclick=()=>startClothing(r);grid.append(b);}if(!grid.children.length)grid.textContent='該当するレシピはありません。';}
 filter.onchange=()=>{clothFilter=filter.value;render();};search.oninput=render;render();
}
function clothButton(label,fn){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.onclick=fn;return b;}
function clothGame(root,step){return new Promise(resolve=>{
 root.replaceChildren();const type=({cut:'sew',finish:'button'})[step.type]||step.type;const difficulty=step.difficulty;let ended=false;let cleanup=()=>{};const finish=ok=>{if(ended)return;ended=true;cleanup();resolve(!!ok);};
 const title=document.createElement('h3');title.textContent=clothingStepLabels[step.type]||'仕上げ';root.append(title);const hint=document.createElement('p');root.append(hint);const area=document.createElement('div');area.className='cloth-game';root.append(area);
 const rand=n=>Math.floor(Math.random()*n);const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 if(type==='dye'){
   const colors=[['赤','#bd384d'],['青','#4168cb'],['黄','#e6bb43'],['緑','#4b9f79'],['紫','#9257bb'],['桃','#e591ad'],['水色','#82cce0'],['橙','#e58a40'],['灰','#8c919a'],['白','#f5efe3'],['黒','#272737'],['黄緑','#a3bc48']];const choices=shuffle([...colors]).slice(0,Math.min(12,5+difficulty));const target=choices[rand(choices.length)];hint.textContent='お手本と同じ色を選んで染めよう！';const sample=document.createElement('div');sample.className='cloth-swatch';sample.style.background=target[1];area.append(sample);const buttons=document.createElement('div');buttons.className='cloth-color-grid';for(const c of choices){const b=clothButton(c[0],()=>finish(c===target));b.style.background=c[1];b.style.color=['白','黄','水色','桃','黄緑'].includes(c[0])?'#222':'#fff';buttons.append(b);}area.append(buttons);
 }else if(type==='weave'||type==='embroidery'){
   const memory=type==='embroidery',n=memory?4:3,total=n*n,target=new Set(shuffle(Array.from({length:total},(_,i)=>i)).slice(0,Math.min(total-1,3+difficulty)));const selected=new Set();hint.textContent=memory?'模様を覚えて、同じ位置に刺繍しよう！':'お手本と同じ模様を織ろう！';
   function cells(readonly){const g=document.createElement('div');g.className='cloth-pattern'+(readonly?' cloth-example':'');g.style.gridTemplateColumns=`repeat(${n},1fr)`;for(let i=0;i<total;i++){const b=clothButton(' ',()=>{if(readonly)return;if(selected.has(i))selected.delete(i);else selected.add(i);b.classList.toggle('lit',selected.has(i));});b.setAttribute('aria-label',`${Math.floor(i/n)+1}行 ${i%n+1}列`);b.disabled=readonly;b.classList.toggle('lit',readonly&&target.has(i));g.append(b);}return g;}
   const example=cells(true);area.append(example);const board=cells(false);area.append(board);const submit=clothButton('仕上げる',()=>finish(selected.size===target.size&&[...selected].every(x=>target.has(x))));area.append(submit);if(memory){board.hidden=true;submit.hidden=true;const timer=setTimeout(()=>{example.remove();board.hidden=false;submit.hidden=false;},Math.max(1800,4200-difficulty*400));cleanup=()=>clearTimeout(timer);}
 }else if(type==='sew'){
   hint.textContent='点線に沿って、左から右へ指でなぞろう！';const canvas=document.createElement('canvas');canvas.width=600;canvas.height=240;canvas.style.cssText='width:100%;touch-action:none;display:block;background:#f4e7db;border-radius:12px';area.append(canvas);const ctx=canvas.getContext('2d');const points=Array.from({length:11},(_,i)=>[30+i*54,120+Math.sin(i*.85)*55]);let index=0,active=false;const paint=()=>{ctx.clearRect(0,0,600,240);ctx.lineWidth=5;ctx.strokeStyle='#96775e';ctx.setLineDash([8,9]);ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);points.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x,y,i===index?11:6,0,Math.PI*2);ctx.fillStyle=i<index?'#588c72':i===index?'#b44763':'#b7a18e';ctx.fill();});};paint();function check(e){const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*600/rect.width,y=(e.clientY-rect.top)*240/rect.height;const p=points[index];if(p&&Math.hypot(x-p[0],y-p[1])<Math.max(22,40-difficulty*3)){index++;paint();if(index===points.length)finish(true);}}canvas.onpointerdown=e=>{e.preventDefault();active=true;canvas.setPointerCapture(e.pointerId);check(e);};canvas.onpointermove=e=>{if(active){e.preventDefault();check(e);}};canvas.onpointerup=()=>{active=false;if(index>0&&index<points.length)finish(false);};canvas.onpointercancel=()=>finish(false);area.append(clothButton('この工程を終える',()=>finish(false)));
 }else if(type==='button'){
   hint.textContent='針が金色の範囲に入ったらタップ！';const track=document.createElement('div');track.className='cloth-track';const zone=document.createElement('div');const start=25+rand(45),width=24-difficulty*3;zone.style.cssText=`position:absolute;left:${start}%;width:${width}%;height:100%;background:#dcb46b`;const needle=document.createElement('div');needle.className='cloth-needle';track.append(zone,needle);area.append(track);let t0=performance.now(),pos=0,frame;function tick(t){const elapsed=t-t0;pos=(elapsed/(15-difficulty))%200;pos=pos>100?200-pos:pos;needle.style.left=pos+'%';if(elapsed>9000){finish(false);return;}frame=requestAnimationFrame(tick);}const hit=()=>finish(pos>=start&&pos<=start+width);track.onclick=hit;area.append(clothButton('縫い付ける',hit));frame=requestAnimationFrame(tick);cleanup=()=>cancelAnimationFrame(frame);
 }else{area.append(clothButton('次へ',()=>finish(false)));}
 root.append(clothButton('工程をスキップ（失敗）',()=>finish(false)));
});}
async function startClothing(r){
 if(clothBusy)return;if(!confirm('必要素材を消費して作成を始めますか？'))return;clothBusy=true;const back=$('#clothing-back'),hallBack=$('#clothing-hall-back');back.disabled=true;hallBack.disabled=true;const root=$('#clothing-recipes');
 try{const attemptId=crypto.randomUUID();const a=await api('/clothing/start','POST',{id:r.id,revision:r.revision,attemptId});const results=[];for(let i=0;i<a.steps.length;i++){const header=document.createElement('p');header.textContent=`${r.name}　工程 ${i+1}/${a.steps.length}`;const game=document.createElement('div');root.replaceChildren(header,game);results.push(await clothGame(game,a.steps[i]));game.textContent=results.at(-1)?'成功！':'失敗…';await new Promise(resolve=>setTimeout(resolve,600));}
 const finish=async()=>{const result=await api('/clothing/finish','POST',{id:a.id,results});root.replaceChildren();const h=document.createElement('h3');h.textContent=result.success?'完成しました！':'作成に失敗しました。';root.append(h);if(result.success){const img=document.createElement('img');img.src=result.item.image;img.alt=result.item.name;img.style.cssText='width:100%;max-width:520px;display:block;margin:auto;border-radius:12px';root.append(img);const name=document.createElement('p');name.textContent=result.item.name+' ×1 を持ち物に追加しました。';root.append(name);const link=document.createElement('a');link.href=result.item.image;link.download=result.item.id+'.webp';link.textContent='完成画像を保存する';link.className='button';root.append(link);}root.append(clothButton('レシピ一覧へ',()=>openClothingRecipes().catch(e=>toast(e.message))));};
 try{await finish();}catch(e){root.replaceChildren(clothButton('完成結果を再取得',()=>finish().catch(e=>toast(e.message))));toast(e.message);}
 }catch(e){toast(e.message);await openClothingRecipes().catch(()=>{});}finally{clothBusy=false;back.disabled=false;hallBack.disabled=false;}
}

})();
