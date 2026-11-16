/* 神狩荘・フロントエンド 初期版。外部ライブラリなし。 */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const API=(window.KAGARISO_API_BASE||'').replace(/\/$/,'');
const SESSION_KEY='kagariso_starter_session_v1';
let token=localStorage.getItem(SESSION_KEY)||'';
let resident=null, currentNpc=null, lastLocation=null, profileScene='', profileTimer=null;
let pendingRecovery='';
const pages=['auth','recovery','hall','npc','conversation','room','history'];
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
  $('#doors').innerHTML=data.hall.doors.map(d=>`<article class="door-card"><span class="door-glyph">◇</span><div><strong>${safe(d.name)}</strong><div class="muted">探索機能は次の開発段階で実装</div></div><span class="tag">準備中</span></article>`).join('');
  $('#npc-list').querySelectorAll('[data-npc]').forEach(b=>b.addEventListener('click',handler(openNpc)));
  show('hall');
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
