/* 神狩荘 v0.18.0 cooking client */
(()=>{'use strict';
const bridge=window.KAGARISO_COOKING_BRIDGE;if(!bridge)return;
const $=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let selectedRecipeId=null,lastCompletedRecipeId=null;
let state=null,session=null,busy=false,fullDeck=null,holdBusy=false,holdStartPending=false,holdWantRelease=false,clockOffset=0,anim=0,autoCompleting=false,completionTimer=0;
const TAP_ONE_WAY_MS=2500,TAP_TOTAL_MS=TAP_ONE_WAY_MS*2*3;
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
 $('cooking-moon').textContent=state.moonUnlocked?'🌙 月の扉が解放された！':'';
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
const gameTitles={tap:'切る・炒める・焼く',hold:'煮る・混ぜる：長押しして離す',card:'盛り付け：同じ絵柄を3枚集める',finish:'完成！'};
const symbols={chest:'🎁',gem:'💎',coin:'🪙'};
const renderCards=()=>{const cards=fullDeck||session.cards||[];$('cooking-card-grid').innerHTML=Array.from({length:12},(_,i)=>`<button class="cooking-card" data-index="${i}" ${cards[i]?'disabled':''}>${cards[i]?symbols[cards[i]]:'❔'}</button>`).join('');$('cooking-card-grid').querySelectorAll('.cooking-card:not([disabled])').forEach(b=>b.onclick=()=>step({action:'draw',index:Number(b.dataset.index)}));};
const renderStage=()=>{
 if(!session)return;
 if(session.game==='finish'){finalizeCooking();return;}
 $('cooking-completion').classList.add('hidden');
 $('cooking-play').classList.remove('hidden');$('cooking-library').classList.add('hidden');
 $('cooking-playing-name').textContent=state.recipes.find(r=>r.id===session.recipeId)?.name||'料理';
 $('cooking-stage-title').textContent=session.game==='tap'?'':`工程 ${Math.min(session.stage+1,session.steps.length)} / ${session.steps.length}：${gameTitles[session.game]}`;
 for(const n of ['tap','hold','card','finish'])$('cooking-'+n).classList.toggle('hidden',session.game!==n);
 $('cooking-next').classList.add('hidden');$('cooking-stage-result').textContent='';
 if(session.game==='card')renderCards();
 if(session.game==='tap'){
  cancelAnimationFrame(anim);$('cooking-target').style.left=(session.targetMs/TAP_ONE_WAY_MS*100)+'%';
  const paint=()=>{
   if(session?.game!=='tap')return;
   if(busy){anim=requestAnimationFrame(paint);return;}
   const elapsed=Math.max(0,Date.now()+clockOffset-session.stageMs);
   const leg=Math.floor(elapsed/TAP_ONE_WAY_MS);
   const phase=(elapsed%TAP_ONE_WAY_MS)/TAP_ONE_WAY_MS;
   const position=leg%2===0?phase:1-phase;
   $('cooking-marker').style.left=(Math.max(0,Math.min(100,position*100)))+'%';
   $('cooking-laps').textContent='残り'+Math.max(0,3-Math.floor(elapsed/(TAP_ONE_WAY_MS*2)))+'往復';
   if(elapsed>=TAP_TOTAL_MS){step({action:'tap'});return;}
   anim=requestAnimationFrame(paint);
  };paint();
 }
};
const refresh=async()=>{state=await api('status');session=state.active;paintList();if(session){fullDeck=null;renderStage();jumpToGame();}else{$('cooking-play').classList.add('hidden');$('cooking-library').classList.remove('hidden');}};
const start=async recipeId=>{if(busy)return;busy=true;try{const r=await api('start',{recipeId});session=r.session;fullDeck=null;bridge.show('cooking');renderStage();jumpToGame();}catch(e){notice(e.message);if(bridge.show)bridge.show('cooking');}finally{busy=false;}};
const step=async action=>{
 if(busy||!session)return;busy=true;cancelAnimationFrame(anim);
 try{
  const r=await api('step',{sessionId:session.id,...action});session=r.session;
  if(r.prize){fullDeck=r.allCards;$('cooking-card').classList.remove('hidden');$('cooking-tap').classList.add('hidden');$('cooking-hold').classList.add('hidden');renderCards();$('cooking-stage-result').textContent=`${({chest:'大当たり！ 宝箱',gem:'中当たり！ 宝石',coin:'小当たり！ コイン'})[r.prize]}の3枚が揃った！ ほかのカードも全部公開！`;if(session.game==='finish')scheduleCompletion(1300);else $('cooking-next').classList.remove('hidden');}
  else if(r.completedStep){$('cooking-stage-result').textContent=r.success?'成功！':'ちょっと失敗。でも完成はできるよ。';if(session.game==='finish')scheduleCompletion(350);else $('cooking-next').classList.remove('hidden');}
  else if(session.game==='card')renderCards();
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
  notice(r.moonUnlocked?'🌙 月の扉が解放された！':'');
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
const open=async()=>{if(await bridge.checkEvents())return;cancelAnimationFrame(anim);bridge.show('workshop');};
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
$('cooking-tap-button').onclick=()=>step({action:'tap'});
const hold=$('cooking-hold-button');
hold.addEventListener('pointerdown',async e=>{if(busy||holdBusy)return;e.preventDefault();holdBusy=true;holdWantRelease=false;holdStartPending=true;try{hold.setPointerCapture(e.pointerId);}catch{}try{if(!session.holdStarted){const r=await api('step',{sessionId:session.id,action:'hold-start'});session=r.session;}hold.textContent='長押し中……';}catch(err){notice(err.message);holdBusy=false;}finally{holdStartPending=false;}if(holdWantRelease)doRelease();});
const doRelease=async()=>{if(!holdBusy)return;holdBusy=false;holdWantRelease=false;await step({action:'hold-end'});};
hold.addEventListener('pointerup',e=>{e.preventDefault();holdWantRelease=true;if(!holdStartPending&&!busy)doRelease();});hold.addEventListener('pointercancel',()=>{holdWantRelease=true;if(!holdStartPending&&!busy)doRelease();});
$('cooking-next').onclick=()=>{fullDeck=null;renderStage();};
$('cooking-completion-back').onclick=()=>{$('cooking-completion').classList.add('hidden');$('cooking-library').classList.remove('hidden');$('cooking-library').scrollIntoView({block:'start',behavior:'instant'});};
$('cooking-completion-again').onclick=async()=>{if(busy||autoCompleting||!lastCompletedRecipeId)return;const recipe=state?.recipes?.find(r=>r.id===lastCompletedRecipeId);if(!recipe)return;const missing=missingIngredients(recipe);if(missing.length){notice(missingLabel(recipe)+' 不足');$('cooking-completion').classList.add('hidden');selectedRecipeId=recipe.id;renderRecipeDetail();bridge.show('cooking-recipe');return;}await start(recipe.id);};
$('cooking-cancel').onclick=async()=>{if(busy||autoCompleting||!session||session.game==='finish'||!confirm('調理を中断する？ 素材は消費されないよ。'))return;busy=true;try{await api('cancel',{sessionId:session.id});await refresh();notice('調理を中断したよ。');}catch(e){notice(e.message);}finally{busy=false;}};
$('workshop-enter-cooking').addEventListener('click',openKitchen);
$('workshop-back-hall').addEventListener('click',()=>{cancelAnimationFrame(anim);bridge.openHall();});
$('cooking-back').onclick=()=>{cancelAnimationFrame(anim);bridge.show('workshop');};
$('cooking-hall-back').onclick=()=>{cancelAnimationFrame(anim);bridge.openHall();};
window.KAGARISO_COOKING={open,openKitchen};
})();
