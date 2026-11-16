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
const pages=['auth','recovery','hall','npc','conversation','room','history','cave','cave-story','inventory'];
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
      const info=document.createElement('div');info.innerHTML=`<strong>${safe(req.name)}</strong><div class="muted tiny">納品済み ${req.donated} / ${req.needed}　残り ${req.remaining}　｜持ち物 ×${owned[req.id]||0}</div>`;
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
    const btn=document.createElement('button');btn.className='secondary';btn.textContent='ぺーぱーの救出を体験する';btn.addEventListener('click',handler(()=>openStory('rescue',false)));history.prepend(btn);
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
        const found=result.items.map(item=>`<strong>${safe(item.name)} ×${Number(item.quantity)}</strong>`).join('、');
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
  $('#cave-story-scene').textContent=story.scene;
  $('#cave-story-speech').textContent=story.speech;
  $('#cave-story-result').classList.add('hidden');$('#cave-story-done').classList.add('hidden');
  const choices=$('#cave-story-choices');choices.replaceChildren();
  if(replay){const note=document.createElement('p');note.className='muted tiny';note.textContent='読み返し中：好きな返答を試せます。最初に選んだ内容は変わりません。';choices.append(note);}
  for(const choice of story.choices){const btn=document.createElement('button');btn.className='secondary';btn.textContent=choice.label+(replay&&choice.id===originalChoice?'（初回の選択）':'');
    btn.addEventListener('click',handler(async()=>{
      const response=await api('/cave/story/choose','POST',{storyId,choiceId:choice.id,replay});
      $('#cave-story-result').textContent=response.message;$('#cave-story-result').classList.remove('hidden');
      $('#cave-story-done').classList.remove('hidden');if(!replay)choices.querySelectorAll('button').forEach(b=>b.disabled=true);
    }));choices.append(btn);
  }
  show('cave-story');
}
async function openInventory(from='hall'){
  inventoryReturn=from;
  const {items}=await api('/inventory');
  $('#inventory-list').innerHTML=items.length?items.map(i=>`<article class="inventory-item"><div><strong>${safe(i.name)}</strong><div class="muted tiny">${safe(i.category)} · ${'★'.repeat(Math.max(1,Math.min(5,i.rarity)))}</div></div><strong>×${Number(i.quantity)}</strong></article>`).join(''):'<p class="muted">まだ素材を持っていません。洞窟で採取してみよう。</p>';
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
  if(moved){$('#npc-move-notice').textContent=`ぺーぱーは${n.state.locationLabel}へ移動しました。描写はプロフィールを開き直すと更新されます。` ;$('#npc-move-notice').classList.remove('hidden');}
  else if($('#npc-move-notice').classList.contains('hidden')) {} // 移動通知は開き直すまで残す
  $('#talk-btn').disabled=n.state.activity==='sleeping'||(n.state.location==='room'&&!n.roomUnlocked);
  $('#talk-btn').title=n.state.activity==='sleeping'?'ぺーぱーは眠っています。':'';
  $('#visit-btn').textContent=n.state.location==='hall'?'ホールで会う':'自室へ会いに行く';
  $('#visit-btn').disabled=n.state.location==='room'&&!n.roomUnlocked;
  $('#room-btn').disabled=!n.roomUnlocked||n.state.location!=='room'||n.state.activity==='sleeping';
  $('#room-btn').title=n.roomUnlocked?'':'仲良くなると訪問できます。';
}
const openConversation=async()=>{
  const {npc}=await api('/npcs/paper'); if(npc.state.activity==='sleeping') throw new Error('ぺーぱーは眠っています。');
  if(npc.state.location==='room'&&!npc.roomUnlocked)throw new Error('今はぺーぱーの自室に入れません。');
  currentNpc=npc;
  $('#conversation-scene').textContent=npc.scene;
  $('#speech-line').textContent='「あっ、来てくれたんだ！ 何のお話する？」';
  $('#conversation-result').classList.add('hidden');
  $('#conversation-choices').innerHTML='';
  const options=[{id:'greet',label:'挨拶する'},{id:'food',label:'好きな食べ物について聞く'},{id:'cave',label:'洞窟について聞く'}];
  for(const opt of options){const btn=document.createElement('button');btn.className='secondary';btn.textContent=opt.label;btn.addEventListener('click',handler(async()=>{
    const data=await api('/npcs/paper/conversation','POST',{choice:opt.id});currentNpc=data.npc;$('#speech-line').textContent=data.response;
    $('#conversation-result').textContent=data.affinityChange?'ぺーぱーと少し仲良くなりました！':'ぺーぱーはあなたとの会話を楽しんでいるようです。';
    $('#conversation-result').classList.remove('hidden');
  }));$('#conversation-choices').append(btn);}
  show('conversation');
};
bind('#refresh-hall',openHall);
bind('#open-inventory',()=>openInventory('hall'));
bind('#cave-inventory-btn',()=>openInventory('cave'));
bind('#cave-refresh',()=>openCave(selectedCaveSection));
bind('#cave-story-back',()=>openCave(selectedCaveSection));
bind('#cave-story-done',()=>openCave(selectedCaveSection));
bind('#inventory-back',async()=>{if(inventoryReturn==='cave')await openCave(selectedCaveSection);else await openHall();});
for(const [selector,action] of [['#rest-btn','rest'],['#wake-btn','wake']]){bind(selector,async()=>{const data=await api('/npcs/paper/life/action','POST',{action});currentNpc=data.npc;const last=lastLocation;lastLocation=data.npc.state.location;renderNpc(last!==lastLocation);$('#life-action-result').textContent=data.message;$('#life-action-result').classList.remove('hidden');});}
bind('#talk-btn',openConversation);
bind('#visit-btn',async()=>{if(currentNpc.state.location==='hall'){toast('ぺーぱーはホールにいます。');return;}await enterRoom();});
bind('#room-btn',enterRoom);
async function enterRoom(){const data=await api('/npcs/paper/room/enter','POST',{});$('#room-message').textContent=data.message;show('room');}
bind('#room-talk',openConversation);
bind('#conversation-close',openNpc);
bind('#history-btn',async()=>{const {history}=await api('/npcs/paper/history');const list=$('#history-list');list.innerHTML=history.length?history.map(h=>`<article class="history-entry"><time>${safe(h.created_at)} UTC</time><p>${safe(h.response)}</p><span class="muted">${h.affinity_change?'♥ 好感度が上昇':''}</span></article>`).join(''):'<p class="muted">まだ会話の記録がありません。</p>';show('history');});
document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',handler(async()=>{const page=el.dataset.back;if(page==='hall')await openHall();else if(page==='npc')await openNpc();})));
(async()=>{if(token){try{await openHall();}catch(e){toast(e.message);show('auth');}}else show('auth');})();
})();
