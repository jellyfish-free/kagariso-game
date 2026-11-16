/* 神狩荘・フロントエンド 初期版。外部ライブラリなし。 */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const API=(window.KAGARISO_API_BASE||'').replace(/\/$/,'');
const SESSION_KEY='kagariso_starter_session_v1';
let token=localStorage.getItem(SESSION_KEY)||'';
let resident=null, currentNpc=null, lastLocation=null, profileScene='', profileTimer=null;
let pendingRecovery='';
let inventoryReturn='hall';
let gathering=false;
const pages=['auth','recovery','hall','npc','conversation','room','history','cave','cave-story','inventory','material-catalog','npc-requests','npc-gifts'];
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
const stateText=(npc)=>npc.state.locationLabel;
async function openHall(){const data=await api('/hall');resident=data.resident;$('#user-name').textContent=resident.name;$('#user-bar').classList.remove('hidden');
  $('#npc-list').innerHTML=data.npcs.map(n=>`<article class="npc-card"><div class="avatar" aria-hidden="true">✦<span class="avatar-ears">⌃⌃</span></div><div><strong>${safe(n.name)}</strong><div class="muted">${safe(stateText(n))} · ${safe(n.state.activityLabel)}</div></div><button class="secondary small" data-npc="${safe(n.id)}">詳細を見る</button></article>`).join('');
  $('#doors').innerHTML=data.hall.doors.map(d=>`<article class="door-card"><span class="door-glyph">◇</span><div><strong>${safe(d.name)}</strong><div class="muted">${d.status==='available'?'入口の採取ができます':'探索機能は次の開発段階で実装'}</div></div>${d.status==='available'?'<button class="secondary small" data-door="cave">探索する</button>':'<span class="tag">準備中</span>'}</article>`).join('');
  $('#doors').querySelector('[data-door="cave"]')?.addEventListener('click',handler(openCave));
  $('#npc-list').querySelectorAll('[data-npc]').forEach(b=>b.addEventListener('click',handler(openNpc)));
  show('hall');
  try{const gifts=await api('/gifts');const badge=$('#gift-ready-badge');badge.textContent=gifts.readyCount?`(${gifts.readyCount})`:'';badge.classList.toggle('hidden',!gifts.readyCount);}catch(e){console.warn('受信箱の更新に失敗:',e);}
}
let selectedCaveSection=1,activeCaveStory=null,caveStoryReplay=false;
const caveQty=(n)=>Number(n)||0;
async function openCave(sectionId=null){
  const {cave}=await api('/cave');
  if(!cave.sections.length)throw new Error('洞窟のデータがまだありません。');
  if(sectionId===null||!cave.sections.some(s=>s.id===sectionId))sectionId=cave.currentSection;
  selectedCaveSection=sectionId;
  const navigation=$('#cave-sections');navigation.replaceChildren();
  for(const sec of cave.sections){
    const btn=document.createElement('button');btn.type='button';btn.className='secondary small'+(sec.id===sectionId?' selected':'');
    btn.textContent=sec.name;btn.addEventListener('click',handler(()=>openCave(sec.id)));navigation.append(btn);
  }
  $('#cave-construction').classList.toggle('hidden',cave.rescued);
  $('#cave-rescue-status').classList.toggle('hidden',!cave.rescued);
  if(cave.rescued)$('#cave-rescue-status').textContent='洞窟の出口が開かれました。すべての開放済み区画で、引き続き採取できます。';
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
  const history=$('#cave-history');history.replaceChildren();
  for(const event of cave.stories){const btn=document.createElement('button');btn.className='secondary';btn.textContent=event.title+'（読み返す）';btn.addEventListener('click',handler(()=>openStory(event.id,true)));history.append(btn);}
  if(cave.rescued&&!cave.stories.some(s=>s.id==='rescue')){
    const btn=document.createElement('button');btn.className='secondary';btn.textContent='黄色い獣の救出を体験する';btn.addEventListener('click',handler(()=>openStory('rescue',false)));history.prepend(btn);
  }
  if(!history.children.length){const p=document.createElement('p');p.className='muted';p.textContent='まだ思い出がありません。';history.append(p);}
  const entry=await api('/cave/section?id='+sectionId);
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
  if(entry.story)await openStory(entry.story.id,false);
}
async function openStory(storyId,replay){
  const {story,seen,originalChoice}=await api('/cave/story?id='+encodeURIComponent(storyId));
  if(replay&&!seen)throw new Error('まだ体験していない物語です。');
  activeCaveStory=storyId;caveStoryReplay=replay;
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
}
// v0.9.2 図鑑: 素材は45枠を常時公開し、イベント品・プレゼントは取得後のみ追加。
// ジャンル／発見状態／入手場所を独立して絞り込める。
async function openMaterialCatalog(){
 const [discovery,eventData,giftData]=await Promise.all([
   api('/materials/discovered'),
   api('/catalog/events'),
   api('/npcs/paper/gifts')
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
     image:def.image||'',kind:'gift',source:'NPC',found:true};
 });
 // 作製物の所持記録は未実装。今後の調合・工作システム追加時にここへ統合する。
 const entries=[...materials,...events,...gifts];
 const progress=$('#catalog-progress');
 progress.textContent=`通常素材：${materials.filter(m=>m.found).length} / ${materials.length} 種類発見　｜　イベントアイテム：${events.length} 種類　｜　プレゼント：${gifts.length} 種類`;
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
       :'未開放素材';
     return `<article class="material-catalog-card ${found?'':'undiscovered'}"><div class="material-catalog-image">${thumb}</div><strong>${found?safe(item.name):'？？？？？'}</strong><div class="muted tiny">${subtitle}</div>${found&&item.description?`<p class="muted tiny">${safe(item.description)}</p>`:''}</article>`;
   }).join('')||'<p class="muted catalog-empty">該当する品はまだありません。</p>';
 };
 for(const selector of ['#catalog-filter','#catalog-kind','#catalog-source'])$(selector).onchange=render;
 render();show('material-catalog');
}
async function openInventory(from='hall'){
  inventoryReturn=from;
  const {items:serverItems}=await api('/inventory');
  const items=serverItems.filter(i=>materialById(i.id)); // v0.9.1: 旧素材は画面にも表示しない
  $('#inventory-list').innerHTML=items.length?items.map(i=>`<article class="inventory-item">${matIcon(i.id)}<div><strong>${safe(i.name)}</strong><div class="muted tiny">${safe(i.category)} · ${'★'.repeat(Math.max(1,Math.min(5,i.rarity)))}</div></div><strong>×${Number(i.quantity)}</strong></article>`).join(''):'<p class="muted">まだ素材を持っていません。洞窟で採取してみよう。</p>';
  show('inventory');
}
async function openNpc(){const {npc}=await api('/npcs/paper');currentNpc=npc;lastLocation=npc.state.location;profileScene=npc.scene;$('#life-action-result').classList.add('hidden');$('#npc-move-notice').classList.add('hidden');renderNpc(false);show('npc');profileTimer=setInterval(async()=>{if(document.hidden)return;try{const {npc:updated}=await api('/npcs/paper');const old=lastLocation;currentNpc=updated;lastLocation=updated.state.location;renderNpc(old!==updated.state.location);}catch{}},15000);}
function renderNpc(moved){const n=currentNpc;
  $('#npc-affinity').textContent='♥'.repeat(n.affinity)+'♡'.repeat(10-n.affinity);
  $('#npc-relationship').textContent=`あなたとの関係：${n.relationship}`;
  $('#npc-relationship-detail').textContent=`${n.relationship}（好感度 ${n.affinity}/10）`;
  $('#npc-life-status').innerHTML=['energy','hunger','mood'].map((k)=>{const labels={energy:'元気',hunger:'空腹',mood:'気分'};const descriptions={energy:n.state.energyLabel,hunger:n.state.hungerLabel,mood:n.state.moodLabel};return `<div class="life-item"><span>${labels[k]}</span><strong>${safe(descriptions[k])}</strong></div>`;}).join('');
  $('#rest-btn').disabled=n.state.activity!=='awake';
  $('#wake-btn').disabled=n.state.activity!=='sleeping'||!n.roomUnlocked;
  $('#npc-live-state').innerHTML=`<div class="state-item"><span>現在地</span><strong>${safe(n.state.locationLabel)}</strong></div><div class="state-item"><span>活動状態</span><strong>${safe(n.state.activityLabel)}</strong></div>`;
  $('#npc-scene').textContent=profileScene;
  $('#npc-bio').textContent=n.description;$('#npc-personality').textContent=n.personality;
  if(moved){$('#npc-move-notice').textContent=`黄色い獣は${n.state.locationLabel}へ移動しました。描写はプロフィールを開き直すと更新されます。` ;$('#npc-move-notice').classList.remove('hidden');}
  else if($('#npc-move-notice').classList.contains('hidden')) {} // 移動通知は開き直すまで残す
  $('#talk-btn').disabled=n.state.activity==='sleeping'||(n.state.location==='room'&&!n.roomUnlocked);
  $('#talk-btn').title=n.state.activity==='sleeping'?'黄色い獣は眠っています。':'';
  $('#visit-btn').textContent=n.state.location==='hall'?'ホールで会う':'自室へ会いに行く';
  $('#visit-btn').disabled=n.state.location==='room'&&!n.roomUnlocked;
  $('#room-btn').disabled=!n.roomUnlocked||n.state.location!=='room'||n.state.activity==='sleeping';
  $('#room-btn').title=n.roomUnlocked?'':'仲良くなると訪問できます。';
}
const openConversation=async()=>{
  const {npc}=await api('/npcs/paper'); if(npc.state.activity==='sleeping') throw new Error('黄色い獣は眠っています。');
  if(npc.state.location==='room'&&!npc.roomUnlocked)throw new Error('今は黄色い獣の自室に入れません。');
  currentNpc=npc;
  $('#conversation-scene').textContent=npc.scene;
  $('#speech-line').textContent='「あっ、来てくれたんだ！ 何のお話する？」';
  $('#conversation-result').classList.add('hidden');
  $('#conversation-choices').innerHTML='';
  const options=[{id:'greet',label:'挨拶する'},{id:'food',label:'好きな食べ物について聞く'},{id:'cave',label:'洞窟について聞く'}];
  for(const opt of options){const btn=document.createElement('button');btn.className='secondary';btn.textContent=opt.label;btn.addEventListener('click',handler(async()=>{
    const data=await api('/npcs/paper/conversation','POST',{choice:opt.id});currentNpc=data.npc;$('#speech-line').textContent=data.response;
    $('#conversation-result').textContent=data.affinityChange?'黄色い獣と少し仲良くなりました！':'黄色い獣はあなたとの会話を楽しんでいるようです。';
    $('#conversation-result').classList.remove('hidden');
  }));$('#conversation-choices').append(btn);}
  show('conversation');
};

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
 const common=$('#gifts-common-sections');common.classList.toggle('hidden',onlyPaper);
 $('#resident-gifts-history-wrap').classList.toggle('hidden',onlyPaper);
 $('#gifts-heading').textContent=onlyPaper?'受けとったプレゼント':'受信箱';
 $('#gifts-eyebrow').textContent=onlyPaper?'GIFTS FROM PAPER':'YOUR MAILBOX';
 $('#npc-gift-section-heading').textContent=onlyPaper?'黄色い獣からの贈り物':'NPCから届いた贈り物';
 inbox.replaceChildren();inventory.replaceChildren();history.replaceChildren();
 const notification=$('#npc-gifts-message');notification.classList.toggle('hidden',!message);notification.textContent=message;
 for(const gift of npc.inbox){
  const card=giftCard(gift.ready?gift.name:'黄色い獣がお礼を準備中',gift.ready?'贈り主：黄色い獣　・　受け取りできます':`贈り主：黄色い獣　・　完成予定：${giftDate(gift.readyAt)}（日本時間）`);
  if(gift.ready){
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
 for(const item of npc.inventory){inventory.append(giftCard(`${item.name} ×${item.quantity}`,item.description));}
 giftEmpty(inventory,'まだ記念品を受け取っていません。');
 for(const gift of npc.history){
  const detail=document.createElement('details');detail.className='gift-history-entry';const title=document.createElement('summary');title.textContent=`${gift.name}｜${giftDate(gift.receivedAt)}`;detail.append(title);
  for(const str of [`説明：${gift.description}`,`贈り主：${gift.sender}`,`受け取った日：${giftDate(gift.receivedAt)}`,`メッセージ：${gift.message}`,`あなたの返答：${gift.replyChoice==='effort'?'頑張って作ってくれたんだね':'ありがとう！ 嬉しいよ！'}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=str;detail.append(p);}
  history.append(detail);
 }
 giftEmpty(history,'まだ受け取り履歴はありません。');
 if(!onlyPaper){
  const incoming=$('#resident-gifts-inbox'),outgoing=$('#resident-gifts-outgoing'),received=$('#resident-gifts-history');
  incoming.replaceChildren();outgoing.replaceChildren();received.replaceChildren();
  for(const g of data.transfers){
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
   if(!g.incoming){
    const label={pending:'受取待ち',accepted:'受取済み',declined:'辞退されました',cancelled:'取り消し'}[g.status]||g.status;
    const card=giftCard(`${g.receiver}へ贈った素材｜${label}`,summary);
    if(g.message){const p=document.createElement('p');p.className='muted tiny';p.textContent=`添えたメッセージ：${g.message}`;card.append(p);}
    if(g.status==='pending'){const btn=document.createElement('button');btn.className='secondary small';btn.textContent='送信を取り消す';btn.addEventListener('click',handler(async()=>{if(giftBusy)return;giftBusy=true;btn.disabled=true;try{const result=await api('/gifts/resolve','POST',{giftId:g.id,action:'cancel'});await openNpcGifts('hall',result.message);}finally{giftBusy=false;}}));card.append(btn);}
    outgoing.append(card);
   }
   if(g.incoming&&g.status==='accepted'){
    const card=document.createElement('details');card.className='gift-history-entry';
    const title=document.createElement('summary');title.textContent=`${summary}｜${giftDate(g.resolvedAt)}`;card.append(title);
    for(const str of [`贈り主：${g.sender}`,`受け取った日：${giftDate(g.resolvedAt)}`,`メッセージ：${g.message||'なし'}`]){const p=document.createElement('p');p.className='muted tiny';p.textContent=str;card.append(p);}
    received.append(card);
   }
  }
  giftEmpty(incoming,'住人から届いている贈り物はありません。');
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
bind('#npc-gifts-back',async()=>{if(giftReturn==='npc')await openNpc();else await openHall();});
// v0.6 黄色い獣のお願い。表示情報はすべてサーバーから取得する。
let requestBusy=false;
const showRequestsMessage=(text)=>{const el=$('#npc-requests-message');el.textContent=text;el.classList.remove('hidden');};
async function openNpcRequests(message=''){
  const {requests}=await api('/npcs/paper/requests');
  const activeList=$('#npc-requests-active'),availableList=$('#npc-requests-available'),historyList=$('#npc-requests-history');
  activeList.replaceChildren();availableList.replaceChildren();historyList.replaceChildren();
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
  for(const t of requests.templates){
    const card=document.createElement('article');card.className='request-card';card.append(subHeading(t.title,t.description));
    const p=document.createElement('div');p.className='muted tiny';p.innerHTML='必要素材：'+t.items.map(i=>`<span class="material-found-item">${matIcon(i.id)}${safe(i.name)} ×${i.needed}</span>`).join('、');card.append(p);
    const button=document.createElement('button');button.className='secondary small';button.textContent='このお願いを引き受ける';button.disabled=!requests.canAccept;
    button.onclick=handler(async()=>{
      if(requestBusy)return;requestBusy=true;button.disabled=true;
      try{const data=await api('/npcs/paper/requests/accept','POST',{templateKey:t.key});await openNpcRequests(data.message);}finally{requestBusy=false;}
    });card.append(button);availableList.append(card);
  }
  if(!requests.templates.length)availableList.innerHTML='<p class="muted">今は新しいお願いがありません。</p>';
  if(!requests.canAccept){const p=document.createElement('p');p.className='muted tiny';p.textContent='同時に受けられるお願いは3件までです。';availableList.prepend(p);}
  for(const r of requests.history){const p=document.createElement('div');p.className='request-history-entry';p.textContent=`${r.title} — ${r.status==='completed'?'完了':'取り消し'}（${r.resolvedAt||r.createdAt} UTC）`;historyList.append(p);}
  if(!requests.history.length)historyList.textContent='まだ履歴はありません。';
  show('npc-requests');
}
bind('#open-npc-requests',()=>openNpcRequests());
bind('#npc-requests-back',openNpc);

bind('#refresh-hall',openHall);
bind('#open-inventory',()=>openInventory('hall'));
bind('#open-material-catalog',openMaterialCatalog);
bind('#material-catalog-back',openHall);
bind('#cave-inventory-btn',()=>openInventory('cave'));
bind('#cave-refresh',()=>openCave(selectedCaveSection));
bind('#cave-story-back',()=>openCave(selectedCaveSection));
bind('#cave-story-done',()=>openCave(selectedCaveSection));
bind('#inventory-back',async()=>{if(inventoryReturn==='cave')await openCave(selectedCaveSection);else await openHall();});
for(const [selector,action] of [['#rest-btn','rest'],['#wake-btn','wake']]){bind(selector,async()=>{const data=await api('/npcs/paper/life/action','POST',{action});currentNpc=data.npc;const last=lastLocation;lastLocation=data.npc.state.location;renderNpc(last!==lastLocation);$('#life-action-result').textContent=data.message;$('#life-action-result').classList.remove('hidden');});}
bind('#talk-btn',openConversation);
bind('#visit-btn',async()=>{if(currentNpc.state.location==='hall'){toast('黄色い獣はホールにいます。');return;}await enterRoom();});
bind('#room-btn',enterRoom);
async function enterRoom(){const data=await api('/npcs/paper/room/enter','POST',{});$('#room-message').textContent=data.message;show('room');}
bind('#room-talk',openConversation);
bind('#conversation-close',openNpc);
bind('#history-btn',async()=>{const {history}=await api('/npcs/paper/history');const list=$('#history-list');list.innerHTML=history.length?history.map(h=>`<article class="history-entry"><time>${safe(h.created_at)} UTC</time><p>${safe(h.response)}</p><span class="muted">${h.affinity_change?'♥ 好感度が上昇':''}</span></article>`).join(''):'<p class="muted">まだ会話の記録がありません。</p>';show('history');});
document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',handler(async()=>{const page=el.dataset.back;if(page==='hall')await openHall();else if(page==='npc')await openNpc();})));
(async()=>{if(token){try{await openHall();}catch(e){toast(e.message);show('auth');}}else show('auth');})();
})();
