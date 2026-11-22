/* 神狩荘 v0.18.0 cooking client */
(()=>{'use strict';
const bridge=window.KAGARISO_COOKING_BRIDGE;if(!bridge)return;
const $=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let selectedRecipeId=null;
let state=null,session=null,busy=false,fullDeck=null,holdBusy=false,holdStartPending=false,holdWantRelease=false,clockOffset=0,anim=0;
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
const gameTitles={tap:'切る・炒める・焼く：タイミングよくタップ',hold:'煮る・混ぜる：長押しして離す',card:'盛り付け：同じ絵柄を3枚集める',finish:'完成！'};
const symbols={chest:'🎁',gem:'💎',coin:'🪙'};
const renderCards=()=>{const cards=fullDeck||session.cards||[];$('cooking-card-grid').innerHTML=Array.from({length:12},(_,i)=>`<button class="cooking-card" data-index="${i}" ${cards[i]?'disabled':''}>${cards[i]?symbols[cards[i]]:'❔'}</button>`).join('');$('cooking-card-grid').querySelectorAll('.cooking-card:not([disabled])').forEach(b=>b.onclick=()=>step({action:'draw',index:Number(b.dataset.index)}));};
const renderStage=()=>{
 if(!session)return;
 $('cooking-play').classList.remove('hidden');$('cooking-library').classList.add('hidden');
 $('cooking-playing-name').textContent=state.recipes.find(r=>r.id===session.recipeId)?.name||'料理';
 $('cooking-stage-title').textContent=`工程 ${Math.min(session.stage+1,session.steps.length)} / ${session.steps.length}：${gameTitles[session.game]}`;
 for(const n of ['tap','hold','card','finish'])$('cooking-'+n).classList.toggle('hidden',session.game!==n);
 $('cooking-next').classList.add('hidden');$('cooking-stage-result').textContent='';
 if(session.game==='card')renderCards();
 if(session.game==='tap'){
  cancelAnimationFrame(anim);$('cooking-target').style.left=(session.targetMs/2500*100)+'%';
  const paint=()=>{if(session?.game!=='tap')return;$('cooking-marker').style.left=Math.max(0,Math.min(100,(Date.now()+clockOffset-session.stageMs)/2500*100))+'%';anim=requestAnimationFrame(paint);};paint();
 }
};
const loadOrders=async()=>{
 try{
  const data=await api('orders');
  $('cooking-orders').innerHTML=['paper','pyoro'].map(npc=>{
   const d=data[npc],name=npc==='paper'?'黄色い獣':'赤色の獣';
   return `<section class="cooking-order-npc"><h3>${name}のお願い</h3><p class="muted tiny">今日の受注 ${d.acceptedToday} / ${d.dailyLimit} 件</p>
     ${d.active.map(x=>`<div class="cooking-order"><strong>${safe(x.name)}を食べたい！</strong><div class="actions"><button class="primary small" data-order-done="${x.id}">料理を渡す</button><button class="secondary small" data-order-cancel="${x.id}">取り消す</button></div></div>`).join('')||'<p class="muted tiny">受注中の料理はありません。</p>'}
     ${d.canAccept?d.offers.map(x=>`<div class="cooking-order"><span>${safe(x.name)}</span> <button class="secondary small" data-order-accept="${npc}:${x.recipeId}">引き受ける</button></div>`).join(''):'<p class="muted tiny">今日の受注上限か同時受注上限に達しています。</p>'}</section>`;
  }).join('');
  $('cooking-orders').querySelectorAll('[data-order-accept]').forEach(b=>b.onclick=async()=>{const [npcId,recipeId]=b.dataset.orderAccept.split(':');try{const r=await api('orders/accept',{npcId,recipeId});notice(r.message);await refresh();}catch(e){notice(e.message);}});
  $('cooking-orders').querySelectorAll('[data-order-done]').forEach(b=>b.onclick=async()=>{try{const r=await api('orders/resolve',{orderId:b.dataset.orderDone,action:'complete'});notice(r.message);await refresh();}catch(e){notice(e.message);}});
  $('cooking-orders').querySelectorAll('[data-order-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('お願いを取り消しますか？'))return;try{const r=await api('orders/resolve',{orderId:b.dataset.orderCancel,action:'cancel'});notice(r.message);await refresh();}catch(e){notice(e.message);}});
 }catch(e){$('cooking-orders').textContent=e.message;}
};
const refresh=async()=>{state=await api('status');session=state.active;paintList();await loadOrders();if(session){fullDeck=null;renderStage();}else{$('cooking-play').classList.add('hidden');$('cooking-library').classList.remove('hidden');}};
const start=async recipeId=>{if(busy)return;busy=true;try{const r=await api('start',{recipeId});session=r.session;fullDeck=null;bridge.show('cooking');renderStage();}catch(e){notice(e.message);if(bridge.show)bridge.show('cooking');}finally{busy=false;}};
const step=async action=>{
 if(busy||!session)return;busy=true;cancelAnimationFrame(anim);
 try{
  const r=await api('step',{sessionId:session.id,...action});session=r.session;
  if(r.prize){fullDeck=r.allCards;$('cooking-card').classList.remove('hidden');$('cooking-tap').classList.add('hidden');$('cooking-hold').classList.add('hidden');renderCards();$('cooking-stage-result').textContent=`${({chest:'大当たり！ 宝箱',gem:'中当たり！ 宝石',coin:'小当たり！ コイン'})[r.prize]}の3枚が揃った！ ほかのカードも全部公開！`;$('cooking-next').classList.remove('hidden');}
  else if(r.completedStep){$('cooking-stage-result').textContent=r.success?'成功！':'ちょっと失敗。でも完成はできるよ。';$('cooking-next').classList.remove('hidden');}
  else if(session.game==='card')renderCards();
 }catch(e){notice(e.message);if(session?.game==='tap')renderStage();}finally{busy=false;}
};
const feed=async(npc,recipe)=>{
 const r=state.recipes.find(x=>x.id===recipe);if(busy||!confirm(`${npc==='paper'?'黄色い獣':'赤色の獣'}に「${r?.name}」を食べさせますか？`))return;
 busy=true;try{const v=await api('feed',{npcId:npc,recipeId:recipe});await refresh();notice(`${v.message} 腹持ち ${v.satietyMinutes}分`);}catch(e){notice(e.message);}finally{busy=false;}
};
// 工房TOPでは料理の通信を行わない。料理を選んだときだけ台所を読み込む。
const open=async()=>{if(await bridge.checkEvents())return;cancelAnimationFrame(anim);bridge.show('workshop');};
const openKitchen=async()=>{
 if(await bridge.checkEvents())return;
 bridge.show('cooking');notice('');
 try{
  await refresh();
  if(!state.visited){$('cooking-first').classList.remove('hidden');await api('visit',{});state.visited=true;}
 }catch(e){notice(e.message||'料理データを読み込めませんでした。');}
};
$('cooking-recipe-back').addEventListener('click',()=>bridge.show('cooking'));
$('cooking-recipe-hall-back').addEventListener('click',()=>bridge.openHall());
$('cooking-orders-refresh').addEventListener('click',loadOrders);
$('cooking-filter').addEventListener('change',()=>{if(state)paintList();});$('cooking-search').addEventListener('input',()=>{if(state)paintList();});
$('cooking-tap-button').onclick=()=>step({action:'tap'});
const hold=$('cooking-hold-button');
hold.addEventListener('pointerdown',async e=>{if(busy||holdBusy)return;e.preventDefault();holdBusy=true;holdWantRelease=false;holdStartPending=true;try{hold.setPointerCapture(e.pointerId);}catch{}try{if(!session.holdStarted){const r=await api('step',{sessionId:session.id,action:'hold-start'});session=r.session;}hold.textContent='長押し中……';}catch(err){notice(err.message);holdBusy=false;}finally{holdStartPending=false;}if(holdWantRelease)doRelease();});
const doRelease=async()=>{if(!holdBusy)return;holdBusy=false;holdWantRelease=false;await step({action:'hold-end'});};
hold.addEventListener('pointerup',e=>{e.preventDefault();holdWantRelease=true;if(!holdStartPending&&!busy)doRelease();});hold.addEventListener('pointercancel',()=>{holdWantRelease=true;if(!holdStartPending&&!busy)doRelease();});
$('cooking-next').onclick=()=>{fullDeck=null;renderStage();};
$('cooking-finish-button').onclick=async()=>{if(busy||!session)return;busy=true;try{const r=await api('finish',{sessionId:session.id});await refresh();notice(`「${r.name}」を${r.quantity}個作った！${r.moonUnlocked?' 🌙 月の扉が解放された！':''}`);}catch(e){notice(e.message);}finally{busy=false;}};
$('cooking-cancel').onclick=async()=>{if(busy||!session||!confirm('調理を中断する？ 素材は消費されないよ。'))return;busy=true;try{await api('cancel',{sessionId:session.id});await refresh();notice('調理を中断したよ。');}catch(e){notice(e.message);}finally{busy=false;}};
$('workshop-enter-cooking').addEventListener('click',openKitchen);
$('workshop-back-hall').addEventListener('click',()=>{cancelAnimationFrame(anim);bridge.openHall();});
$('cooking-back').onclick=()=>{cancelAnimationFrame(anim);bridge.show('workshop');};
$('cooking-hall-back').onclick=()=>{cancelAnimationFrame(anim);bridge.openHall();};
window.KAGARISO_COOKING={open,openKitchen};
})();
