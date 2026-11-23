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
const pages=['auth','recovery','hall','npc','conversation','room','history','cave','cave-story','inventory','material-catalog','npc-requests','npc-diary','npc-gifts','gift-history','npc-words','word-history','npc-feeding','admin-login','admin-editor','forest-event','forest','forest-area','forest-memories','sea','sea-event','pyoro','pyoro-conversation','pyoro-history','pyoro-feeding','pyoro-requests','pyoro-words','pyoro-word-history','pyoro-diary','pyoro-gifts','workshop','cooking','cooking-recipe','moon'];
let activePage='';
const show=(name)=>{
  const changed=activePage!==name; activePage=name;
  pages.forEach(p=>$(`#${p}-page`).classList.toggle('hidden',p!==name));
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
let seaState=null;
const FOREST_COMMON=new Set(["C026","C002","S0005","S0007","C028"]);
const MATERIALS=[...(window.KAGARISO_MATERIALS||[]),...FOREST_MATERIALS,...SEA_ITEMS].map(m=>['S0039','S0040'].includes(m.id)?{...m,rarity:5}:m);
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
const hallBackgroundName=()=>{
  const t=hallJapanClock();
  return HALL_IMAGE_NAMES[hallWeather(t.day)][hallTimeBand(t.hour)];
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
  if(currentNpc.state.location==='cave'){
    applyImageFallback(img,[bgVisual.cave||bgVisual.hall||'images/backgrounds/cave.png'],'conversationBackground');
    return;
  }
  const name=hallBackgroundName();
  img.dataset.hallBackground=name;
  applyImageFallback(img,hallBackgroundFiles(name),'conversationBackground');
};
// v0.18.5.20: ホールの4つの扉の感知範囲を長方形に統一する。
// 背景画像の左上を(0,0)、右下を(1,1)とする相対座標。
// 森の扉の表示を基準とし、洞窟・海・工房の形も扉の輪郭に合わせる。
const HALL_DOOR_ZONES={
  cave:{x:0.012,y:0.250,width:0.108,height:0.460},
  forest:{x:0.150,y:0.290,width:0.110,height:0.420},
  sea:{x:0.747,y:0.270,width:0.107,height:0.450},
  front:{x:0.445,y:0.255,width:0.111,height:0.413},
  moon:{x:0.596,y:0.295,width:0.104,height:0.426}
};
const positionHallCaveDoor=()=>{
  const image=$('#hall-background'),stage=$('#hall-visual');
  if(!image||!stage)return;
  const entries=[['cave','#hall-cave-door'],['forest','#hall-forest-door'],['sea','#hall-sea-door'],['front','#hall-front-door'],['moon','#hall-moon-door']];
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
    door.classList.toggle('hidden',!visible||(key==='front'&&!frontCookingUnlocked||(key==='moon'&&!moonDoorUnlocked)));
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
  if(!$('#hall-page')?.classList.contains('hidden')) updateHallBackground();
  if(!$('#conversation-page')?.classList.contains('hidden')) updateConversationBackground();
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
async function checkSeaEvents(){if(!seaState?.unlocked||!seaState?.eligible)return false;const e=await api('/sea/events');if(!e.greenSeen){showSeaEvent('green',e);return true;}if(e.discovered&&!e.encounterSeen){showSeaEvent(e.isFinder?'discover':'meet',e);return true;}return false;}

// v0.18.7 商人lent。画像は背景と人物が一体のWebPを使う。
let lentBusy=false;
const lentImageFiles=new Set(['normal.webp','sleeping.webp','lentNothing.webp','angry.webp','laugh.webp','surprised.webp']);
function renderLent(p){
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
 if(p.aiUnlocked){const u=p.aiUsage||{used:0,limit:5};$('#lent-chat-usage').textContent=`(${u.used}/${u.limit}回)`;$('#lent-chat-send').disabled=!p.canChat||u.used>=5||lentBusy;$('#lent-chat-input').disabled=!p.canChat;}
 const box=$('#lent-offers');box.replaceChildren();
 if(!p.canTrade){const msg=document.createElement('p');msg.className='muted';msg.textContent=p.activity==='away'?'商人は留守にしています。': '商人は眠っています。取引はできません。';box.append(msg);return;}
 if(!p.offers?.length){const msg=document.createElement('p');msg.className='muted';msg.textContent='ただいま交換品の準備中です。';box.append(msg);return;}
 for(const offer of p.offers){
  const row=document.createElement('div');row.className='lent-offer';
  const left=document.createElement('div');left.className='lent-offer-copy';
  const strong=document.createElement('strong');strong.textContent=offer.title;
  const desc=document.createElement('p');desc.className='muted tiny';desc.textContent=`${offer.give.name} ×${offer.give.quantity} → ${offer.receive.name} ×${offer.receive.quantity}`;
  const button=document.createElement('button');button.className='secondary small';button.textContent='交換する';button.disabled=lentBusy;
  button.onclick=handler(async()=>{if(lentBusy)return;if(!confirm(`${desc.textContent} を交換しますか？`))return;lentBusy=true;button.disabled=true;try{const res=await api('/lent/trade','POST',{offerId:offer.id});$('#lent-message').textContent=res.message;$('#lent-message').classList.remove('hidden');renderLent(res.profile);}finally{lentBusy=false;button.disabled=false;}});
  left.append(strong,desc);row.append(left,button);box.append(row);
 }
}
async function openMoonDoor(){
 const hall=await api('/hall');
 moonDoorUnlocked=!!hall.moonUnlocked;
 if(!moonDoorUnlocked){toast('月の扉はまだ開かない。');return;}
 const data=await api('/lent');
 renderLent(data.lent);
 show('moon');
}
$('#lent-chat-send').addEventListener('click',handler(async()=>{
 if(lentBusy)return;const message=$('#lent-chat-input').value.trim();if(!message){toast('話しかけたいことを入力してください。');return;}
 lentBusy=true;$('#lent-chat-send').disabled=true;
 try{const res=await api('/lent/chat','POST',{message});$('#lent-chat-reply').textContent=res.response;$('#lent-chat-input').value='';renderLent(res.profile);}finally{lentBusy=false;}
}));
$('#lent-wake').addEventListener('click',handler(async()=>{if(lentBusy)return;lentBusy=true;try{const data=await api('/lent/wake','POST',{});renderLent(data.profile);$('#lent-message').textContent='商人が目を覚ました。';$('#lent-message').classList.remove('hidden');}finally{lentBusy=false;}}));
$('#moon-back-hall').addEventListener('click',handler(openHall));
async function openHall(){const data=await api('/hall');resident=data.resident;$('#user-name').textContent=resident.name;$('#user-bar').classList.remove('hidden');
  updateHallBackground();
  updateForestHall(data.forest);
  seaState=data.sea||null;
  frontCookingUnlocked=!!data.frontUnlocked;
  moonDoorUnlocked=!!data.moonUnlocked;
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
  $('#npc-list').innerHTML=data.npcs.map(n=>`<article class="npc-card">${n.id==='paper'&&paperVisual?`<img class="npc-list-portrait" src="${safe(encodeURI(paperImage(paperExpression(n))))}" alt="">`:n.id==='pyoro'?`<img class="npc-list-portrait" src="${safe(encodeURI(pyoroImage(pyoroExpression(n))))}" alt="">`:'<div class="avatar" aria-hidden="true">✦</div>'}<div><strong>${safe(n.id==='pyoro'?'赤色の獣':n.name)}</strong><div class="muted">${safe(stateText(n))} · ${safe(n.state.activityLabel)}</div></div><button class="secondary small" data-npc="${safe(n.id)}">詳細を見る</button></article>`).join('');
  $('#doors').innerHTML=data.hall.doors.map(d=>`<article class="door-card" data-door-card="${safe(d.id)}"><span class="door-glyph">◇</span><div class="door-card-copy"><strong>${safe(d.id==='forest'&&d.status==='available'?'森':d.id==='sea'&&d.status==='available'?'海':d.id==='unknown'?(d.status==='available'?'工房':'正面の扉'):d.name)}</strong>${['forest','cave','sea'].includes(d.id)||(d.id==='unknown'&&d.status==='available')?'':`<div class="muted">${d.id==='moon'?'月の印が刻まれた扉。':d.status==='available'?'入口の採取ができます':d.id==='moon'?'まだ扉は開かない':'探索機能は次の開発段階で実装'}</div>`}</div>${d.status==='available'?`<button class="secondary small" data-door="${safe(d.id)}">${d.id==='unknown'?'工房へ':d.id==='moon'?'月の扉へ':'探索する'}</button>`:`<span class="tag">${['forest','sea','moon'].includes(d.id)?'未解放':'準備中'}</span>`}</article>`).join('');
  $('#doors').querySelector('[data-door="cave"]')?.addEventListener('click',handler(()=>enterHallCave()));
  $('#doors').querySelector('[data-door="forest"]')?.addEventListener('click',handler(openForest));
  $('#doors').querySelector('[data-door="sea"]')?.addEventListener('click',handler(async()=>{if(!await checkSeaEvents())await window.KAGARISO_SEA.open();}));
  $('#doors').querySelector('[data-door="unknown"]')?.addEventListener('click',handler(()=>window.KAGARISO_COOKING.open()));
  $('#doors').querySelector('[data-door="moon"]')?.addEventListener('click',handler(openMoonDoor));
  $('#hall-front-door').onclick=handler(async()=>{if(!frontCookingUnlocked){toast('まだ正面の扉は開かない。');return;}await window.KAGARISO_COOKING.open();});
  $('#hall-moon-door').onclick=handler(openMoonDoor);
  $('#hall-sea-door').onclick=handler(async()=>{if(!seaState?.unlocked||!seaState?.eligible){toast('緑の扉はまだ開かない。');return;}if(!await checkSeaEvents())await window.KAGARISO_SEA.open();});
  $('#npc-list').querySelectorAll('[data-npc]').forEach(b=>b.addEventListener('click',handler(()=>b.dataset.npc==='pyoro'?openPyoro():openNpc('hall'))));
  if(!data.npcs.length)$('#npc-list').innerHTML='<p class="muted">黄色い獣の姿はまだここにない。洞窟の扉を調べてみよう。</p>';
  show('hall');
  positionHallCaveDoor();
  if(data.requiredStory){toast('先に洞窟での大切な物語を体験しよう。');await openCave(1);return;}
  if(data.forest?.unlocked&&data.forest.eligible&&!data.forest.seen){showForestEvent(false);return;}
  if(await checkSeaEvents())return;
  checkGameNotifications().catch(console.warn);
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
async function openMaterialCatalog(){
 const [discovery,eventData,giftData,giftStats]=await Promise.all([
   api('/materials/discovered'),
   api('/catalog/events'),
   api('/inventory'),
   api('/catalog/gifts')
 ]);
 const discovered=new Set(discovery.ids||[]);
 const forestReady=Boolean(forestState?.unlocked&&forestState?.seen&&forestState?.eligible);
 const materials=MATERIALS.filter(m=>(m.source!=='森'||forestReady)&&(m.source!=='海'||Boolean(seaState?.unlocked&&seaState?.eligible))).map(m=>({id:m.id,name:m.name,image:m.image,rarity:m.rarity,
   category:m.category,description:m.description,kind:'material',source:m.source||'洞窟',found:discovered.has(m.id)}));
 const events=(eventData.items||[]).map(e=>({id:e.id,name:e.name,description:e.description,
   kind:'event',source:e.source||'その他',found:true}));
 // 実際に「受け取った」プレゼントのみ。準備中や未受取は図鑑に出さない。
 const giftDefs=new Map((window.KAGARISO_GIFTS||[]).map(g=>[g.id,g]));
 const gifts=(giftData.gifts||[]).filter(g=>Number(g.quantity)>0).map(g=>{
   const def=giftDefs.get(g.itemId)||{};
   return {id:g.itemId,name:g.name||def.name,description:g.description||def.description,
     image:g.image||def.image||'',kind:'gift',source:g.npcName||'黄色い獣',found:true};
 });
 // 作製物の所持記録は未実装。今後の調合・工作システム追加時にここへ統合する。
 // 未発見の返礼品は名前・IDを公開せず、総数のみ図鑑に反映。
 const giftTotal=Math.max(gifts.length,Number(giftStats.total)||0);
 const foundByNpc=new Map();gifts.forEach(g=>foundByNpc.set(g.source,(foundByNpc.get(g.source)||0)+1));
 const giftUnknown=(giftStats.byNpc||[{name:'黄色い獣',count:giftTotal}]).flatMap(({name,count})=>Array.from({length:Math.max(0,Number(count)-(foundByNpc.get(name)||0))},(_,n)=>({id:`gift-unknown-${name}-${n}`,name:'？？？？？',kind:'gift',source:name,found:false})));
 const entries=[...materials,...events,...gifts,...giftUnknown];
 const progress=$('#catalog-progress');
 progress.textContent=`素材：${materials.filter(m=>m.found).length} / ${materials.length} ｜ イベントアイテム：${events.length?events.length:"-"} ｜ プレゼント：${gifts.length}/${giftTotal}`;
 const kindLabels={material:'素材',event:'イベントアイテム',gift:'プレゼント',crafted:'作製物'};
 const render=()=>{
   const state=$('#catalog-filter').value;
   const rarity=$('#catalog-rarity').value, query=$('#catalog-search').value.trim().toLowerCase();
   const kind=$('#catalog-kind').value;
   const source=$('#catalog-source').value;
   const selected=entries.filter(m=>(state==='all'||(state==='found'?m.found:!m.found))
     &&(kind==='all'||m.kind===kind)&&(source==='all'||m.source===source||(forestReady&&source==='森'&&m.kind==='material'&&FOREST_COMMON.has(m.id)))
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
       ?`${safe(kindLabels[item.kind]||item.kind)} · ${safe(forestReady&&item.kind==='material'&&FOREST_COMMON.has(item.id)?'洞窟・森':item.source)}${item.kind==='material'?' · '+safe(item.category)+' · '+'★'.repeat(item.rarity):''}`
       :item.kind==='gift'?'未入手のプレゼント':'未発見素材';
     return `<article class="material-catalog-card ${found?'':'undiscovered'}"><div class="material-catalog-image">${thumb}</div><strong>${found?safe(item.name):'？？？？？'}</strong><div class="muted tiny">${subtitle}</div>${found&&item.description?`<p class="muted tiny">${safe(item.description)}</p>`:''}${found&&item.kind==='material'&&forestReady&&FOREST_AREAS.some(a=>a.spots.some(sp=>sp.items.includes(item.id)))?`<p class="muted tiny">森：${safe(FOREST_AREAS.flatMap(a=>a.spots.filter(sp=>sp.items.includes(item.id)).map(sp=>a.name+' / '+sp.name)).join('、'))}</p>`:''}</article>`;
   }).join('')||'<p class="muted catalog-empty">該当する品はまだありません。</p>';
 };
 const sourceSelect=$('#catalog-source');
 // Rebuild options rather than hiding native select options (mobile browsers may expose them).
 const previousSource=sourceSelect.value;
 const sources=new Set(['洞窟','黄色い獣','その他',...entries.map(e=>e.source).filter(Boolean),...(forestReady?['森']:[])]);
 if(!forestReady)sources.delete('森');if(!seaState?.unlocked||!seaState?.eligible)sources.delete('海');
 sourceSelect.replaceChildren(new Option('すべて','all'),...[...sources].map(source=>new Option(source,source)));
 sourceSelect.value=[...sourceSelect.options].some(o=>o.value===previousSource)?previousSource:'all';
 for(const selector of ['#catalog-filter','#catalog-kind','#catalog-source','#catalog-rarity'])$(selector).onchange=render;
 $('#catalog-search').oninput=render;
 render();show('material-catalog');
}
// v0.11.8.1: 所持品のデータはサーバーのまま。並び替えは画面上だけで行う。
let inventorySortItems=[];
function renderInventoryItems(){
  const mode=$('#inventory-sort').value;
  const sourceFilter=$('#inventory-source').value;
  const items=inventorySortItems.filter(i=>sourceFilter==='all'||i.source===sourceFilter||(sourceFilter==='森'&&i.kind==='material'&&FOREST_COMMON.has(i.id)));
  const byName=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ja');
  const rarity=i=>Number(i.rarity)||0;
  const count=i=>Number(i.quantity)||0;
  if(mode==='name-asc') items.sort(byName);
  else if(mode==='count-desc') items.sort((a,b)=>count(b)-count(a)||byName(a,b));
  else if(mode==='count-asc') items.sort((a,b)=>count(a)-count(b)||byName(a,b));
  else if(mode==='rarity-desc') items.sort((a,b)=>rarity(b)-rarity(a)||byName(a,b));
  else if(mode==='rarity-asc') items.sort((a,b)=>rarity(a)-rarity(b)||byName(a,b));
  else if(mode==='category') items.sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'ja')||byName(a,b));
  else if(mode==='source') items.sort((a,b)=>String(a.source||'').localeCompare(String(b.source||''),'ja')||byName(a,b));
  $('#inventory-list').innerHTML=items.length?items.map(i=>`<article class="inventory-item">${(i.kind==='gift'||i.kind==='cooked')&&i.image?`<img class="material-thumb" src="${safe(i.image)}" loading="lazy" alt="" onerror="this.replaceWith(document.createTextNode('✧'))">`:matIcon(i.id)}<div><strong>${safe(i.name)}</strong><div class="muted tiny">${safe(i.category)} · ${safe(i.source)}${i.kind==='gift'||i.kind==='cooked'?'':` · ${'★'.repeat(Math.max(1,Math.min(5,i.rarity)))}`}</div></div><strong>×${Number(i.quantity)}</strong></article>`).join(''):'<p class="muted">該当する持ち物はありません。</p>';
}
async function openInventory(from='hall'){
  inventoryReturn=from;
  const {items:serverItems,gifts:ownedGifts=[],cooked:ownedCooked=[]}=await api('/inventory');
  inventorySortItems=[...serverItems.filter(i=>materialById(i.id)).map(i=>({...i,source:materialById(i.id)?.source||'洞窟',kind:'material'})),...ownedGifts.map(g=>({...g,id:g.itemId,category:'プレゼント',source:g.npcName||'黄色い獣',kind:'gift',rarity:0})),...ownedCooked.map(d=>({...d,id:d.id,source:'料理',kind:'cooked',rarity:0}))]; // 所持素材と受取済み返礼品を統合
  const sourceSelect=$('#inventory-source');const selectedSource=sourceSelect.value;
  const forestReady=Boolean(forestState?.unlocked&&forestState?.seen&&forestState?.eligible);
  const sources=new Set(['洞窟','黄色い獣','その他',...inventorySortItems.map(i=>i.source),...(forestReady?['森']:[]),...(seaState?.unlocked&&seaState?.eligible?['海']:[])]);
  if(!forestReady)sources.delete('森');if(!seaState?.unlocked||!seaState?.eligible)sources.delete('海');
  sourceSelect.replaceChildren(new Option('すべて','all'),...[...sources].map(source=>new Option(source,source)));
  sourceSelect.value=[...sourceSelect.options].some(o=>o.value===selectedSource)?selectedSource:'all';
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
 $('#pyoro-relationship-detail').textContent=`${n.relationship}（好感度 ${n.affinity}/10・${n.affinityPoints}pt）`;
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
 $('#pyoro-talk-open').disabled=st.activity==='sleeping';
 $('#pyoro-talk-open').title=st.activity==='sleeping'?'赤色の獣は眠っています。':'';
 $('#pyoro-rest-btn').disabled=st.activity!=='awake';
 $('#pyoro-wake-btn').disabled=st.activity!=='sleeping'||n.affinity<3;
};
async function openPyoro(){
 const {npc}=await api('/npcs/pyoro');
 pyoroLastLocation=npc.state.location;
 $('#pyoro-open-kitchen').classList.toggle('hidden',!frontCookingUnlocked);
 $('#pyoro-move-notice').classList.add('hidden');
 $('#pyoro-life-action-result').classList.add('hidden');
 $('#pyoro-profile-more').open=false;
 paintPyoroProfile(npc);
 $('#pyoro-talk-result').textContent='';$('#pyoro-feed-result').textContent='';
 $('#pyoro-interactions').replaceChildren();
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
bind('#pyoro-gifts-open',async()=>{await loadPyoroGifts();show('pyoro-gifts');});
bind('#pyoro-gifts-back',openPyoro);
const openPyoroConversation=async()=>{
 const npc=pyoroProfile||(await api('/npcs/pyoro')).npc;
 paintPyoroProfile(npc);
 const background=$('#pyoro-conversation-background');
 applyImageFallback(background,hallBackgroundFiles(hallBackgroundName()),'pyoroConversationBackground');
 paintPyoro('#pyoro-conversation-image',npc);
 $('#pyoro-conversation-scene').textContent=pyoroStateScene(npc);
 $('#pyoro-talk-result').textContent='「……なんだ？ オレに話があるのか？」';
 $('#pyoro-conversation-result').classList.add('hidden');
 await loadPyoroTalk();
 show('pyoro-conversation');
};
bind('#pyoro-talk-open',openPyoroConversation);
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
const pyoroReply=r=>{ $('#pyoro-talk-result').textContent=r.response+(r.affinityChange?`（親密度 +${r.affinityChange}pt）`:'');paintPyoroProfile(r.npc);paintPyoro('#pyoro-conversation-image',r.npc,pyoroReplyExpression(r.response));$('#pyoro-conversation-scene').textContent=pyoroStateScene(r.npc);paintPyoroTalkUsage(r.usage);};
const pyoroAction=async(path,body)=>{if(pyoroBusy)return;pyoroBusy=true;try{const r=await api(path,'POST',body);pyoroReply(r);return r;}finally{pyoroBusy=false;}};
const loadPyoroTalk=async()=>{const data=await api('/npcs/pyoro/conversation/options');paintPyoroTalkUsage(data.usage);const list=$('#pyoro-talk-options');list.replaceChildren();for(const t of data.choices){const b=document.createElement('button');b.className='secondary';b.textContent=t.label;b.onclick=handler(async()=>{const r=await pyoroAction('/npcs/pyoro/conversation',{choice:t.id});if(r)await loadPyoroTalk();});list.append(b);}};
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
        if(item.cooked){const response=await api('/cooking/feed','POST',{npcId:'pyoro',recipeId:item.id});await loadPyoroFood(response.message);}
        else{const response=await api('/npcs/pyoro/feeding','POST',{itemId:item.id});await loadPyoroFood(response.message+(response.affinityChange?`（親密度 +${response.affinityChange}pt）`:''));}
      }catch(e){await loadPyoroFood().catch(()=>{});throw e;}finally{pyoroFeedingBusy=false;}
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
let pyoroRequestBusy=false,pyoroGiftBusy=false;
const pyoroStatus=(id,message)=>{const el=$(id);el.textContent=message||'';el.classList.toggle('hidden',!message);};
const pyoroRequestCard=(title,description)=>{
  const box=document.createElement('article');box.className='request-card';
  const h=document.createElement('h3');h.textContent=title;box.append(h);
  if(description){const p=document.createElement('p');p.className='muted tiny';p.textContent=description;box.append(p);}
  return box;
};
const pyoroRequestUpdate=async(path,body)=>{
  if(pyoroRequestBusy)return;
  pyoroRequestBusy=true;
  try{const result=await api(path,'POST',body);pyoroStatus('#pyoro-request-message',result.message);await loadPyoroRequests();}finally{pyoroRequestBusy=false;}
};
// v0.18.5.10: 素材依頼・料理依頼を同じNPCお願い画面に表示する。
// 保存先は既存の各テーブルを維持し、共通の1日3件・同時3件枠はWorkerが判定する。
async function renderCookingRequestsInNpcPage(npcId){
 const prefix=npcId==='paper'?'paper':'pyoro';
 const active=$('#'+prefix+'-cooking-active'),offers=$('#'+prefix+'-cooking-offers'),history=$('#'+prefix+'-cooking-history');
 if(!active||!offers||!history)return;
 active.replaceChildren();offers.replaceChildren();history.replaceChildren();
 if(!frontCookingUnlocked)return;
 let d;
 try{const result=await api('/cooking/orders');d=result[npcId];if(!d)throw new Error('料理のお願いを確認できませんでした。');}
 catch(err){const note=document.createElement('p');note.className='muted tiny';note.textContent='料理のお願いを読み込めませんでした：'+err.message;offers.append(note);return;}
 const makeCard=(title,detail)=>{
  const box=document.createElement('article');box.className='request-card';
  const h=document.createElement('h3');h.textContent='［料理］'+title;box.append(h);
  if(detail){const p=document.createElement('p');p.className='muted tiny';p.textContent=detail;box.append(p);}
  return box;
 };
 const refreshRequests=async()=>{if(npcId==='paper')await openNpcRequests();else await loadPyoroRequests();};
 const addButton=(box,label,style,action,confirmText)=>{
  const button=document.createElement('button');button.type='button';button.className=style;button.textContent=label;
  button.addEventListener('click',handler(async()=>{
   if(button.disabled)return;
   if(confirmText&&!confirm(confirmText))return;
   button.disabled=true;
   try{const result=await api('/cooking/orders/'+action.path,'POST',action.body);toast(result.message||'お願いを更新したよ。');await refreshRequests();}
   finally{button.disabled=false;}
  }));box.append(button);
 };
 for(const req of d.active||[]){
  const box=makeCard(req.name,'必要な料理：'+req.name+' ×1');
  const buttons=document.createElement('div');buttons.className='actions';
  addButton(buttons,'料理を渡す','primary small',{path:'resolve',body:{orderId:req.id,action:'complete'}});
  addButton(buttons,'取り消す','secondary small',{path:'resolve',body:{orderId:req.id,action:'cancel'}},'この料理のお願いを取り消しますか？');
  box.append(buttons);active.append(box);
 }
 for(const offer of d.offers||[]){
  const box=makeCard(offer.name,'完成した「'+offer.name+'」を1個渡すお願いです。');
  const btn=document.createElement('button');btn.type='button';btn.className='secondary small';btn.textContent='このお願いを引き受ける';btn.disabled=!d.canAccept;
  btn.addEventListener('click',handler(async()=>{if(btn.disabled)return;btn.disabled=true;try{const r=await api('/cooking/orders/accept','POST',{npcId,recipeId:offer.recipeId});toast(r.message||'引き受けたよ。');await refreshRequests();}finally{btn.disabled=false;}}));
  box.append(btn);offers.append(box);
 }
 for(const row of d.history||[]){const line=document.createElement('p');line.className='muted tiny';line.textContent='［料理］'+row.name+'：'+(row.status==='completed'?'完了':'取消');history.append(line);}
}
async function loadPyoroRequests(){
  const {requests:r}=await api('/npcs/pyoro/requests');
  $('#pyoro-request-status').textContent=`今日の受注 ${r.acceptedToday}/${r.dailyLimit} 件（残り ${r.remainingToday} 件）／受注済みは日をまたいで継続`;
  const active=$('#pyoro-request-active'),offers=$('#pyoro-request-offers'),history=$('#pyoro-request-history');
  active.replaceChildren();offers.replaceChildren();history.replaceChildren();
  for(const req of r.active){
    const card=pyoroRequestCard(req.title,'預けた素材は完了報告まで保管されます。');
    let complete=true;
    for(const item of req.items){
      const row=document.createElement('div');row.className='request-item';
      const label=document.createElement('p');label.className='muted tiny';label.textContent=`${item.name}：${item.donated}/${item.needed}（残り ${item.remaining}・所持 ${item.owned}）`;
      row.append(label);
      if(item.remaining>0){complete=false;const form=document.createElement('form');form.className='actions';
        const input=document.createElement('input');input.type='number';input.min='1';input.max=String(Math.min(item.remaining,item.owned));input.value=String(Math.min(1,item.remaining,item.owned)||1);input.step='1';input.style.maxWidth='90px';input.setAttribute('aria-label',item.name+'の納品個数');
        const btn=document.createElement('button');btn.type='submit';btn.className='secondary small';btn.textContent='預ける';btn.disabled=item.owned<1;
        form.append(input,btn);form.addEventListener('submit',handler(async e=>{e.preventDefault();const quantity=Number(input.value);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>item.remaining||quantity>item.owned)throw new Error('素材の個数を確認してね。');await pyoroRequestUpdate('/npcs/pyoro/requests/donate',{requestId:req.id,itemId:item.id,quantity});}));
        row.append(form);
      }
      card.append(row);
    }
    const actions=document.createElement('div');actions.className='actions';
    const report=document.createElement('button');report.className='primary small';report.textContent='赤色の獣に報告する';report.disabled=!complete;report.onclick=handler(()=>pyoroRequestUpdate('/npcs/pyoro/requests/resolve',{requestId:req.id,action:'report'}));
    const cancel=document.createElement('button');cancel.className='secondary small';cancel.textContent='取り消す';cancel.onclick=handler(async()=>{if(confirm('お願いを取り消しますか？ 預けた素材は持ち物に戻ります。'))await pyoroRequestUpdate('/npcs/pyoro/requests/resolve',{requestId:req.id,action:'cancel'});});
    actions.append(report,cancel);card.append(actions);active.append(card);
  }
  if(!r.active.length)active.textContent='引き受けているお願いはありません。';
  for(const offer of r.offers){
    const card=pyoroRequestCard(offer.title,offer.description);
    const p=document.createElement('p');p.className='muted tiny';p.textContent='必要：'+offer.items.map(i=>`${i.name} ×${i.needed}`).join('、');card.append(p);
    const b=document.createElement('button');b.className='secondary small';b.textContent='引き受ける';b.disabled=!r.canAccept;b.onclick=handler(()=>pyoroRequestUpdate('/npcs/pyoro/requests/accept',{templateKey:offer.key}));card.append(b);offers.append(card);
  }
  if(!r.offers.length)offers.textContent='今日は新しく引き受けられるお願いがありません。';
  for(const req of r.history){const p=document.createElement('p');p.className='muted tiny';p.textContent=`${req.title}：${req.status==='completed'?'完了':'取消'}${req.affinityGain?'（親密度 +'+req.affinityGain+'pt）':''}`;history.append(p);}
  if(!r.history.length)history.textContent='まだ記録はありません。';
  await renderCookingRequestsInNpcPage('pyoro');
}
async function loadPyoroGifts(){
 const data=await api('/npcs/pyoro/gifts');const inbox=$('#pyoro-gift-inbox'),history=$('#pyoro-gift-history'),inventory=$('#pyoro-gift-inventory');inbox.replaceChildren();history.replaceChildren();inventory.replaceChildren();
 const present=g=>{const card=pyoroRequestCard(g.name,g.description);if(g.image){const image=document.createElement('img');image.src=encodeURI(g.image);image.alt='';image.loading='lazy';image.style.cssText='width:100%;max-width:230px;border-radius:12px;display:block;margin:8px 0;';card.append(image);}return card;};
 for(const g of data.inbox){const card=g.ready?present(g):pyoroRequestCard('赤色の獣がお礼を準備中',`完成予定：${giftDate(g.readyAt)}（日本時間）`);
  if(g.ready){const btn=document.createElement('button');btn.className='primary small';btn.textContent='プレゼントを受け取る';btn.onclick=handler(async()=>{if(pyoroGiftBusy)return;pyoroGiftBusy=true;try{const r=await api('/npcs/pyoro/gifts/claim','POST',{giftId:g.id});pyoroStatus('#pyoro-gift-message',r.reply);paintPyoro('#pyoro-profile-image',pyoroProfile,'happy');await loadPyoroGifts();}finally{pyoroGiftBusy=false;}});card.append(btn);}
  else {const p=document.createElement('p');p.className='muted tiny';p.textContent=`赤色の獣がお礼を準備中 ・ 完成予定：${giftDate(g.readyAt)}（日本時間）`;card.append(p);}
  inbox.append(card);
 }
 if(!data.inbox.length)inbox.textContent='今は届いているプレゼントはありません。';
 for(const g of data.history.slice(0,5))history.append(present(g));
 if(!data.history.length)history.textContent='まだ受け取ったものはありません。';
 for(const g of data.inventory||[]){const row=document.createElement('article');row.className='request-card';const text=document.createElement('strong');text.textContent=`${g.name||g.itemId||'記念品'} ×${g.quantity||1}`;row.append(text);if(g.image){const img=document.createElement('img');img.src=encodeURI(g.image);img.alt='';img.loading='lazy';img.style.cssText='width:100%;max-width:150px;border-radius:10px;margin-top:8px;';row.append(img);}inventory.append(row);}
 if(!data.inventory?.length)inventory.textContent='まだ受け取った記念品はありません。';
}
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
bind('#pyoro-interactions-load',async()=>{
 const data=await api('/npcs/pyoro/interactions'),list=$('#pyoro-interactions');list.replaceChildren();
 for(const i of data.interactions){const p=document.createElement('p');p.className='scene';p.textContent=i.day+'　'+i.summary+'\n'+i.pyoro_view;list.append(p);}
 if(!data.interactions.length)list.textContent='2匹の思い出はまだありません。';
});
bind('#pyoro-back',openHall);
bind('#pyoro-open-kitchen',openCookingFromProfile);
bind('#paper-open-kitchen',openCookingFromProfile);
async function openNpc(from='hall'){$('#paper-open-kitchen').classList.toggle('hidden',!frontCookingUnlocked);npcReturn=from;const {npc}=await api('/npcs/paper');currentNpc=npc;lastLocation=npc.state.location;profileScene=npc.scene;$('#life-action-result').classList.add('hidden');$('#npc-move-notice').classList.add('hidden');renderNpc(false);show('npc');profileTimer=setInterval(async()=>{if(document.hidden)return;try{const {npc:updated}=await api('/npcs/paper');const old=lastLocation;currentNpc=updated;lastLocation=updated.state.location;renderNpc(old!==updated.state.location);}catch{}},15000);}
function renderNpc(moved){const n=currentNpc;
  $('#npc-diary-section').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-after-rescue').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-life-actions').classList.toggle('hidden',!n.diaryUnlocked);
  $('#npc-affinity').textContent='♥'.repeat(n.affinity)+'♡'.repeat(10-n.affinity);
  $('#npc-relationship').textContent=`あなたとの関係：${n.relationship}`;
  $('#npc-relationship-detail').textContent=`${n.relationship}（好感度 ${n.affinity}/10）`;
  $('#npc-life-status').innerHTML=['energy','hunger','mood'].map((k)=>{const labels={energy:'元気',hunger:'空腹',mood:'気分'};const descriptions={energy:n.state.energyLabel,hunger:n.state.hungerLabel,mood:n.state.moodLabel};return `<div class="life-item"><span>${labels[k]}</span><strong>${safe(descriptions[k])}</strong></div>`;}).join('');
  $('#rest-btn').disabled=n.state.activity!=='awake';
  $('#wake-btn').disabled=n.state.activity!=='sleeping'||n.affinity<3;
  $('#npc-live-state').innerHTML=`<div class="state-item"><span>現在地</span><strong>${safe(n.state.locationLabel)}</strong></div><div class="state-item"><span>活動状態</span><strong>${safe(n.state.activityLabel)}</strong></div>`;
  paintPaper('#npc-profile-image',n);
  $('#npc-scene').textContent=profileScene;
  $('#npc-bio').textContent=n.description;$('#npc-personality').textContent=n.personality;
  if(moved){$('#npc-move-notice').textContent=`黄色い獣は${n.state.locationLabel}へ移動しました。描写はプロフィールを開き直すと更新されます。` ;$('#npc-move-notice').classList.remove('hidden');}
  else if($('#npc-move-notice').classList.contains('hidden')) {} // 移動通知は開き直すまで残す
  $('#talk-btn').disabled=n.state.activity==='sleeping';
  $('#talk-btn').title=n.state.activity==='sleeping'?'黄色い獣は眠っています。':'';
  $('#room-btn').disabled=!n.roomUnlocked||n.state.location!=='room'||n.state.activity==='sleeping';
  $('#room-btn').classList.toggle('hidden',!n.roomUnlocked);
  $('#room-btn').title=n.roomUnlocked?'':'自室はまだありません。';
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
        currentNpc=data.npc;updateConversationBackground();paintPaper('#conversation-paper-image',data.npc);
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
function addGiftRow(){
 const box=$('#gift-send-rows');if(box.children.length>=10){toast('一度に送れるのは10種類までです。');return;}
 if(!giftInventory.length){toast('送れる素材をまだ持っていません。');return;}
 const row=document.createElement('div');row.className='gift-send-row';
 const sel=document.createElement('select');sel.className='gift-reply';sel.setAttribute('aria-label','贈る素材');
 for(const item of giftInventory){const opt=document.createElement('option');opt.value=item.id;opt.textContent=`${item.name}（所持 ${item.quantity}）`;sel.append(opt);}
 const qty=document.createElement('input');qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.setAttribute('aria-label','個数');
 const remove=document.createElement('button');remove.className='secondary small remove-gift-row';remove.type='button';remove.textContent='削除';remove.onclick=()=>row.remove();
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
async function openNpcGifts(from='hall',message=''){
 giftReturn=from;
 const onlyPaper=from==='npc';
 const data=await api(onlyPaper?'/npcs/paper/gifts':'/gifts');
 const npc=onlyPaper?data:data.npc;
 $('#mail-npc-section').classList.toggle('hidden',!onlyPaper&&!data.npcUnlocked);
 const inbox=$('#npc-gifts-inbox'),inventory=$('#npc-gifts-inventory'),history=$('#npc-gifts-history');
 const addGiftImage=(container,gift)=>{if(!gift.image)return;const img=document.createElement('img');img.className='npc-gift-image';img.alt=gift.name||'返礼品';img.loading='lazy';img.src=encodeURI(gift.image);img.onerror=()=>img.remove();container.insertBefore(img,container.firstChild);};
 const redSection=$('#mail-pyoro-section');redSection.classList.add('hidden');
 if(!onlyPaper && frontCookingUnlocked){
  try{
   const red=await api('/npcs/pyoro/gifts');
   redSection.classList.remove('hidden');
   const redList=$('#mail-pyoro-inbox');redList.replaceChildren();
   for(const gift of red.inbox||[]){
    const ready=!!gift.ready;
    const card=giftCard(ready?gift.name:'赤色の獣がお礼を準備中',ready?'贈り主：赤色の獣 ・ 受け取りできます':`贈り主：赤色の獣 ・ 完成予定：${giftDate(gift.readyAt)}（日本時間）`);
    if(ready){
      const btn=document.createElement('button');btn.type='button';btn.className='primary small';btn.textContent='受け取る';
      btn.addEventListener('click',handler(async()=>{btn.disabled=true;try{await api('/npcs/pyoro/gifts/claim','POST',{giftId:gift.id});await openNpcGifts('hall','赤色の獣からの贈り物を受け取りました。');}finally{btn.disabled=false;}}));card.append(btn);
    }else{const p=document.createElement('p');p.className='muted';p.textContent='赤色の獣が頑張って作っています。完成を待ってね。';card.append(p);}
    redList.append(card);
   }
   giftEmpty(redList,'赤色の獣から届いている贈り物はありません。');
  }catch(e){console.warn('赤色の獣の通信箱を取得できませんでした',e);}
 }
 const common=$('#gifts-common-sections');common.classList.toggle('hidden',onlyPaper);
 $('#gifts-heading').textContent=onlyPaper?'贈り物':'通信箱';
 $('#gifts-eyebrow').textContent=onlyPaper?'GIFTS FROM PAPER':'YOUR MAILBOX';
 $('#npc-gift-section-heading').textContent='贈り物';
 inbox.replaceChildren();inventory.replaceChildren();history.replaceChildren();
 const notification=$('#npc-gifts-message');notification.classList.toggle('hidden',!message);notification.textContent=message;
 for(const gift of npc.inbox){
  const card=giftCard(gift.ready?gift.name:'黄色い獣がお礼を準備中',gift.ready?'贈り主：黄色い獣　・　受け取りできます':`贈り主：黄色い獣　・　完成予定：${giftDate(gift.readyAt)}（日本時間）`);
  if(gift.ready){
   addGiftImage(card,gift);
   const desc=document.createElement('p');desc.textContent=gift.description;card.append(desc);
   const msg=document.createElement('p');msg.textContent=`黄色い獣「${gift.message}」`;card.append(msg);
   const sel=document.createElement('select');sel.className='gift-reply';sel.setAttribute('aria-label','黄色い獣への返答');
   for(const [id,label] of [['thanks','ありがとう！ 嬉しいよ！'],['effort','頑張って作ってくれたんだね']]){const opt=document.createElement('option');opt.value=id;opt.textContent=label;sel.append(opt);}
   const btn=document.createElement('button');btn.className='primary small';btn.textContent='返答して受け取る';
   btn.addEventListener('click',handler(async()=>{
    if(giftBusy)return;giftBusy=true;btn.disabled=true;
    try{const result=await api('/npcs/paper/gifts/claim','POST',{giftId:gift.id,replyChoice:sel.value});await openNpcGifts(giftReturn,`受け取りました：${result.gift.name}。黄色い獣 ${result.reply}`);}finally{giftBusy=false;}
   }));card.append(sel,btn);
  }else{const note=document.createElement('p');note.className='muted';note.textContent='黄色い獣が頑張って作っています。完成を待ってね。';card.append(note);}
  inbox.append(card);
 }
 giftEmpty(inbox,'届いている贈り物はありません。');
 for(const item of npc.inventory){const card=giftCard(`${item.name} ×${item.quantity}`,item.description);addGiftImage(card,item);inventory.append(card);}
 giftEmpty(inventory,'まだ記念品を受け取っていません。');
 for(const gift of [...npc.history].sort((a,b)=>String(b.receivedAt||'').localeCompare(String(a.receivedAt||''))).slice(0,5)){
  const detail=document.createElement('details');detail.className='gift-history-entry';const title=document.createElement('summary');title.textContent=`${gift.name}｜${giftDate(gift.receivedAt)}`;detail.append(title);
  for(const str of [`説明：${gift.description}`,`贈り主：${gift.sender}`,`受け取った日：${giftDate(gift.receivedAt)}`,`メッセージ：${gift.message}`,`あなたの返答：${gift.replyChoice==='effort'?'頑張って作ってくれたんだね':'ありがとう！ 嬉しいよ！'}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=str;detail.append(p);}
  history.append(detail);
 }
 giftEmpty(history,'まだ受け取り履歴はありません。');
 if(!onlyPaper){
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
  giftInventory=(await api('/inventory')).items.filter(i=>i.quantity>0&&materialById(i.id));
  $('#gift-send-rows').replaceChildren();$('#gift-send-message').value='';
  if(giftInventory.length)addGiftRow();
 }
 show('npc-gifts');
}
bind('#open-gifts',()=>openNpcGifts('hall'));
bind('#open-npc-gifts',()=>openNpcGifts('npc'));
// v0.11.8.3: 通信箱の履歴詳細を同一タブ内の専用ページに表示。
// 認証トークンをURLに含めず、既存APIで全件をページ単位で取得する。
let giftHistoryLoadId=0;
async function openGiftHistoryPage(kind){
 const names={npc:'贈り物の受け取り履歴',outgoing:'送った贈り物・取引履歴',incoming:'住人からの受け取り履歴'};
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
   if(kind==='npc')return `<article class="gift-history-full-entry"><strong>${safe(g.name)}</strong><p class="muted tiny">${safe(giftDate(g.receivedAt))} ｜ ${safe(g.sender||'黄色い獣')}</p><p>${safe(g.description||'')}</p><p>${safe(g.message||'')}</p></article>`;
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
bind('#npc-gifts-back',async()=>{if(giftReturn==='npc')await openNpc(npcReturn);else await openHall();});
// v0.6 黄色い獣のお願い。表示情報はすべてサーバーから取得する。
let requestBusy=false;
const showRequestsMessage=(text)=>{const el=$('#npc-requests-message');el.textContent=text;el.classList.remove('hidden');};
async function openNpcRequests(message=''){
  const {requests}=await api('/npcs/paper/requests');
  const activeList=$('#npc-requests-active'),availableList=$('#npc-requests-available'),historyList=$('#npc-requests-history');
  activeList.replaceChildren();availableList.replaceChildren();historyList.replaceChildren();
  $('#npc-request-daily-status').textContent=`今日の受注 ${requests.acceptedToday} / ${requests.dailyLimit} 件（あと ${requests.remainingToday} 件）`;
  $('#npc-request-daily-note').textContent=`日本時間 ${requests.day} の日替わり候補です。受注は1日3件まで。達成・キャンセルしても回数は戻りません。受注済みのお願いは翌日以降も続けられます。`;

  if(message)showRequestsMessage(message);else $('#npc-requests-message').classList.add('hidden');
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
          try{const data=await api('/npcs/paper/requests/donate','POST',{requestId:req.id,itemId:item.id,quantity});await openNpcRequests(data.message);}finally{requestBusy=false;}
        }));row.append(form);
      }
      list.append(row);
    }
    card.append(list);
    if(ready){const note=document.createElement('p');note.className='request-ready';note.textContent='素材が揃ったよ！ 黄色い獣本人に報告しよう。';card.append(note);}
    const actions=document.createElement('div');actions.className='actions';
    const report=document.createElement('button');report.className='primary small';report.textContent='黄色い獣に報告する';report.disabled=!ready;
    report.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;report.disabled=true;
      try{const data=await api('/npcs/paper/requests/resolve','POST',{requestId:req.id,action:'report'});await openNpcRequests(data.message);}finally{requestBusy=false;}
    });
    const cancel=document.createElement('button');cancel.className='secondary small';cancel.textContent='お願いを取り消す';
    cancel.onclick=handler(async()=>{
      if(!confirm('このお願いを取り消しますか？ 預けた素材はすべて返却されます。'))return;
      if(requestBusy)return;requestBusy=true;cancel.disabled=true;
      try{const data=await api('/npcs/paper/requests/resolve','POST',{requestId:req.id,action:'cancel'});await openNpcRequests(data.message);}finally{requestBusy=false;}
    });actions.append(report,cancel);card.append(actions);activeList.append(card);
  }
  if(!requests.active.length)activeList.innerHTML='<p class="muted">今、引き受けているお願いはありません。</p>';
  for(const t of [...requests.templates,...(requests.permanent||[])]){
    const card=document.createElement('article');card.className='request-card';card.append(subHeading(`${t.mode==='permanent'?'［常設］':'［今日の候補］'}${t.items.some(i=>FOREST_MATERIALS.some(m=>m.id===i.id))?'［森］':''} ${t.title}`,t.description));
    const p=document.createElement('div');p.className='muted tiny';p.innerHTML='必要素材：'+t.items.map(i=>`<span class="material-found-item">${matIcon(i.id)}${safe(i.name)} ×${i.needed}</span>`).join('、');card.append(p);
    const button=document.createElement('button');button.className='secondary small';button.textContent='このお願いを引き受ける';button.disabled=!requests.canAccept;
    button.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;button.disabled=true;
      try{const data=await api('/npcs/paper/requests/accept','POST',{templateKey:t.key});await openNpcRequests(data.message);}finally{requestBusy=false;}
    });card.append(button);availableList.append(card);
  }
  if(!requests.templates.length&&!(requests.permanent||[]).length)availableList.innerHTML='<p class="muted">今日の候補はすべて受注済み、または完了しました。また明日見にきてね。</p>';
  if(!requests.canAccept){const p=document.createElement('p');p.className='muted tiny';p.textContent='今日の受注上限、または同時受注3件の上限に達しています。';availableList.prepend(p);}
  for(const r of requests.history){const p=document.createElement('div');p.className='request-history-entry';p.textContent=`${r.title} — ${r.status==='completed'?'完了':'取り消し'}（${jstDate(r.resolvedAt||r.createdAt)}）`;historyList.append(p);}
  if(!requests.history.length)historyList.textContent='まだ履歴はありません。';
  await renderCookingRequestsInNpcPage('paper');
  show('npc-requests');
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
    try{const {npc}=await api('/npcs/paper');currentNpc=npc;paintPaper('#conversation-paper-image',npc);}catch{}
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

async function openForestMemories(){const {forest}=await api('/forest/status');if(forest.unlocked&&forest.seen&&forest.eligible){const e=await api('/sea/events');const list=$('#sea-memory-buttons');list.replaceChildren();for(const [kind,label,seen] of [['green','緑の扉の向こう側',e.greenSeen],[e.isFinder?'discover':'meet',e.isFinder?'海から釣れた、へんなもの':'赤色の獣との出会い',e.encounterSeen]])if(seen){const b=document.createElement('button');b.className='secondary';b.textContent=label+' →';b.onclick=()=>showSeaEvent(kind,e,true);list.append(b);}$('#sea-memories').classList.toggle('hidden',!list.childElementCount);show('forest-memories');}else toast('まだ思い出はありません。');}
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
$('#inventory-source').addEventListener('change',renderInventoryItems);
for(const [selector,action] of [['#rest-btn','rest'],['#wake-btn','wake']]){bind(selector,async()=>{const data=await api('/npcs/paper/life/action','POST',{action});currentNpc=data.npc;const last=lastLocation;lastLocation=data.npc.state.location;renderNpc(last!==lastLocation);$('#life-action-result').textContent=data.message;$('#life-action-result').classList.remove('hidden');});}
bind('#talk-btn',openConversation);
bind('#room-btn',enterRoom);
async function enterRoom(){const data=await api('/npcs/paper/room/enter','POST',{});$('#room-message').textContent=data.message;show('room');}
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
  $('#admin-logged-name').textContent=me.admin.displayName;
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
for(const m of MATERIALS)if(!ADMIN_MATERIALS.some(x=>x[0]===m.id))ADMIN_MATERIALS.push([m.id,m.name]);
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
 rows.forEach(g=>{const b=document.createElement('button');b.type='button';b.className='admin-topic-option';b.textContent=`${g.enabled?'':'［無効］'}${g.name} (${g.itemId})`;if(g.itemId===adminGiftSelected?.itemId)b.classList.add('admin-selected');b.onclick=()=>{adminGiftSelected=structuredClone(g);adminGiftForm();adminGiftListRender();};list.append(b);});
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
function notificationPrefs(){try{return {npc:true,resident:true,cave:true,...JSON.parse(localStorage.getItem(notificationKey())||'{}')};}catch{return {npc:true,resident:true,cave:true};}}
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
  const badge=$('#gift-ready-badge');badge.textContent=data.readyCount?`(${data.readyCount})`:'';badge.classList.toggle('hidden',!data.readyCount);
  const key=notificationKey()+':seen';let seen=[];try{seen=JSON.parse(localStorage.getItem(key)||'[]');}catch{}if(!Array.isArray(seen))seen=[];
  const known=new Set(seen),prefs=notificationPrefs();
  // v0.18.7.1: 月の扉は住人全員の共同達成。解放時刻ごとに本人の端末に一度知らせる。
  // 通知履歴は住人ID別で管理し、既存の贈り物・探索通知を妨げない。
  if(data.moon?.unlockedAt){
    const moonKey=`kagariso-moon-unlocked-v0.18.7.1:${id}`;
    if(localStorage.getItem(moonKey)!==data.moon.unlockedAt){
      localStorage.setItem(moonKey,data.moon.unlockedAt);
      pushGameNotice('誰かが料理50種類を完成させた！ ホールの月の扉が開いたようです。',openMoonDoor,'月の扉へ','あとで行く');
      if(activePage==='hall'){
        moonDoorUnlocked=true;
        positionHallCaveDoor();
        const moonCard=$('#doors').querySelector('[data-door-card="moon"]');
        if(moonCard){moonCard.querySelector('.tag')?.remove();
          if(!moonCard.querySelector('[data-door="moon"]')){
            const b=document.createElement('button');b.type='button';b.className='secondary small';b.dataset.door='moon';b.textContent='月の扉へ';b.addEventListener('click',handler(openMoonDoor));moonCard.append(b);
          }
        }
      }
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
  // 未受取のIDだけ保持。受け取り済みを削除した後に同じIDが再登場することはない。
  localStorage.setItem(key,JSON.stringify(['npc','resident'].flatMap(kind=>data[kind].map(g=>kind+':'+g.id))));
 }finally{noticeBusy=false;}
}
const openNoticeSettings=()=>{const prefs=notificationPrefs();for(const kind of ['npc','resident','cave'])$('#notify-'+kind).checked=prefs[kind];$('#notification-settings').showModal();};
bind('#open-notification-settings',openNoticeSettings);
bind('#close-notification-settings',()=>$('#notification-settings').close());
for(const kind of ['npc','resident','cave'])$('#notify-'+kind).addEventListener('change',()=>{const prefs=notificationPrefs();prefs[kind]=$('#notify-'+kind).checked;localStorage.setItem(notificationKey(),JSON.stringify(prefs));});
setInterval(()=>{if(!document.hidden)refreshCaveStatus().catch(console.warn);},15000);
setInterval(()=>checkGameNotifications().catch(console.warn),30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCaveStatus().catch(console.warn);checkGameNotifications().catch(console.warn);}});
(async()=>{if(token){try{await openHall();}catch(e){toast(e.message);show('auth');}}else show('auth');})();

// v0.12.1 AI人格管理・名前の明示登録
let aiProfileRevision=0;
const aiProfileFields=['personality','speech','firstPerson','secondPerson','likes','dislikes','avoid'];
const loadAiProfile=async()=>{
 const {profile}=await adminApi('/ai-profile');aiProfileRevision=profile.revision;
 $('#ai-profile-revision').textContent=`改訂 ${profile.revision}`;
 for(const k of aiProfileFields)$('#ai-profile-'+k).value=profile[k];
 $('#ai-profile-examples').value=profile.examples.map(e=>e.user+'\t'+e.assistant).join('\n');
};
bind('#admin-show-ai-editor',async()=>{
 for(const id of ['admin-stats-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-material-panel','admin-quest-panel'])$('#'+id).classList.add('hidden');
 $('#admin-ai-panel').classList.remove('hidden');await loadAiProfile();
});
bind('#ai-profile-reload',loadAiProfile);
$('#ai-profile-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();const body={revision:aiProfileRevision};for(const k of aiProfileFields)body[k]=$('#ai-profile-'+k).value;
 body.examples=$('#ai-profile-examples').value.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const [user,...parts]=line.split('\t');return {user,assistant:parts.join('\t')};});
 await adminApi('/ai-profile/save','POST',body);await loadAiProfile();toast('AI人格を保存しました。');
}));
$('#ai-profile-test-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;
 try{const r=await adminApi('/ai-profile/test','POST',{message:$('#ai-profile-test-message').value});$('#ai-profile-test-result').textContent=r.response;}finally{b.disabled=false;}
}));
bind('#ai-profile-audit',async()=>{const {history}=await adminApi('/ai-profile/audit');const el=$('#ai-profile-audit-list');el.replaceChildren();for(const row of history){const p=document.createElement('p');p.textContent=`改訂 ${row.revision} ／ ${row.display_name} ／ ${jstDate(row.created_at)}`;el.append(p);}});
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
bind('#admin-show-quest-editor',async()=>{for(const id of ['admin-stats-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel','admin-material-panel'])$('#'+id).classList.add('hidden');$('#admin-quest-panel').classList.remove('hidden');if(!questData||!questDirty)await loadQuest();});
$('#quest-area').addEventListener('change',renderQuest);
bind('#quest-add',()=>{if(!questData||questLoading)return;const id=$('#quest-add-item').value;if(id&&!questPlan.some(r=>r.sectionId===questArea()&&r.id===id)){questPlan.push({sectionId:questArea(),id,needed:10});questDirty=true;renderQuest();}});
const scaleQuest=all=>{if(!questData||questLoading)return;const n=Number($('#quest-factor').value);if(!Number.isFinite(n)||n<0.1||n>10){toast('倍率は0.1〜10です。');return;}if(!confirm(`現在の編集値を ${n} 倍しますか？`))return;for(const r of questPlan)if(all||r.sectionId===questArea())r.needed=Math.max(1,Math.min(100000,Math.round(r.needed*n)));questDirty=true;renderQuest();};
bind('#quest-scale-area',()=>scaleQuest(false));bind('#quest-scale-all',()=>scaleQuest(true));
bind('#quest-reset',()=>{if(!questData||questLoading||!confirm('この区画をエディター導入時の必要数に戻しますか？'))return;questPlan=[...questPlan.filter(r=>r.sectionId!==questArea()),...structuredClone(questData.baseline.filter(r=>r.sectionId===questArea()))];questDirty=true;renderQuest();});
bind('#quest-reload',async()=>{if(!questDirty||confirm('未保存の変更を破棄しますか？'))await loadQuest();});
bind('#quest-save',async()=>{if(!questData||questLoading)return;if(questPlan.some(r=>!Number.isInteger(r.needed)||r.needed<1||r.needed>100000)||questData.areas.some(a=>!questPlan.some(r=>r.sectionId===a.id))){toast('各区画に1種類以上、必要数は整数1〜100000個で設定してください。');return;}const warnings=questWarnings();if(warnings.length&&!confirm(warnings.join('\n')+'\n次回用として保存しますか？'))return;questLoading=true;const b=$('#quest-save');b.disabled=true;try{setQuestData(await adminApi('/cave-quest/save','POST',{revision:questData.revision,plan:questPlan}));toast('次回用設定を保存しました。現在の進捗は変更していません。');}finally{questLoading=false;b.disabled=false;}});

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
let pyoroAdminSection='topics',pyoroAdminRows=[],pyoroAdminSelected=null;
const pyoroAdminSections=new Set(['topics','requests','gifts','foods','profile']);
const pyoroAdminInput=(key,v,multiline=false,opts={})=>{
 const id='pyoro-field-'+key, label=opts.label||key;
 if(opts.checkbox)return `<label><input id="${id}" type="checkbox" ${v?'checked':''}> ${safe(label)}</label>`;
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
 let html=`<p class="muted tiny">設定ID：${safe(r.id)}</p>`;
 if(pyoroAdminSection==='topics'){
  html+=pyoroAdminInput('label',r.label,false,{label:'住人が選ぶ会話'})+pyoroAdminInput('response',r.response,true,{label:'赤色の獣の返答',maxlength:320});
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'ランダム3択に出す',checkbox:true});
 }
 if(pyoroAdminSection==='requests'){
  html+=pyoroAdminInput('title',r.title,false,{label:'お願いの名前'})+pyoroAdminInput('description',r.description,true,{label:'説明'});
  html+=pyoroAdminInput('giftKind',r.giftKind,false,{label:'返礼品の種類',select:[['food','食べ物'],['craft','工作'],['decoration','装飾']]});
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'お願いの候補として有効',checkbox:true});
  html+='<h3>必要素材（すでに受注中のお願いは変更できません）</h3>';
  html+=(r.items||[]).map((x,i)=>`<div class="pyoro-material-admin-row"><input type="text" data-pyoro-material-id="${i}" aria-label="素材ID" value="${safe(x.id)}" maxlength="30" required><input type="number" data-pyoro-material-needed="${i}" aria-label="必要個数" min="1" max="99" value="${Number(x.needed)}" required></div>`).join('');
 }
 if(pyoroAdminSection==='gifts'){
  html+=`<p class="muted tiny">種類：${safe(r.giftKind)}／品質：${safe(r.quality)}（この2項目は変更不可）</p>`;
  html+=pyoroAdminInput('name',r.name,false,{label:'返礼品名'})+pyoroAdminInput('description',r.description,true,{label:'説明'});
  html+=pyoroAdminInput('image',r.image,false,{label:'画像パス（images/gifts/pyoro/*.webp）'});
  html+=`<img src="${safe(r.image)}" alt="返礼品プレビュー" style="display:block;width:150px;max-width:100%;border-radius:12px;margin-top:12px">`;
 }
 if(pyoroAdminSection==='foods'){
  html+=`<p class="muted tiny">区分：${r.kind==='meal'?'ごはん':'おやつ'}（食材ID・区分は変更不可）</p>`;
  html+=pyoroAdminInput('restore',r.restore,false,{label:'空腹度の回復量',number:true,min:1,max:100});
  html+=pyoroAdminInput('reply',r.reply,true,{label:'食べたときの返答',maxlength:260});
  html+=pyoroAdminInput('enabled',r.enabled,false,{label:'この食材を有効にする',checkbox:true});
 }
 if(pyoroAdminSection==='profile'){
  html+=pyoroAdminInput('name',r.name,false,{label:'表示名'})+pyoroAdminInput('description',r.description,true,{label:'プロフィールの説明',maxlength:500});
  html+=pyoroAdminInput('personality',r.personality,true,{label:'プロフィールの性格',maxlength:600});
  html+=pyoroAdminInput('prompt',r.prompt,true,{label:'赤色の獣のAI人格・口調（黄色い獣とは別）',rows:8,maxlength:3000});
  html+='<h3>生活リズム（日本時間）</h3>';
  html+=pyoroAdminInput('hungerMinutes',Math.round(Number(r.hungerIntervalMs||180000)/60000),false,{label:'空腹度が+1になるまで（分）',number:true,min:1,max:60});
  html+=pyoroAdminInput('sleepStart',r.sleepStart??23,false,{label:'睡眠開始時刻（時）',number:true,min:0,max:23});
  html+=pyoroAdminInput('sleepEnd',r.sleepEnd??7,false,{label:'起床時刻（時）',number:true,min:0,max:23});
  html+=pyoroAdminInput('restStart',r.restStart??19,false,{label:'休憩開始時刻（時）',number:true,min:0,max:23});
  html+=`<p class="muted tiny">現在の生活状態：${safe(r.life?`空腹 ${r.life.hunger} / 体力 ${r.life.energy} / 機嫌 ${r.life.mood} / ${r.life.activity}`:'発見前のため未開始')}。この画面から現在値を初期化しません。</p>`;
 }
 el.innerHTML=html;
};
const pyoroAdminList=()=>{
 const list=$('#pyoro-admin-list'),q=$('#pyoro-admin-search').value.trim().toLowerCase();list.replaceChildren();
 const visible=pyoroAdminRows.filter(r=>`${r.id} ${r.name||r.label||r.title||''}`.toLowerCase().includes(q));
 $('#pyoro-admin-count').textContent=`${visible.length} / ${pyoroAdminRows.length}件`;
 visible.forEach(r=>{const b=document.createElement('button');b.className='admin-topic-option';b.type='button';b.textContent=`${r.name||r.label||r.title||r.id} (${r.id})`;
 if(pyoroAdminSelected?.id===r.id)b.classList.add('admin-selected');b.onclick=()=>{pyoroAdminSelected=structuredClone(r);pyoroAdminFields();pyoroAdminList();};list.append(b);});
};
const pyoroAdminLoad=async()=>{
 const data=await adminApi('/pyoro/config?section='+encodeURIComponent(pyoroAdminSection));
 if($('#admin-npc-target').value!=='pyoro')return;
 pyoroAdminRows=data.items||[];
 pyoroAdminSelected=structuredClone(pyoroAdminRows.find(r=>r.id===pyoroAdminSelected?.id)||pyoroAdminRows[0]||null);
 $('#pyoro-admin-new-topic').classList.toggle('hidden',pyoroAdminSection!=='topics');
 $('#pyoro-admin-note').textContent={topics:'話題はランダム3択から表示されます。',requests:'受注中の必要素材・返礼品ジャンルは変更できません。',gifts:'6種類の成功作・失敗作を個別に編集できます。ID・品質・制作確率は固定です。',foods:'赤色の獣だけの食材・回復量・返答を編集します。',profile:'赤色の獣のプロフィールとAI人格を編集します。現在の生活状態は変更しません。'}[pyoroAdminSection];
 $('#pyoro-admin-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.pyoroSection===pyoroAdminSection));
 pyoroAdminList();pyoroAdminFields();
};
const pyoroAdminShow=async(section='topics')=>{
 if(!pyoroAdminSections.has(section))return;
 pyoroAdminSection=section;pyoroAdminSelected=null;
 for(const id of ['admin-stats-panel','admin-quest-panel','admin-material-panel','admin-conversations-panel','admin-requests-panel','admin-gifts-panel','admin-ai-panel'])$('#'+id).classList.add('hidden');
 $('#admin-pyoro-panel').classList.remove('hidden');
 await pyoroAdminLoad();
};
$('#admin-npc-target').addEventListener('change',handler(async()=>{
 if($('#admin-npc-target').value==='pyoro')await pyoroAdminShow('topics');
 else{await openAdminEditor();}
}));
// Prevent the original paper-only editors from running when editing pyoro.
const pyoroAdminRoute={
 'admin-show-dialogue-editor':'topics','admin-show-request-editor':'requests',
 'admin-show-gift-editor':'gifts','admin-show-ai-editor':'profile'
};
for(const [id,section] of Object.entries(pyoroAdminRoute)){
 $('#'+id).addEventListener('click',e=>{
  if($('#admin-npc-target').value!=='pyoro')return;
  e.stopImmediatePropagation();e.preventDefault();
  pyoroAdminShow(section).catch(error=>toast(error.message||'読み込めませんでした。'));
 },true);
}
for(const id of ['admin-show-material-editor','admin-show-quest-editor','admin-show-stats']){
 $('#'+id).addEventListener('click',()=>$('#admin-pyoro-panel').classList.add('hidden'));
}
$('#pyoro-admin-tabs').addEventListener('click',handler(async e=>{const section=e.target.closest('[data-pyoro-section]')?.dataset.pyoroSection;if(section)await pyoroAdminShow(section);}));
$('#pyoro-admin-search').addEventListener('input',pyoroAdminList);
bind('#pyoro-admin-refresh',pyoroAdminLoad);
bind('#pyoro-admin-new-topic',()=>{
 const id='topic_'+Date.now().toString(36);
 pyoroAdminSelected={id,label:'',response:'',enabled:1};
 pyoroAdminFields();pyoroAdminList();
});
$('#pyoro-admin-form').addEventListener('submit',handler(async e=>{
 e.preventDefault();if(!pyoroAdminSelected)return;
 const body={section:pyoroAdminSection,id:pyoroAdminSelected.id};
 if(pyoroAdminSection==='topics')Object.assign(body,{label:pyoroAdminValue('label'),response:pyoroAdminValue('response'),enabled:pyoroAdminCheckbox('enabled')});
 if(pyoroAdminSection==='requests')Object.assign(body,{title:pyoroAdminValue('title'),description:pyoroAdminValue('description'),giftKind:pyoroAdminValue('giftKind'),enabled:pyoroAdminCheckbox('enabled'),items:(pyoroAdminSelected.items||[]).map((x,i)=>({id:$(`[data-pyoro-material-id="${i}"]`).value.trim(),needed:Number($(`[data-pyoro-material-needed="${i}"]`).value)}))});
 if(pyoroAdminSection==='gifts')Object.assign(body,{name:pyoroAdminValue('name'),description:pyoroAdminValue('description'),image:pyoroAdminValue('image')});
 if(pyoroAdminSection==='foods')Object.assign(body,{restore:Number(pyoroAdminValue('restore')),reply:pyoroAdminValue('reply'),enabled:pyoroAdminCheckbox('enabled')});
 if(pyoroAdminSection==='profile')Object.assign(body,{name:pyoroAdminValue('name'),description:pyoroAdminValue('description'),personality:pyoroAdminValue('personality'),prompt:pyoroAdminValue('prompt'),hungerMinutes:Number(pyoroAdminValue('hungerMinutes')),sleepStart:Number(pyoroAdminValue('sleepStart')),sleepEnd:Number(pyoroAdminValue('sleepEnd')),restStart:Number(pyoroAdminValue('restStart'))});
 const b=$('#pyoro-admin-save');b.disabled=true;
 try{await adminApi('/pyoro/config/save','POST',body);await pyoroAdminLoad();toast('赤色の獣の設定を保存しました。');}
 finally{b.disabled=false;}
}));
bind('#pyoro-admin-audit-refresh',async()=>{
 const {history}=await adminApi('/pyoro/audit');
 $('#pyoro-admin-audit').replaceChildren(...history.map(x=>{const p=document.createElement('p');p.className='pyoro-audit-row';p.textContent=`${x.created_at} ／ ${x.section} ／ ${x.target_id}`;return p;}));
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

})();
