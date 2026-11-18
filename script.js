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
const pages=['auth','recovery','hall','npc','conversation','room','history','cave','cave-story','inventory','material-catalog','npc-requests','npc-gifts','gift-history','npc-words','npc-feeding','admin-login','admin-editor'];
const show=(name)=>{
  pages.forEach(p=>$(`#${p}-page`).classList.toggle('hidden',p!==name));
  if(name!=='npc'&&profileTimer){clearInterval(profileTimer);profileTimer=null;}
  window.scrollTo({top:0,behavior:'instant'});
};
const toast=(message)=>{const box=$('#toast');box.textContent=message;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),4000);};
const api=async(path,method='GET',payload)=>{
  if(!API) throw new Error('config.js にAPIのURLを設定してください。');
  const response=await fetch(`${API}/api${path}`,{method,headers:{...(token?{'Authorization':`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  let data;try{data=await response.json();}catch{throw new Error('サーバーから応答を読み取れません。');}
  if(!response.ok){if(response.status===401&&path!=='/recover'){token='';localStorage.removeItem(SESSION_KEY);show('auth');}throw new Error(data.error||'処理に失敗しました。');}
  return data;
};
const safe=(text)=>String(text??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MATERIALS=window.KAGARISO_MATERIALS||[];
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
bind('#logout-btn',async()=>{try{await api('/logout','POST');}finally{token='';resident=null;localStorage.removeItem(SESSION_KEY);$('#user-bar').classList.add('hidden');show('auth');}});
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
const updateHallBackground=()=>{
  const img=$('#hall-background');
  if(!img)return;
  const name=hallBackgroundName();
  if(img.dataset.hallBackground===name)return;
  img.dataset.hallBackground=name;
  // WebPを優先、失敗時は同名PNG、その画像もなければ既存hall.png。
  const fallback=bgVisual.hall||'images/backgrounds/hall.png';
  const files=[`${HALL_BG_DIR}${name}.webp`,`${HALL_BG_DIR}${name}.png`,fallback];
  let step=0;
  img.onerror=()=>{
    step+=1;
    if(step<files.length){img.src=encodeURI(files[step]);}
    else{img.classList.add('visual-error');}
  };
  img.onload=()=>img.classList.remove('visual-error');
  img.src=encodeURI(files[0]);
};
// v0.11.8.4: 左端の茶色い扉を、背景画像の見かけの位置に追従させる。
// 元画像に対する比率。晴天・曇天の7枚は同じ扉の構図を共有している。
const HALL_CAVE_DOOR_AREA={x:0.009,y:0.16,width:0.108,height:0.59};
const positionHallCaveDoor=()=>{
  const image=$('#hall-background'),stage=$('#hall-visual'),door=$('#hall-cave-door');
  if(!image||!stage||!door)return;
  if(!image.naturalWidth||!image.naturalHeight){door.classList.add('hidden');return;}
  // object-fit:cover、object-position:center の拡大率と中央クロップを再現。
  const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
  if(!stageWidth||!stageHeight)return;
  const scale=Math.max(stageWidth/image.naturalWidth,stageHeight/image.naturalHeight);
  const drawnWidth=image.naturalWidth*scale,drawnHeight=image.naturalHeight*scale;
  const offsetX=(stageWidth-drawnWidth)/2,offsetY=(stageHeight-drawnHeight)/2;
  const area=HALL_CAVE_DOOR_AREA;
  const left=offsetX+drawnWidth*area.x,top=offsetY+drawnHeight*area.y;
  const width=drawnWidth*area.width,height=drawnHeight*area.height;
  // 背景トリミングで扉が完全に見えない場合は反応させない。
  const visible=left+width>0&&left<stageWidth&&top+height>0&&top<stageHeight;
  door.classList.toggle('hidden',!visible);
  if(!visible)return;
  Object.assign(door.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
};
// 背景画像が日替わり・時間帯切り替えで読み込まれたときにも位置を更新。
$('#hall-background')?.addEventListener('load',positionHallCaveDoor);
window.addEventListener('resize',positionHallCaveDoor);

// 時刻が境界を越えたら、ホールを開き直さなくても背景更新。
setInterval(()=>{
  if(document.hidden||$('#hall-page')?.classList.contains('hidden'))return;
  updateHallBackground();
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
const stateText=(npc)=>npc.state.locationLabel;
async function openHall(){const data=await api('/hall');resident=data.resident;$('#user-name').textContent=resident.name;$('#user-bar').classList.remove('hidden');
  updateHallBackground();
  const paperHere=data.npcs.find(n=>n.id==='paper'&&n.state.location==='hall');
  // ホール専用の表示位置。5体対応の予約枠はCSS側の data-hall-slot=1〜5。
  // 黄色い獣だけがいる現在は中央(3)へ。プロフィール・会話画面には影響しない。
  const paperActor=$('#hall-paper-actor');
  paperActor.dataset.hallSlot='3';
  paperActor.classList.toggle('hidden',!paperHere);
  if(paperHere){paintPaper('#hall-paper-image',paperHere);$('#hall-paper-label').textContent=paperHere.state.activity==='sleeping'?'黄色い獣はおやすみ中':'黄色い獣に会う';}
  $('#npc-list').innerHTML=data.npcs.map(n=>`<article class="npc-card">${n.id==='paper'&&paperVisual?`<img class="npc-list-portrait" src="${safe(encodeURI(paperImage(paperExpression(n))))}" alt="">`:'<div class="avatar" aria-hidden="true">✦</div>'}<div><strong>${safe(n.name)}</strong><div class="muted">${safe(stateText(n))} · ${safe(n.state.activityLabel)}</div></div><button class="secondary small" data-npc="${safe(n.id)}">詳細を見る</button></article>`).join('');
  $('#doors').innerHTML=data.hall.doors.map(d=>`<article class="door-card"><span class="door-glyph">◇</span><div><strong>${safe(d.name)}</strong><div class="muted">${d.status==='available'?'入口の採取ができます':'探索機能は次の開発段階で実装'}</div></div>${d.status==='available'?'<button class="secondary small" data-door="cave">探索する</button>':'<span class="tag">準備中</span>'}</article>`).join('');
  $('#doors').querySelector('[data-door="cave"]')?.addEventListener('click',handler(openCave));
  $('#npc-list').querySelectorAll('[data-npc]').forEach(b=>b.addEventListener('click',handler(()=>openNpc('hall'))));
  if(!data.npcs.length)$('#npc-list').innerHTML='<p class="muted">黄色い獣の姿はまだここにない。洞窟の扉を調べてみよう。</p>';
  show('hall');
  positionHallCaveDoor();
  if(data.requiredStory){toast('先に洞窟での大切な物語を体験しよう。');await openCave(1);return;}
  try{const gifts=await api('/gifts');const badge=$('#gift-ready-badge');badge.textContent=gifts.readyCount?`(${gifts.readyCount})`:'';badge.classList.toggle('hidden',!gifts.readyCount);}catch(e){console.warn('通信箱の更新に失敗:',e);}
}
let selectedCaveSection=1,activeCaveStory=null,caveStoryReplay=false;
const caveQty=(n)=>Number(n)||0;
async function openCave(sectionId=null){
  const {cave}=await api('/cave');
  if(!cave.sections.length)throw new Error('洞窟のデータがまだありません。');
  if(sectionId===null||!cave.sections.some(s=>s.id===sectionId))sectionId=cave.currentSection;
  selectedCaveSection=sectionId;
  mandatoryStory=!!cave.requiredStory;
  $('#cave-npc-section').classList.toggle('hidden',!cave.npcInCave||!!cave.requiredStory);
  $('#cave-npc-note').textContent=cave.npcInCave?'黄色い獣はまだ洞窟の入口で過ごしている。会いに行こう。':'';
  const navigation=$('#cave-sections');navigation.replaceChildren();
  for(const sec of cave.sections){
    const btn=document.createElement('button');btn.type='button';btn.className='secondary small'+(sec.id===sectionId?' selected':'');
    btn.textContent=sec.name;btn.addEventListener('click',handler(()=>openCave(sec.id)));navigation.append(btn);
  }
  $('#cave-construction').classList.toggle('hidden',cave.rescued);
  if(!cave.rescued){
    $('#cave-gate-title').textContent=cave.gateLabel;
    const total=cave.requirements.reduce((s,r)=>s+r.needed,0),done=cave.requirements.reduce((s,r)=>s+r.donated,0);
    $('#cave-progress-fill').style.width=(total?100*done/total:0)+'%';
    $('#cave-progress-label').textContent=`現在の区画：${done} / ${total} 納品済み`;
    const requirements=$('#cave-requirements');requirements.replaceChildren();
    const {items}=await api('/inventory');const owned=Object.fromEntries(items.map(i=>[i.id,i.quantity]));
    for(const req of cave.requirements){
      const card=document.createElement('div');card.className='requirement-row';
      const info=document.createElement('div');info.innerHTML=`<div class="material-inline">${matIcon(req.id)}<div><strong>${safe(req.name)}</strong><div class="muted tiny">納品済み ${req.donated} / ${req.needed}　残り ${req.remaining}　｜持ち物 ×${owned[req.id]||0}</div></div></div>`;
      card.append(info);
      if(req.remaining>0){
        const form=document.createElement('form');form.className='donation-form';
        const input=document.createElement('input');input.type='number';input.min='1';input.step='1';input.max=String(Math.min(req.remaining,owned[req.id]||0));input.value=String(Math.min(req.remaining,owned[req.id]||0,10)||1);input.setAttribute('aria-label',req.name+'の納品数');
        const btn=document.createElement('button');btn.type='submit';btn.textContent='納品';btn.className='secondary small';btn.disabled=(owned[req.id]||0)===0;
        form.append(input,btn);form.addEventListener('submit',handler(async e=>{
          e.preventDefault();const quantity=Number(input.value);
          if(!Number.isSafeInteger(quantity)||quantity<1||quantity>req.remaining||quantity>(owned[req.id]||0))throw new Error('納品数を確認してください。');
          btn.disabled=true;
          try{const result=await api('/cave/donate','POST',{sectionId:cave.currentSection,itemId:req.id,quantity});toast(result.message);await openCave(selectedCaveSection);}finally{btn.disabled=false;}
        }));card.append(form);
      }
      requirements.append(card);
    }
    $('#cave-excavate').classList.toggle('hidden',!cave.ready);
    $('#cave-excavate-note').textContent=cave.ready?'必要な素材がすべて揃いました。誰でも開拓できます。':'必要な素材を住人全員で持ち寄りましょう。';
    $('#cave-excavate').onclick=handler(async()=>{
      const btn=$('#cave-excavate');btn.disabled=true;
      try{const result=await api('/cave/excavate','POST',{sectionId:cave.currentSection});toast(result.message);await openCave();if(result.cave.rescued)await openStory('rescue',false);}finally{btn.disabled=false;}
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
  const entry=await api('/cave/section?id='+sectionId);
  visualImg('#cave-section-background',bgVisual.sections?.[sectionId]||bgVisual.cave);
  $('#cave-section-name').textContent=entry.section.name;
  $('#cave-description').textContent=entry.section.description;
  const list=$('#cave-spots');list.replaceChildren();
  for(const spot of entry.spots){
    const btn=document.createElement('button');btn.className='secondary gather-btn';
    btn.innerHTML=`<strong>${safe(spot.name)}</strong><span class="muted tiny">${safe(spot.description)}</span>`;
    btn.addEventListener('click',handler(async()=>{
      if(gathering)return;
      gathering=true;list.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{
        const result=await api('/cave/gather','POST',{sectionId,spotId:spot.id});
        const found=result.items.map(item=>`<span class="material-found-item">${matIcon(item.id)}<strong>${safe(item.name)} ×${Number(item.quantity)}</strong></span>`).join('、');
        $('#cave-result').innerHTML=`<div>${safe(result.message)}</div>${found?`<div>入手：${found}</div>`:''}`;
        $('#cave-result').classList.remove('hidden');
      }finally{gathering=false;list.querySelectorAll('button').forEach(b=>b.disabled=false);}
    }));list.append(btn);
  }
  $('#cave-result').classList.add('hidden');$('#cave-section-content').classList.remove('hidden');show('cave');
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
   api('/npcs/paper/gifts'),
   api('/catalog/gifts')
 ]);
 const discovered=new Set(discovery.ids||[]);
 const materials=MATERIALS.map(m=>({id:m.id,name:m.name,image:m.image,rarity:m.rarity,
   category:m.category,description:m.description,kind:'material',source:'洞窟',found:discovered.has(m.id)}));
 const events=(eventData.items||[]).map(e=>({id:e.id,name:e.name,description:e.description,
   kind:'event',source:e.source||'その他',found:true}));
 // 実際に「受け取った」プレゼントのみ。準備中や未受取は図鑑に出さない。
 const giftDefs=new Map((window.KAGARISO_GIFTS||[]).map(g=>[g.id,g]));
 const gifts=(giftData.inventory||[]).filter(g=>Number(g.quantity)>0).map(g=>{
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
   const kind=$('#catalog-kind').value;
   const source=$('#catalog-source').value;
   const selected=entries.filter(m=>(state==='all'||(state==='found'?m.found:!m.found))
     &&(kind==='all'||m.kind===kind)&&(source==='all'||m.source===source));
   $('#catalog-results').textContent=`表示：${selected.length} 件`;
   $('#material-catalog-grid').innerHTML=selected.map(item=>{
     const found=item.found;
     // 管理用ID（sozai0001 / C020 / GIFT_*）は画面には出さない。
     const thumb=found&&item.image
       ?`<img class="material-thumb" src="${safe(item.image)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('✧'))">`
       :found?'<span class="catalog-placeholder" aria-hidden="true">✧</span>'
       :'<div class="material-missing-icon" aria-hidden="true">？</div>';
     const subtitle=found
       ?`${safe(kindLabels[item.kind]||item.kind)} · ${safe(item.source)}${item.kind==='material'?' · '+safe(item.category)+' · '+'★'.repeat(item.rarity):''}`
       :item.kind==='gift'?'未入手のプレゼント':'未開放素材';
     return `<article class="material-catalog-card ${found?'':'undiscovered'}"><div class="material-catalog-image">${thumb}</div><strong>${found?safe(item.name):'？？？？？'}</strong><div class="muted tiny">${subtitle}</div>${found&&item.description?`<p class="muted tiny">${safe(item.description)}</p>`:''}</article>`;
   }).join('')||'<p class="muted catalog-empty">該当する品はまだありません。</p>';
 };
 const sourceSelect=$('#catalog-source');
 for(const source of new Set(entries.map(e=>e.source).filter(Boolean))){if(![...sourceSelect.options].some(o=>o.value===source)){const option=document.createElement('option');option.value=source;option.textContent=source;sourceSelect.append(option);}}
 for(const selector of ['#catalog-filter','#catalog-kind','#catalog-source'])$(selector).onchange=render;
 render();show('material-catalog');
}
// v0.11.8.1: 所持品のデータはサーバーのまま。並び替えは画面上だけで行う。
let inventorySortItems=[];
function renderInventoryItems(){
  const mode=$('#inventory-sort').value;
  const sourceFilter=$('#inventory-source').value;
  const items=inventorySortItems.filter(i=>sourceFilter==='all'||i.source===sourceFilter);
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
  $('#inventory-list').innerHTML=items.length?items.map(i=>`<article class="inventory-item">${i.kind==='gift'&&i.image?`<img class="material-thumb" src="${safe(i.image)}" loading="lazy" alt="" onerror="this.replaceWith(document.createTextNode('✧'))">`:matIcon(i.id)}<div><strong>${safe(i.name)}</strong><div class="muted tiny">${safe(i.category)} · ${safe(i.source)}${i.kind==='gift'?'':` · ${'★'.repeat(Math.max(1,Math.min(5,i.rarity)))}`}</div></div><strong>×${Number(i.quantity)}</strong></article>`).join(''):'<p class="muted">該当する持ち物はありません。</p>';
}
async function openInventory(from='hall'){
  inventoryReturn=from;
  const {items:serverItems,gifts:ownedGifts=[]}=await api('/inventory');
  inventorySortItems=[...serverItems.filter(i=>materialById(i.id)).map(i=>({...i,source:'洞窟',kind:'material'})),...ownedGifts.map(g=>({...g,id:g.itemId,category:'プレゼント',source:g.npcName||'黄色い獣',kind:'gift',rarity:0}))]; // 所持素材と受取済み返礼品を統合
  const sourceSelect=$('#inventory-source');const selectedSource=sourceSelect.value;
  for(const source of new Set(inventorySortItems.map(i=>i.source))){if(![...sourceSelect.options].some(o=>o.value===source)){const o=document.createElement('option');o.value=source;o.textContent=source;sourceSelect.append(o);}}
  sourceSelect.value=[...sourceSelect.options].some(o=>o.value===selectedSource)?selectedSource:'all';
  renderInventoryItems();
  show('inventory');
}
async function openNpc(from='hall'){npcReturn=from;const {npc}=await api('/npcs/paper');currentNpc=npc;lastLocation=npc.state.location;profileScene=npc.scene;$('#life-action-result').classList.add('hidden');$('#npc-move-notice').classList.add('hidden');renderNpc(false);show('npc');profileTimer=setInterval(async()=>{if(document.hidden)return;try{const {npc:updated}=await api('/npcs/paper');const old=lastLocation;currentNpc=updated;lastLocation=updated.state.location;renderNpc(old!==updated.state.location);}catch{}},15000);}
function renderNpc(moved){const n=currentNpc;
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
  visualImg('#conversation-background',npc.state.location==='cave'?bgVisual.cave:bgVisual.hall);
  paintPaper('#conversation-paper-image',npc);
  $('#conversation-scene').textContent=npc.scene;
  $('#speech-line').textContent='「あっ、キミ！ なに おはなし する？」';
  $('#conversation-result').classList.add('hidden');
  const menu=await api('/npcs/paper/conversation/options');
  renderConversationChoices(menu.choices);
  show('conversation');
  refreshAiStatus().catch(()=>{ $('#npc-ai-remaining').textContent='AI会話を確認できませんでした。'; });
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
        currentNpc=data.npc;paintPaper('#conversation-paper-image',data.npc);
        $('#speech-line').textContent=data.response;
        $('#conversation-result').textContent=data.affinityChange?'黄色い獣と、すこしずつ親しくなっているようです。':'黄色い獣はあなたとの会話を楽しんでいるようです。';
        $('#conversation-result').classList.remove('hidden');
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
  $('#npc-ai-remaining').textContent=`今日のAI自由会話：${usage.used}/${usage.limit}回（残り${usage.remaining}回）`+(usage.globalRemaining<=0?' ／ 今日の全体上限に達しました':'');
  const blocked=usage.remaining<=0||usage.globalRemaining<=0||currentNpc?.state?.activity==='sleeping';
  $('#npc-ai-send').disabled=aiSending||blocked;
};
const refreshAiStatus=async()=>{
  const data=await api('/npcs/paper/ai/status');showAiUsage(data.usage);
};
$('#npc-ai-form').addEventListener('submit',handler(async event=>{
  event.preventDefault();
  if(aiSending)return;
  const message=$('#npc-ai-message').value.trim();
  if(!message){toast('話しかけたいことを書いてね。');return;}
  aiSending=true;$('#npc-ai-send').disabled=true;
  $('#npc-ai-result').classList.remove('hidden');
  $('#npc-ai-result').textContent='黄色い獣が おへんじを かんがえているよ…';
  try{
    const result=await api('/npcs/paper/ai/chat','POST',{message});
    currentNpc=result.npc;
    paintPaper('#conversation-paper-image',result.npc);
    $('#speech-line').textContent=result.response;
    $('#npc-ai-result').textContent='黄色い獣がお返事してくれたよ。';
    $('#npc-ai-message').value='';
    showAiUsage(result.usage);
  }catch(error){
    $('#npc-ai-result').textContent=error.message||'AIとの通信がうまくいかなかったようです。';
    throw error;
  }finally{
    aiSending=false;
    try{await refreshAiStatus();}catch{$('#npc-ai-send').disabled=false;}
  }
}));
const renderAiHistory=async()=>{
  const list=$('#ai-history-list');list.replaceChildren();
  try{
    const {history}=await api('/npcs/paper/ai/history');
    if(!history.length){list.textContent='まだ自由会話の記録はありません。';return;}
    for(const entry of [...history].reverse()){
      const block=document.createElement('article');block.className='history-entry';
      const t=document.createElement('time');t.textContent=`${entry.createdAt} UTC`;
      const q=document.createElement('p');q.textContent=`あなた：${entry.message}`;
      const a=document.createElement('p');a.textContent=`黄色い獣：${entry.response}`;
      block.append(t,q,a);list.append(block);
    }
  }catch(error){list.textContent='AI会話の履歴を読み込めませんでした。';}
};

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
  for(const [kind,selector] of [['meal','#npc-feeding-meals'],['snack','#npc-feeding-snacks']]){
    const list=$(selector);list.replaceChildren();
    const items=data.items.filter(x=>x.kind===kind);
    if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent=kind==='meal'?'あげられるごはんをまだ持っていません。':'あげられるおやつをまだ持っていません。';list.append(p);continue;}
    for(const item of items){
      const card=document.createElement('div');card.className='feeding-item';
      const thumb=document.createElement('div');thumb.innerHTML=matIcon(item.id);card.append(thumb);
      const info=document.createElement('div');info.className='feeding-item-info';
      const name=document.createElement('strong');name.textContent=item.name;info.append(name);
      const qty=document.createElement('p');qty.className='muted tiny';qty.textContent=`所持数 ×${item.quantity} ・ 満腹度 +${item.restore}`;info.append(qty);card.append(info);
      const button=document.createElement('button');button.type='button';button.className='secondary small';button.textContent='1個あげる';
      button.disabled=feedingBusy||!data.canFeed;
      button.addEventListener('click',handler(async()=>{
        if(feedingBusy)return;feedingBusy=true;
        $('#npc-feeding-meals').querySelectorAll('button').forEach(b=>b.disabled=true);
        $('#npc-feeding-snacks').querySelectorAll('button').forEach(b=>b.disabled=true);
        try{
          const outcome=await api('/npcs/paper/feeding','POST',{itemId:item.id});
          feedingBusy=false;
          currentNpc=outcome.npc;
          renderFeeding({...outcome,canFeed:outcome.npc.state.activity!=='sleeping'&&outcome.npc.state.hunger>15},outcome.message);
        }catch(error){feedingBusy=false;const refreshed=await api('/npcs/paper/feeding');renderFeeding(refreshed);throw error;}
      }));card.append(button);list.append(card);
    }
  }
};
async function openNpcFeeding(){
  feedingReturn=document.querySelector('#conversation-page:not(.hidden)')?'conversation':'npc';
  const data=await api('/npcs/paper/feeding');
  renderFeeding(data);
  $('#npc-feeding-back').textContent=feedingReturn==='conversation'?'← お話に戻る':'← 黄色い獣のプロフィールへ';
  show('npc-feeding');
}

// v0.8: 共通受信箱。ホールからは全員分、プロフィールからは黄色い獣分を表示。
let giftBusy=false,giftReturn='hall',giftInventory=[];
const giftDate=text=>text?new Date(String(text).replace(' ','T')+'Z').toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'';
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
 const inbox=$('#npc-gifts-inbox'),inventory=$('#npc-gifts-inventory'),history=$('#npc-gifts-history');
 const addGiftImage=(container,gift)=>{if(!gift.image)return;const img=document.createElement('img');img.className='npc-gift-image';img.alt=gift.name||'返礼品';img.loading='lazy';img.src=encodeURI(gift.image);img.onerror=()=>img.remove();container.insertBefore(img,container.firstChild);};
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
        form.append(input,button);
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
    const card=document.createElement('article');card.className='request-card';card.append(subHeading(`${t.mode==='permanent'?'［常設］':'［今日の候補］'} ★${'★'.repeat(Math.max(0,t.difficulty-1))} ${t.title}`,t.description));
    const p=document.createElement('div');p.className='muted tiny';p.innerHTML='必要素材：'+t.items.map(i=>`<span class="material-found-item">${matIcon(i.id)}${safe(i.name)} ×${i.needed}</span>`).join('、');card.append(p);
    const button=document.createElement('button');button.className='secondary small';button.textContent='このお願いを引き受ける';button.disabled=!requests.canAccept;
    button.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;button.disabled=true;
      try{const data=await api('/npcs/paper/requests/accept','POST',{templateKey:t.key});await openNpcRequests(data.message);}finally{requestBusy=false;}
    });card.append(button);availableList.append(card);
  }
  if(!requests.templates.length&&!(requests.permanent||[]).length)availableList.innerHTML='<p class="muted">今日の候補はすべて受注済み、または完了しました。また明日見にきてね。</p>';
  if(!requests.canAccept){const p=document.createElement('p');p.className='muted tiny';p.textContent='今日の受注上限、または同時受注3件の上限に達しています。';availableList.prepend(p);}
  for(const r of requests.history){const p=document.createElement('div');p.className='request-history-entry';p.textContent=`${r.title} — ${r.status==='completed'?'完了':'取り消し'}（${r.resolvedAt||r.createdAt} UTC）`;historyList.append(p);}
  if(!requests.history.length)historyList.textContent='まだ履歴はありません。';
  show('npc-requests');
}

// v0.11 言葉帳。全住人が共有する言葉だけを表示し、個別の関係履歴とは分けて保存。
let teachingWord=false;
const renderWordBook=(data)=>{
  $('#word-count').textContent=`（${data.total}こ）`;
  const list=$('#npc-words-list');list.replaceChildren();
  if(!data.words.length){const p=document.createElement('p');p.className='muted';p.textContent='まだおぼえた言葉はありません。最初の言葉を教えてみよう！';list.append(p);}
  for(const w of data.words){
    const card=document.createElement('article');card.className='request-card';
    const name=document.createElement('strong');name.textContent=w.word;card.append(name);
    for(const detail of [`意味：${w.meaning}`,`使うとき：${w.usage}`,`教わった回数：${w.lessons}回 ／ 教えてくれた住人：${w.teachers}人`,`理解度：${'★'.repeat(w.understanding)}${'☆'.repeat(3-w.understanding)}`]){
      const p=document.createElement('p');p.className='muted tiny';p.textContent=detail;card.append(p);
    }
    const b=document.createElement('button');b.className='secondary small';b.textContent='この言葉を教え直す';
    b.addEventListener('click',()=>{$('#teach-word').value=w.word;$('#teach-meaning').value=w.meaning;$('#teach-usage').value=w.usage;$('#teach-meaning').focus();window.scrollTo({top:0,behavior:'smooth'});});
    card.append(b);list.append(card);
  }
  const hist=$('#npc-words-history');hist.replaceChildren();
  if(!data.history.length){const p=document.createElement('p');p.className='muted';p.textContent='まだ学習履歴はありません。';hist.append(p);}
  for(const entry of data.history){const card=document.createElement('article');card.className='request-card';
    const title=document.createElement('strong');title.textContent=`${entry.word} ／ ${entry.teacher}`;card.append(title);
    for(const value of [`意味：${entry.meaning}`,`使い方：${entry.usage}`,`記録：${entry.createdAt} UTC`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=value;card.append(p);}
    hist.append(card);
  }
};
async function openNpcWords(message=''){
  const data=await api('/npcs/paper/words');renderWordBook(data);
  const notice=$('#npc-words-message');notice.textContent=message;notice.classList.toggle('hidden',!message);
  show('npc-words');
}
bind('#open-npc-words',()=>openNpcWords());
bind('#npc-words-back',()=>openNpc(npcReturn));
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
bind('#open-npc-requests',()=>openNpcRequests());
bind('#npc-requests-back',()=>openNpc(npcReturn));

bind('#hall-paper-actor',()=>openNpc('hall'));
// 左端の茶色い扉をクリック・タップして洞窟へ移動。
bind('#hall-cave-door',()=>openCave());
bind('#refresh-hall',openHall);
bind('#open-inventory',()=>openInventory('hall'));
bind('#open-material-catalog',openMaterialCatalog);
bind('#material-catalog-back',openHall);
bind('#cave-inventory-btn',()=>openInventory('cave'));
bind('#cave-refresh',()=>openCave(selectedCaveSection));
bind('#cave-npc-visit',()=>openNpc('cave'));
bind('#cave-story-back',async()=>{if(mandatoryStory)throw new Error('最初の物語を最後まで読んでね。');await openCave(selectedCaveSection);});
bind('#cave-story-done',()=>openCave(selectedCaveSection));
bind('#inventory-back',async()=>{if(inventoryReturn==='cave')await openCave(selectedCaveSection);else await openHall();});
$('#inventory-sort').addEventListener('change',renderInventoryItems);
$('#inventory-source').addEventListener('change',renderInventoryItems);
for(const [selector,action] of [['#rest-btn','rest'],['#wake-btn','wake']]){bind(selector,async()=>{const data=await api('/npcs/paper/life/action','POST',{action});currentNpc=data.npc;const last=lastLocation;lastLocation=data.npc.state.location;renderNpc(last!==lastLocation);$('#life-action-result').textContent=data.message;$('#life-action-result').classList.remove('hidden');});}
bind('#talk-btn',openConversation);
bind('#room-btn',enterRoom);
async function enterRoom(){const data=await api('/npcs/paper/room/enter','POST',{});$('#room-message').textContent=data.message;show('room');}
bind('#room-talk',openConversation);
bind('#conversation-close',()=>openNpc(npcReturn));
bind('#npc-ai-history-open',async()=>$('#history-btn').click());
bind('#history-btn',async()=>{const {history}=await api('/npcs/paper/history');const list=$('#history-list');list.innerHTML=history.length?history.map(h=>`<article class="history-entry"><time>${safe(h.created_at)} UTC</time><p>${safe(h.response)}</p><span class="muted">${h.affinity_change?'少し親しくなった':''}</span></article>`).join(''):'<p class="muted">まだ会話の記録がありません。</p>';await renderAiHistory();show('history');});
document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',handler(async()=>{const page=el.dataset.back;if(page==='hall'){if(el.id==='npc-back'&&npcReturn==='cave')await openCave(selectedCaveSection);else await openHall();}else if(page==='npc')await openNpc(npcReturn);})));

// 管理者セッションは住人セッションと混在させない。
const adminApi=async(path,method='GET',body,overrideToken=null)=>{
  const auth=overrideToken===null?adminToken:overrideToken;
  const response=await fetch(`${API}/api/admin${path}`,{method,headers:{...(auth?{'Authorization':`Bearer ${auth}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({error:'応答を読み取れませんでした。'}));
  if(!response.ok){
    if(response.status===401&&path!=='/login'){adminToken='';sessionStorage.removeItem(ADMIN_SESSION_KEY);show('admin-login');}
    throw new Error(data.error||'管理者の操作に失敗しました。');
  }
  return data;
};
const adminReturn=async()=>{if(token)await openHall();else show('auth');};
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
bind('#admin-logout',async()=>{
  try{await adminApi('/logout','POST',{});}finally{adminToken='';sessionStorage.removeItem(ADMIN_SESSION_KEY);show('admin-login');}
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
const openAdminEditor=async()=>{
  const me=await adminApi('/me');
  $('#admin-logged-name').textContent=me.admin.displayName;
  const data=await adminApi('/topics?npc=paper');adminTopicsCache=data.topics||[];
  adminSelected=structuredClone(adminTopicsCache.find(t=>t.id===adminSelected?.id)||adminTopicsCache[0]||blankAdminTopic());
  adminEditForm();adminList();show('admin-editor');
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
    p.textContent=`${x.at} UTC ／ ${x.admin} ／ ${x.action} ／ ${x.label||x.id}`;list.append(p);
  });
});


// v0.11.6 管理者専用「お願いエディター」。管理者ログインをそのまま利用。
const ADMIN_MATERIALS=[
  ['C026','廃木材'],['C002','金属スクラップ'],['C008','洞窟キノコ'],['C001','ごつごつした石'],['C003','湿った粘土'],['C004','赤錆鉱石'],['C005','青白い水晶'],['C006','呼吸する石'],
  ['C009','岩陰の豆'],['C010','白い根菜'],['C011','鈴鳴り苔'],['C012','眠り茸'],['C013','逆さに咲く花'],['C014','洞窟鳥の卵'],['C015','洞窟鳥の羽根'],['C016','抜け落ちた牙'],['C017','脱皮した透明な皮'],['C018','洞窟獣の柔らかな毛'],['C021','岩蜜'],['C022','甘い地底果汁'],['C020','夜光の雫'],['C025','折れた木の棒'],['C027','丈夫な地下蔓'],['C028','色褪せた布'],['C029','しなやかな根木'],['C023','光る石'],['C019','誰のものでもない卵'],['C024','いつまでも冷たい水']
];
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
  $('#admin-gifts-panel').classList.add('hidden');$('#admin-requests-panel').classList.remove('hidden');$('#admin-conversations-panel').classList.add('hidden');
  await loadAdminRequestEditor();
});
bind('#admin-show-dialogue-editor',()=>{
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
  history.forEach(x=>{const p=document.createElement('p');p.className='muted tiny';p.textContent=`${x.at} UTC ／ ${x.admin} ／ ${x.action} ／ ${x.title||x.key}`;list.append(p);});
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
 history.forEach(x=>{const p=document.createElement('p');p.className='muted tiny';p.textContent=`${x.at} UTC ／ ${x.admin} ／ ${x.action} ／ ${x.name||x.itemId}`;list.append(p);});
});

(async()=>{if(token){try{await openHall();}catch(e){toast(e.message);show('auth');}}else show('auth');})();
})();
