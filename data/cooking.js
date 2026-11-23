/* 神狩荘 v0.18.0 cooking client */
(()=>{'use strict';
const bridge=window.KAGARISO_COOKING_BRIDGE;if(!bridge)return;
const $=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let selectedRecipeId=null,lastCompletedRecipeId=null;
let state=null,session=null,busy=false,fullDeck=null,holdBusy=false,holdStartPending=false,holdWantRelease=false,clockOffset=0,anim=0,autoCompleting=false,completionTimer=0,stageAdvanceTimer=0;
const TAP_ONE_WAY_MS=2500,TAP_TOTAL_MS=TAP_ONE_WAY_MS*2*3;
// Workerの長押し成功範囲 (850～2400ms) に合わせて、3.5秒でゲージ最大。
const HOLD_MAX_MS=3500,HOLD_SUCCESS_START_MS=850,HOLD_SUCCESS_END_MS=2400;
let holdMeterRaf=0,holdActivePointer=null,holdReleased=false;
const stopHoldMeter=()=>{cancelAnimationFrame(holdMeterRaf);holdMeterRaf=0;};
const updateHoldMeter=()=>{
 const meter=$('cooking-hold-meter'),fill=$('cooking-hold-fill'),cursor=$('cooking-hold-cursor');
 if(!meter||!fill||!cursor)return;
 const holdMs=Number(session?.holdStartMs||0);
 const elapsed=holdMs>0?Math.max(0,Date.now()+clockOffset-holdMs):0;
 const pct=Math.min(100,Math.max(0,elapsed/HOLD_MAX_MS*100));
 fill.style.width=pct+'%';cursor.style.left=pct+'%';meter.setAttribute('aria-valuenow',String(Math.round(pct)));
 meter.classList.toggle('is-success',elapsed>=HOLD_SUCCESS_START_MS&&elapsed<=HOLD_SUCCESS_END_MS);
};
const paintHoldMeter=()=>{
 stopHoldMeter();
 const frame=()=>{
  if(!session||session.game!=='hold'||holdReleased)return;
  updateHoldMeter();holdMeterRaf=requestAnimationFrame(frame);
 };
 frame();
};

const jumpToGame=()=>requestAnimationFrame(()=>{const el=$('cooking-playing-name');if(el&&!$('cooking-play').classList.contains('hidden')){el.scrollIntoView({block:'start',behavior:'instant'});}});
const api=async(p,body)=>{const a=Date.now(),r=await bridge.api('/cooking/'+p,body?'POST':'GET',body),b=Date.now();if(r.session?.serverNow)clockOffset=r.session.serverNow-(a+b)/2;return r;};
const notice=s=>{const el=$('cooking-message');el.textContent=s||'';el.hidden=!s;};
const img=r=>`<img loading="lazy" src="${safe(r.image)}" alt="" onerror="this.style.display='none'">`;
// v0.18.5.8: 使用する素材の不足数のみ計算。数量は必要数から所持数を引く。
const missingIngredients=r=>(Array.isArray(r.ingredients)?r.ingredients:[]).map(m=>({name:String(m.name??''),quantity:Math.max(0,Number(m.quantity||0)-Number(m.owned||0))})).filter(m=>m.quantity>0);
const missingLabel=r=>missingIngredients(r).map(m=>`${m.name}×${m.quantity}`).join(' ');
// v0.18.5.7：レシピ詳細は専用ページで表示。調理の開始・保存処理は従来どおり。
const renderRecipeDetail=()=>{
 const el=$('cooking-recipe-detail-content');
 const recipe=state?.recipes?.find(r=>r.id===selectedRecipeId);
 if(!recipe){el.replaceChildren();return;}
 const locked=!recipe.unlocked;
 const ingredients=Array.isArray(recipe.ingredients)?recipe.ingredients:[];
 const missing=missingIngredients(recipe);
 const lacks=missing.length>0;
 el.innerHTML=`<div class="cooking-detail-head"><div class="cooking-detail-image">${recipe.unlocked?img(recipe):'<span aria-hidden="true">🔒</span>'}</div><div><h3>${safe(recipe.name)}</h3><p class="muted tiny">${safe(recipe.category)} ／ ${recipe.steps.length}工程 ／ ${recipe.completed?'完成済み':'未完成'} ／ 調理 ${recipe.times}回</p></div></div>
 <p class="muted cooking-detail-ingredients">${locked?'解放条件：'+safe(recipe.condition):'必要素材：'+(ingredients.map(m=>`${safe(m.name)} ${m.owned}/${m.quantity}`).join('・')||'なし')}</p>
 ${!locked&&lacks?`<p class="cooking-detail-missing">${safe(missingLabel(recipe))} 不足</p>`:''}
 <button type="button" class="primary cooking-detail-start" data-cook-detail="${safe(recipe.id)}" ${locked||lacks||!!state.active?'disabled':''}>料理する</button>`;
 const button=el.querySelector('[data-cook-detail]');
 if(button&&!button.disabled)button.addEventListener('click',()=>start(recipe.id));
};
const paintList=()=>{
 const category=$('cooking-filter').value,search=$('cooking-search').value.trim().toLowerCase();
 $('cooking-progress').textContent=`レシピ：${state.completedCount} / ${state.total} 種類`;
 // 月の扉解放はホール通知で案内する。料理画面では表示しない。
 const recipes=state.recipes.filter(r=>(category==='all'||r.category===category)&&r.name.toLowerCase().includes(search));
 if(!recipes.some(r=>r.id===selectedRecipeId))selectedRecipeId=null;
 $('cooking-recipes').innerHTML=recipes.map(r=>{
  const missing=r.unlocked?missingLabel(r):'';
  const insufficient=!!missing;
  return `<button type="button" class="cooking-recipe-tile${insufficient?' is-insufficient':''}" data-recipe-id="${safe(r.id)}" aria-label="${safe(r.name)}${insufficient?'、'+missing+' 不足':''}の詳細を開く"><span class="cooking-recipe-name">${safe(r.name)}</span><span class="cooking-recipe-thumb">${r.unlocked?img(r):'<span class="cooking-lock" aria-hidden="true">🔒</span>'}</span>${!r.unlocked?`<span class="cooking-recipe-condition">解放条件：${safe(r.condition||'未確認')}</span>`:insufficient?`<span class="cooking-recipe-shortage">${safe(missing)} 不足</span>`:r.completed?'<span class="cooking-recipe-done">完成済み</span>':''}</button>`;
 }).join('')||'<p class="muted cooking-no-recipes">該当するレシピはありません。</p>';
 $('cooking-recipes').querySelectorAll('[data-recipe-id]').forEach(button=>button.addEventListener('click',()=>{
  selectedRecipeId=button.dataset.recipeId;
  renderRecipeDetail();
  bridge.show('cooking-recipe');
 }));
 const byId=Object.fromEntries(state.recipes.map(r=>[r.id,r]));
 $('cooking-stock').innerHTML=state.owned.length?state.owned.map(x=>{const r=byId[x.id];return r?`<article class="cooking-food">${img(r)}<div><strong>${safe(r.name)} ×${x.quantity}</strong><div class="muted tiny">回復 ${r.restore} ／ 腹持ち ${r.satietyMinutes}分</div></div><div><button class="secondary small" data-eat="paper:${r.id}">黄色い獣へ</button> <button class="secondary small" data-eat="pyoro:${r.id}">赤色の獣へ</button></div></article>`:'';}).join(''):'<p class="muted">作った料理はまだありません。</p>';
 $('cooking-stock').querySelectorAll('[data-eat]').forEach(b=>b.onclick=()=>feed(...b.dataset.eat.split(':')));
};
// v0.18.5.15: タップ位置は縦の点線で残す。サーバーにも操作した瞬間の時刻を渡す。
const tapPercent=t=>{
 if(Number.isFinite(Number(t?.percent)))return Math.max(0,Math.min(100,Number(t.percent)));
 // 旧バージョンの途中記録（時刻のみ）にも対応。
 if(!Number.isFinite(Number(t?.at))||!Number.isFinite(Number(session?.stageMs)))return null;
 const elapsed=Math.max(0,Number(t.at)-Number(session.stageMs));
 const leg=Math.floor(elapsed/TAP_ONE_WAY_MS),phase=(elapsed%TAP_ONE_WAY_MS)/TAP_ONE_WAY_MS;
 return Math.max(0,Math.min(100,(leg%2===0?phase:1-phase)*100));
};
const paintTapPositions=taps=>{
 const container=$('cooking-tap-positions');if(!container)return;
 const valid=(Array.isArray(taps)?taps:[]).slice(0,3).map((t,i)=>({...t,index:i+1,position:tapPercent(t)})).filter(t=>t.position!==null);
 container.replaceChildren();
 for(const tap of valid){
  const mark=document.createElement('span');
  mark.className='cooking-tap-record '+(tap.hit?'is-hit':'is-miss');
  mark.style.left=tap.position+'%';
  mark.setAttribute('aria-hidden','true');
  mark.title=`${tap.index}回目：${tap.position.toFixed(1)}%／${tap.hit?'成功':'失敗'}`;
  mark.setAttribute('aria-label',mark.title);
  container.append(mark);
 }
};
const gameTitles={tap:'切る・炒める・焼く',hold:'煮る・混ぜる：長押しして離す',card:'盛り付け：同じ絵柄を3枚集める',finish:'完成！'};
const symbols={chest:'🎁',gem:'💎',coin:'🪙'};
const renderCards=()=>{const cards=fullDeck||session.cards||[];$('cooking-card-grid').innerHTML=Array.from({length:12},(_,i)=>`<button class="cooking-card" data-index="${i}" ${cards[i]?'disabled':''}>${cards[i]?symbols[cards[i]]:'❔'}</button>`).join('');$('cooking-card-grid').querySelectorAll('.cooking-card:not([disabled])').forEach(b=>b.onclick=()=>step({action:'draw',index:Number(b.dataset.index)}));};
const renderStage=()=>{
 clearTimeout(stageAdvanceTimer);stageAdvanceTimer=0;stopHoldMeter();
 if(!session)return;
 if(session.game==='finish'){finalizeCooking();return;}
 $('cooking-completion').classList.add('hidden');
 $('cooking-play').classList.remove('hidden');$('cooking-library').classList.add('hidden');
 $('cooking-playing-name').textContent=state.recipes.find(r=>r.id===session.recipeId)?.name||'料理';
 $('cooking-stage-title').classList.toggle('hidden',session.game==='tap'||session.game==='card');
 $('cooking-stage-title').textContent=session.game==='tap'||session.game==='card'?'':`工程 ${Math.min(session.stage+1,session.steps.length)} / ${session.steps.length}：${gameTitles[session.game]}`;
 for(const n of ['tap','hold','card','finish'])$('cooking-'+n).classList.toggle('hidden',session.game!==n);
 $('cooking-stage-result').textContent='';
 if(session.game==='tap')$('cooking-stage-result').textContent=`${Number(session.tapCount||0)} / 3 回タップ　（成功 ${Number(session.tapHits||0)} 回）`;
 if(session.game==='tap')paintTapPositions(session.revealed);else paintTapPositions([]);
 if(session.game==='card')renderCards();
 if(session.game==='hold'){
  holdReleased=false;
  $('cooking-hold-button').textContent=session.holdStarted?'離して判定する':'ここを長押し';
  updateHoldMeter();
  if(session.holdStarted)paintHoldMeter();
 }
 if(session.game==='tap'){
  cancelAnimationFrame(anim);
  const paint=()=>{
   if(session?.game!=='tap')return;
   if(busy){anim=requestAnimationFrame(paint);return;}
   const elapsed=Math.max(0,Date.now()+clockOffset-session.stageMs);
   const leg=Math.floor(elapsed/TAP_ONE_WAY_MS);
   const phase=(elapsed%TAP_ONE_WAY_MS)/TAP_ONE_WAY_MS;
   const position=leg%2===0?phase:1-phase;
   $('cooking-marker').style.left=(Math.max(0,Math.min(100,position*100)))+'%';
   $('cooking-laps').textContent='残り'+Math.max(0,3-Math.floor(elapsed/(TAP_ONE_WAY_MS*2)))+'往復';
   if(elapsed>=TAP_TOTAL_MS){step({action:'timeout'});return;}
   anim=requestAnimationFrame(paint);
  };paint();
 }
};
const refresh=async()=>{state=await api('status');session=state.active;paintList();if(session){fullDeck=null;renderStage();jumpToGame();}else{$('cooking-play').classList.add('hidden');$('cooking-library').classList.remove('hidden');}};
const start=async recipeId=>{if(busy)return;clearTimeout(stageAdvanceTimer);stageAdvanceTimer=0;busy=true;try{const r=await api('start',{recipeId});session=r.session;fullDeck=null;bridge.show('cooking');renderStage();jumpToGame();}catch(e){notice(e.message);if(bridge.show)bridge.show('cooking');}finally{busy=false;}};
// 工程確定後に短い結果表示を挟んで自動的に次のゲームへ進む。
// サーバーの返却するstage/gameを利用し、二重送信・二重進行を防ぐ。
const scheduleStageAdvance=(delay,expectedSession)=>{
 clearTimeout(stageAdvanceTimer);
 stageAdvanceTimer=setTimeout(()=>{
  stageAdvanceTimer=0;
  if(!session||session.id!==expectedSession.id||session.stage!==expectedSession.stage||session.game!==expectedSession.game)return;
  fullDeck=null;renderStage();jumpToGame();
 },delay);
};
const step=async action=>{
 if(busy||!session)return;busy=true;cancelAnimationFrame(anim);if(session.game==='hold')stopHoldMeter();
 try{
  const r=await api('step',{sessionId:session.id,...action});session=r.session;
  if(r.prize){
   fullDeck=r.allCards;
   $('cooking-card').classList.remove('hidden');$('cooking-tap').classList.add('hidden');$('cooking-hold').classList.add('hidden');
   renderCards();
   $('cooking-stage-result').textContent=`${({chest:'大当たり！ 宝箱',gem:'中当たり！ 宝石',coin:'小当たり！ コイン'})[r.prize]}の3枚が揃った！`;
   if(session.game==='finish')scheduleCompletion(1300);else scheduleStageAdvance(1300,session);
  }else if(r.tapRecorded){
   renderStage();
   $('cooking-stage-result').textContent=`${r.tapSuccess?'トンッ！ 成功！':'トンッ！ あと少し！'}　${session.tapCount} / 3 回（成功 ${session.tapHits} 回）`;
  }else if(r.completedStep){
   // 第3タップは工程が切り替わっても結果表示中の印を残す。
   if(r.tapPositions)paintTapPositions(r.tapPositions);
   $('cooking-stage-result').textContent=r.success?'成功！':'ちょっと失敗。でも完成はできるよ。';
   if(session.game==='finish')scheduleCompletion(500);else scheduleStageAdvance(700,session);
  }else if(session.game==='card')renderCards();
 }catch(e){notice(e.message);if(session?.game==='tap')renderStage();}finally{busy=false;}
};
// 最終工程終了後は専用の完成操作ボタンを挟まずに、既存のfinish APIで一度だけ保存する。
const scheduleCompletion=delay=>{
 clearTimeout(completionTimer);
 completionTimer=setTimeout(()=>{completionTimer=0;finalizeCooking();},delay);
};
const finalizeCooking=async()=>{
 if(autoCompleting||!session||session.game!=='finish')return;
 autoCompleting=true;clearTimeout(completionTimer);completionTimer=0;cancelAnimationFrame(anim);
 const finishedSessionId=session.id;
 try{
  const r=await api('finish',{sessionId:finishedSessionId});
  lastCompletedRecipeId=state?.active?.recipeId||session.recipeId;
  session=null;
  await refresh();
  $('cooking-play').classList.add('hidden');$('cooking-library').classList.add('hidden');
  $('cooking-completion-name').textContent=r.name;
  $('cooking-completion-quantity').textContent=`× ${r.quantity} 個`;
  const photo=$('cooking-completion-image');photo.hidden=!r.image;
  if(r.image){photo.src=r.image;photo.onerror=()=>{photo.hidden=true;};}
  $('cooking-completion').classList.remove('hidden');
  notice('');
  requestAnimationFrame(()=>$('cooking-completion-title').scrollIntoView({block:'start',behavior:'instant'}));
 }catch(e){
  notice('完成処理を確認できませんでした：'+e.message);
  // 途中で通信が切れたときも保存済みか確認可能。連打で二重送信しない。
  try{await refresh();}catch{}
 }finally{autoCompleting=false;}
};
const feed=async(npc,recipe)=>{
 const r=state.recipes.find(x=>x.id===recipe);if(busy||!confirm(`${npc==='paper'?'黄色い獣':'赤色の獣'}に「${r?.name}」を食べさせますか？`))return;
 busy=true;try{const v=await api('feed',{npcId:npc,recipeId:recipe});await refresh();notice(`${v.message} 腹持ち ${v.satietyMinutes}分`);}catch(e){notice(e.message);}finally{busy=false;}
};
// 工房TOPでは料理の通信を行わない。料理を選んだときだけ台所を読み込む。
const open=async()=>{if(await bridge.checkEvents())return;clearTimeout(stageAdvanceTimer);cancelAnimationFrame(anim);bridge.show('workshop');};
const openKitchen=async()=>{
 if(await bridge.checkEvents())return;
 bridge.show('cooking');$('cooking-completion').classList.add('hidden');notice('');
 try{
  await refresh();
  if(!state.visited){$('cooking-first').classList.remove('hidden');await api('visit',{});state.visited=true;}
 }catch(e){notice(e.message||'料理データを読み込めませんでした。');}
};
$('cooking-recipe-back').addEventListener('click',()=>bridge.show('cooking'));
$('cooking-recipe-hall-back').addEventListener('click',()=>bridge.openHall());
$('cooking-filter').addEventListener('change',()=>{if(state)paintList();});$('cooking-search').addEventListener('input',()=>{if(state)paintList();});
// 通信完了時刻ではなく押下した瞬間の時計値を送る（画面のカーソル位置と揃える）。
$('cooking-tap-button').onclick=()=>{if(busy||session?.game!=='tap')return;const tapAt=Math.round(Date.now()+clockOffset);step({action:'tap',tapAt});};
const hold=$('cooking-hold-button');
const doRelease=async()=>{
 if(!holdBusy||holdStartPending||busy)return;
 holdBusy=false;holdWantRelease=false;holdActivePointer=null;holdReleased=true;
 stopHoldMeter();updateHoldMeter();hold.textContent='判定中……';
 await step({action:'hold-end'});
};
hold.addEventListener('pointerdown',async e=>{
 if(busy||holdBusy||!session||session.game!=='hold')return;
 e.preventDefault();holdBusy=true;holdWantRelease=false;holdReleased=false;holdStartPending=true;holdActivePointer=e.pointerId;
 try{hold.setPointerCapture(e.pointerId);}catch{}
 try{
  if(!session.holdStarted){const r=await api('step',{sessionId:session.id,action:'hold-start'});session=r.session;}
  hold.textContent='水色の範囲で離そう';paintHoldMeter();
 }catch(err){notice(err.message);holdBusy=false;holdActivePointer=null;stopHoldMeter();hold.textContent='ここを長押し';}
 finally{holdStartPending=false;}
 if(holdWantRelease)doRelease();
});
const releaseHold=e=>{
 if(!holdBusy||holdActivePointer!==e.pointerId)return;
 e.preventDefault();holdWantRelease=true;
 if(!holdStartPending)doRelease();
};
hold.addEventListener('pointerup',releaseHold);
hold.addEventListener('pointercancel',releaseHold);
hold.addEventListener('lostpointercapture',e=>{if(holdBusy&&holdActivePointer===e.pointerId){holdWantRelease=true;if(!holdStartPending)doRelease();}});
// 再読み込み後、サーバーで長押し開始済みならそのまま離して判定できる。
hold.addEventListener('click',e=>{if(session?.game==='hold'&&session.holdStarted&&!holdBusy&&!busy){e.preventDefault();holdBusy=true;holdStartPending=false;doRelease();}});

$('cooking-completion-back').onclick=()=>{$('cooking-completion').classList.add('hidden');$('cooking-library').classList.remove('hidden');$('cooking-library').scrollIntoView({block:'start',behavior:'instant'});};
$('cooking-completion-again').onclick=async()=>{if(busy||autoCompleting||!lastCompletedRecipeId)return;const recipe=state?.recipes?.find(r=>r.id===lastCompletedRecipeId);if(!recipe)return;const missing=missingIngredients(recipe);if(missing.length){notice(missingLabel(recipe)+' 不足');$('cooking-completion').classList.add('hidden');selectedRecipeId=recipe.id;renderRecipeDetail();bridge.show('cooking-recipe');return;}await start(recipe.id);};
$('cooking-cancel').onclick=async()=>{if(busy||autoCompleting||!session||session.game==='finish'||!confirm('調理を中断する？ 素材は消費されないよ。'))return;clearTimeout(stageAdvanceTimer);stageAdvanceTimer=0;busy=true;try{await api('cancel',{sessionId:session.id});await refresh();notice('調理を中断したよ。');}catch(e){notice(e.message);}finally{busy=false;}};
$('workshop-enter-cooking').addEventListener('click',openKitchen);
$('workshop-back-hall').addEventListener('click',()=>{cancelAnimationFrame(anim);bridge.openHall();});
$('cooking-back').onclick=()=>{cancelAnimationFrame(anim);bridge.show('workshop');};
$('cooking-hall-back').onclick=()=>{cancelAnimationFrame(anim);bridge.openHall();};
window.KAGARISO_COOKING={open,openKitchen};
})();
