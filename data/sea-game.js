/* 神狩荘 v0.17.0.1 海と円形釣り（Worker判定） */
(()=>{'use strict';
const bridge=window.KAGARISO_SEA_BRIDGE;
const $=id=>document.getElementById(id);
const TWO_PI=Math.PI*2;
let attempt=null,raf=0,busy=false,lastGauge=0,view='pier',clockOffset=0;
const api=async(p,m='GET',b)=>{const before=Date.now(),result=await bridge.api('/sea/'+p,m,b);const after=Date.now();const serverNow=Number(result?.serverNow||result?.attempt?.serverNow);if(Number.isFinite(serverNow)&&serverNow>0)clockOffset=serverNow-(before+after)/2;return result;};
const showMessage=(text)=>{$('sea-hint').textContent=text;};
const setBusy=v=>{busy=v;$('sea-start').disabled=v;$('sea-cancel').disabled=v;};
const nowSceneName=()=>{const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return hour>=17&&hour<19?'sea2.webp':hour>=19||hour<5?'sea3.webp':'sea1.webp';};
const renderPier=data=>{
  $('sea-scene').src='images/backgrounds/'+nowSceneName();
  $('sea-worms').textContent='みみず：'+Number(data.worms||0)+'匹';
  const worm=$('sea-bait-worm');worm.disabled=Number(data.worms||0)<1;
  if(worm.disabled&&worm.checked)$('sea-bait-none').checked=true;
  $('sea-meter-fill').style.width=Math.min(100,Number(data.gaugePercent||0))+'%';
  $('sea-meter-frame').classList.toggle('hidden',!!data.discovered);
  $('sea-bait-panel').classList.toggle('hidden',!!data.attempt);
  $('sea-start').classList.toggle('hidden',!!data.attempt);
  $('sea-resume').classList.toggle('hidden',!data.attempt);
};
const open=async()=>{
  if(busy)return;
  if(await bridge.checkEvents())return;
  const data=await api('status');attempt=data.attempt||null;
  bridge.show('sea');view='pier';
  $('sea-pier').classList.remove('hidden');$('sea-game').classList.add('hidden');
  renderPier(data);
  if(attempt&&attempt.state==='active'){$('sea-resume').textContent='進行中の釣りへ戻る';}
};
const finish=(item,reason)=>{
  cancelAnimationFrame(raf);raf=0;view='pier';
  $('sea-game').classList.add('hidden');$('sea-pier').classList.remove('hidden');
  const result=$('sea-result');result.replaceChildren();
  if(item){
    const img=document.createElement('img');img.src=item.image;img.alt='';img.className='sea-catch-icon';
    const box=document.createElement('div');const title=document.createElement('strong');title.textContent=item.name+' ×1';
    const sub=document.createElement('p');sub.textContent='★'.repeat(item.rarity)+'　'+(reason==='star'?'☆ゾーンで釣り成功！':'釣り成功！');
    box.append(title,sub);result.append(img,box);
  }else result.textContent=reason==='timeout'?'3周してしまった。魚に逃げられた……':reason==='cancelled'?'釣りを中断した。': '魚に逃げられた……';
  attempt=null;api('status').then(renderPier).catch(console.warn);
  result.scrollIntoView({block:'nearest',behavior:'instant'});
};
const draw=()=>{
  if(view!=='game'||!attempt)return;
  const a=attempt,canvas=$('sea-canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
  const w=500,c=250,cy=242;
  ctx.clearRect(0,0,w,w);
  const elapsed=Date.now()+clockOffset-a.stageStartMs;
  const deg=(elapsed/a.periodMs*360)%360;
  const rad=d=>d*Math.PI/180;
  // v0.17.1.3: 承認済みのローカル釣りプレビューと全く同じリング配置・描画。
  // 2段階は [181,106]、3段階は [181,130,77]、中心は (250,242)。
  // サーバーに送るタップ時刻や当たり判定は変更しない。
  const radii=a.rings===2?[181,106]:[181,130,77];
  const radius=radii[a.stage];
  ctx.fillStyle='#073b4b66';ctx.beginPath();ctx.arc(c,cy,225,0,TWO_PI);ctx.fill();
  for(let i=0;i<=a.stage;i++){
    const rr=radii[i];
    ctx.strokeStyle=i===a.stage?'#063f4ddd':'#70c9dc66';
    ctx.lineWidth=32;ctx.beginPath();ctx.arc(c,cy,rr,0,TWO_PI);ctx.stroke();
    ctx.strokeStyle='#b7f6ff99';ctx.lineWidth=1.5;
    for(const edge of [rr-16,rr+16]){ctx.beginPath();ctx.arc(c,cy,edge,0,TWO_PI);ctx.stroke();}
  }
  // Worker は12時方向を0°としているため、表示時のみ90°戻す。
  const blue=rad(a.blueStart-90),blueWidth=rad(a.blueWidth);
  ctx.lineWidth=30;ctx.lineCap='butt';ctx.strokeStyle='#89f2f5';
  ctx.beginPath();ctx.arc(c,cy,radius,blue,blue+blueWidth);ctx.stroke();
  if(a.starEnabled){
    const star=rad(a.blueStart+a.blueWidth-a.starWidth-90),starWidth=rad(a.starWidth);
    ctx.strokeStyle='#ffe5a0';ctx.beginPath();ctx.arc(c,cy,radius,star,star+starWidth);ctx.stroke();
    const theta=star+starWidth/2;
    ctx.fillStyle='#da930e';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('★',c+radius*Math.cos(theta),cy+radius*Math.sin(theta));
  }
  // 魚もプレビューと同じ形・大きさ・進行方向で描く。
  const theta=rad(deg-90);
  ctx.save();ctx.translate(c+radius*Math.cos(theta),cy+radius*Math.sin(theta));
  ctx.rotate(theta+Math.PI/2);ctx.fillStyle='#ffcb4d';ctx.strokeStyle='#ffe9a0';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(0,0,15,10,0,0,TWO_PI);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-24,-10);ctx.lineTo(-24,10);ctx.closePath();ctx.fill();
  ctx.fillStyle='#503c29';ctx.beginPath();ctx.arc(8,-3,2.6,0,TWO_PI);ctx.fill();ctx.restore();
  ctx.fillStyle='#d7f8ff';ctx.font='36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('⚓',c,cy);
  ctx.fillStyle='white';ctx.font='bold 25px sans-serif';ctx.fillText((a.stage+1)+' / '+a.rings,c,cy-68);
  const laps=Math.max(0,Math.floor(elapsed/a.periodMs));
  $('sea-laps').textContent='残り '+Math.max(0,3-laps)+' 周';
  if(elapsed>=a.periodMs*3){tap();return;}
  raf=requestAnimationFrame(draw);
};
const toGame=()=>{
  view='game';$('sea-pier').classList.add('hidden');$('sea-game').classList.remove('hidden');
  $('sea-result').replaceChildren();$('sea-hint').textContent='';
  cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
  $('sea-game').scrollIntoView({block:'start',behavior:'instant'});
};
const start=async()=>{
  if(busy)return;setBusy(true);
  try{
    const bait=$('sea-bait-worm').checked?'worm':'none';
    const result=await api('start','POST',{bait});attempt=result.attempt;toGame();
  }catch(e){showMessage(e.message);}finally{setBusy(false);}
};
const tap=async()=>{
  if(busy||!attempt||view!=='game')return;
  setBusy(true);cancelAnimationFrame(raf);
  try{
    const response=await api('tap','POST',{attemptId:attempt.id,tapAt:Math.round(Date.now()+clockOffset)});attempt=response.attempt;
    if(response.outcome==='discovery'){view='pier';await bridge.checkEvents();return;}
    if(attempt?.state==='won'){finish(attempt.item,response.outcome);return;}
    if(attempt?.state!=='active'){finish(null,response.outcome);return;}
    if(response.outcome==='next'){showMessage('いい感じ！ 次の輪へ！');raf=requestAnimationFrame(draw);}
    else raf=requestAnimationFrame(draw);
  }catch(e){showMessage('通信が不安定です：'+e.message);raf=requestAnimationFrame(draw);}
  finally{setBusy(false);}
};
const cancel=async()=>{
  if(busy||!attempt)return;setBusy(true);cancelAnimationFrame(raf);
  try{await api('cancel','POST',{attemptId:attempt.id});finish(null,'cancelled');}catch(e){showMessage(e.message);}finally{setBusy(false);}
};
$('sea-start').addEventListener('click',start);
$('sea-resume').addEventListener('click',()=>{if(attempt)toGame();});
$('sea-canvas').addEventListener('click',tap);
$('sea-canvas').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();tap();}});
$('sea-cancel').addEventListener('click',cancel);
$('sea-refresh').addEventListener('click',async()=>{if(!busy)await open();});
$('sea-back').addEventListener('click',()=>{cancelAnimationFrame(raf);view='pier';bridge.openHall();});
window.KAGARISO_SEA={open};
})();
