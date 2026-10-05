'use strict';
const {CubeModel,faces,moves,pickDragMove,recordMove,solutionFor} = CubeEngine;
const model = new CubeModel();
const $ = id => document.getElementById(id);
const cubeEl = $('cube'), orbit = $('orbit'), scene = $('scene');
const elements = new Map();
let inverse = false, busy = false, history = [], moveCount = 0;
let running = false, elapsed = 0, startedAt = 0, challenge = false;
let viewX = -24, viewY = -34, toastTimeout;
let solutionPath = [], solutionVisible = false;
let beginnerVisible=false, beginnerSteps=null, beginnerIndex=0, beginnerStage='cross', beginnerCalculating=false, beginnerProgress='';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const c of model.cubies) {
  const el = document.createElement('div'); el.className = 'cubie';
  el.dataset.cubie = c.id;
  for (const face of Object.keys(faces)) {
    const side = document.createElement('div'); side.className = 'cubie-face'; side.dataset.side = face; el.append(side);
  }
  cubeEl.append(el); elements.set(c.id,el);
}
function renderCube() {
  for(const c of model.cubies) {
    const el = elements.get(c.id);
    el.style.transform = `translate3d(${c.pos[0]*82}px,${c.pos[1]*82}px,${c.pos[2]*82}px)`;
    for(const side of el.children) {
      side.replaceChildren();
      const normal = faces[side.dataset.side].normal;
      const s = c.stickers.find(s => s.normal.every((n,i) => n === normal[i]));
      if(s) {
        const sticker = document.createElement('div'); sticker.className = 'sticker' + (c.stickers.length===1 ? ' center' : '');
        sticker.style.backgroundColor = faces[s.face].color; side.append(sticker);
      }
    }
  }
}
function renderStats() {
  $('moves').innerHTML = `${moveCount}<small> moves</small>`;
  $('undo').disabled = busy || !history.length;
  document.querySelectorAll('[data-face],#shuffle,#reset,#clockwise,#counterclockwise').forEach(b => { b.disabled=busy; });
  const solved = model.isSolved();
  $('status').classList.toggle('playing',!solved);
  $('status').innerHTML = `<i></i> ${busy ? '回転中…' : solved ? (challenge ? 'クリア！' : 'そろっています') : challenge ? 'チャレンジ中' : '自由に練習中'}`;
  $('history').replaceChildren();
  if(!history.length) {
    const empty=document.createElement('span');empty.className='history-empty';empty.textContent=challenge?'準備OK。最初の一手でタイマースタート。':'最初の一手を回してみよう。';$('history').append(empty);
  } else for(const h of history.slice(-12)) {
    const chip=document.createElement('span');chip.className='history-chip';chip.textContent=h.face+(h.inverse?'′':'');$('history').append(chip);
  }
  renderSolution();
  renderBeginner();
  renderDock();
}
function renderDock() {
  $('guide-dock').hidden=!solutionVisible && !beginnerVisible;
  $('solution-step').hidden=!solutionVisible;
  $('beginner-step').hidden=!beginnerVisible;
  $('beginner-calculate').hidden=!beginnerVisible;
  if(beginnerVisible) {
    $('dock-title').textContent=$('beginner-progress').textContent;
    $('dock-next').textContent=$('beginner-next').textContent;
  } else if(solutionVisible) {
    $('dock-title').textContent=`正解手順 · ${$('solution-count').textContent}`;
    $('dock-next').textContent=$('solution-next').textContent;
  }
}
function showDetails(panel) {
  const scroller=$('control-scroll');
  scroller.scrollTo({top:panel.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop,behavior:reducedMotion?'auto':'smooth'});
}
const faceNames={U:'上面',D:'下面',F:'前面',B:'背面',R:'右面',L:'左面'};
const middleNames={M:'中央の縦列（左面から見た向き）',E:'中央の横列（下面から見た向き）',S:'前後の中央の層（前面から見た向き）'};
function moveDescription(step) {
  return `${faceNames[step.face]||middleNames[step.face]}を${step.inverse?'反時計回り':'時計回り'}に90°`;
}
function renderSolution() {
  const sequence=model.isSolved()?[]:solutionFor(solutionPath);
  $('solution-toggle').disabled=busy;
  $('solution-toggle').setAttribute('aria-expanded',String(solutionVisible));
  $('solution-toggle').textContent=solutionVisible?'正解手順を閉じる':'正解手順を見る';
  $('solution-panel').hidden=!solutionVisible;
  $('solution-step').disabled=busy || !sequence.length;
  if(!solutionVisible)return;
  $('solution-count').textContent=sequence.length?`残り${sequence.length}手`:'完成';
  $('solution-next').textContent=busy?'回転が終わると手順が更新されます。':sequence.length?`次は ${sequence[0].face}${sequence[0].inverse?'′':''}：${moveDescription(sequence[0])}`:'6つの面がそろっています。';
  $('solution-list').replaceChildren();
  sequence.forEach((step,i)=>{
    const item=document.createElement('li');item.className='solution-chip';
    if(i===0)item.setAttribute('aria-current','step');
    const number=document.createElement('span');number.className='solution-number';number.textContent=String(i+1);
    const label=document.createElement('strong');label.textContent=step.face+(step.inverse?'′':'');
    item.title=moveDescription(step);item.setAttribute('aria-label',`${i+1}手目：${moveDescription(step)}`);
    item.append(number,label);$('solution-list').append(item);
  });
}
function renderTime() {
  const time = elapsed + (running ? performance.now()-startedAt : 0);
  const minutes=Math.floor(time/60000), seconds=Math.floor(time/1000)%60, tenth=Math.floor(time/100)%10;
  $('time').innerHTML=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}<small>.${tenth}</small>`;
}
function invalidateBeginner(message='') {
  beginnerSteps=null;beginnerIndex=0;beginnerProgress=message;
}
function trackBeginnerMove(face,reverse) {
  if(!beginnerSteps)return;
  const next=beginnerSteps[beginnerIndex],previous=beginnerSteps[beginnerIndex-1];
  if(next && next.face===face && next.inverse===reverse)beginnerIndex++;
  else if(previous && previous.face===face && previous.inverse!==reverse)beginnerIndex--;
  else {invalidateBeginner('キューブを動かしました。この状態から手順を作り直せます。');return;}
  const current=beginnerSteps[beginnerIndex];
  if(current && current.stage!=='prepare')beginnerStage=current.stage;
}
function renderBeginner() {
  $('beginner-toggle').disabled=busy;
  $('beginner-toggle').setAttribute('aria-expanded',String(beginnerVisible));
  $('beginner-toggle').textContent=beginnerVisible?'初心者の解法を閉じる':'初心者向けの解法を学ぶ';
  $('beginner-panel').hidden=!beginnerVisible;
  $('beginner-calculate').disabled=busy;
  $('beginner-step').disabled=busy || !beginnerSteps || beginnerIndex>=beginnerSteps.length || model.isSolved();
  if(!beginnerVisible)return;
  $('beginner-stages').replaceChildren();
  CubeBeginner.guides.forEach((guide,i)=>{
    const button=document.createElement('button');button.textContent=`${i+1}. ${guide.title}`;
    button.setAttribute('aria-pressed',String(guide.id===beginnerStage));
    button.onclick=()=>{beginnerStage=guide.id;renderBeginner();};$('beginner-stages').append(button);
  });
  const guide=CubeBeginner.guides.find(g=>g.id===beginnerStage);
  $('beginner-stage-title').textContent=guide.title;$('beginner-goal').textContent=guide.goal;
  $('beginner-text').textContent=guide.text;$('beginner-hint').textContent=guide.hint;
  $('beginner-formulas').replaceChildren();
  guide.formulas.forEach((formula,i)=>{const code=document.createElement('code');code.textContent=(guide.id==='middle'?(i===0?'右入れ：':'左入れ：'):'')+formula.replaceAll("'",'′');$('beginner-formulas').append(code);});
  const color=guide.diagram.startsWith('white')?faces.D.color:guide.diagram==='middle'?faces.F.color:faces.U.color;
  const cells=guide.diagram.endsWith('Cross')?[1,3,4,5,7]:guide.diagram==='middle'?[3,4,5,6,7,8]:guide.diagram==='corners'?[0,2,4,6,8]:[0,1,2,3,4,5,6,7,8];
  $('beginner-goal-face').replaceChildren();
  for(let i=0;i<9;i++){const cell=document.createElement('span');cell.style.background=cells.includes(i)?color:'#dfe4d5';if(guide.diagram==='corners' && [0,2,6,8].includes(i)){cell.textContent='角';cell.style.background='#d5deb7';}$('beginner-goal-face').append(cell);}
  const diagramLabel=guide.diagram==='middle'?'側面の下2段':guide.diagram==='corners'?'角の位置（向きは不問）':guide.diagram.startsWith('white')?'下面の目標':'上面の目標';
  $('beginner-goal-face').setAttribute('aria-label',`${diagramLabel}：${guide.goal}`);$('beginner-diagram-label').textContent=diagramLabel;
  const next=beginnerSteps?.[beginnerIndex], remaining=(beginnerSteps?.length||0)-beginnerIndex;
  $('beginner-progress').textContent=beginnerCalculating?beginnerProgress:model.isSolved()?'6つの面がそろっています。':next?`現在の段階：${next.stage==='prepare'?'準備：白を下、黄色を上へ':CubeBeginner.guides.find(g=>g.id===next.stage).title} · 全体で残り${remaining}手`:beginnerProgress||'現在の配色から、7段階でそろえる手順を作れます。';
  $('beginner-next').textContent=next && !model.isSolved()?`次は ${next.face}${next.inverse?'′':''}：${moveDescription(next)}`:model.isSolved()?'完成です。シャッフルすると解法を試せます。':'「この状態の手順を作る」で始めましょう。';
  $('beginner-moves').replaceChildren();
  if(next && !model.isSolved())for(let i=beginnerIndex;i<beginnerSteps.length && beginnerSteps[i].stage===next.stage;i++){
    const step=beginnerSteps[i],item=document.createElement('li');item.className='solution-chip';if(i===beginnerIndex)item.setAttribute('aria-current','step');
    const number=document.createElement('span');number.className='solution-number';number.textContent=String(i-beginnerIndex+1);
    const label=document.createElement('strong');label.textContent=step.face+(step.inverse?'′':'');item.title=moveDescription(step);item.setAttribute('aria-label',moveDescription(step));item.append(number,label);$('beginner-moves').append(item);
  }
}
function stopTimer() { if(running) elapsed+=performance.now()-startedAt;running=false; }
function toast(message) { $('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),4000); }
function cubieTranslation(c) {
  return `translate3d(${c.pos[0]*82}px,${c.pos[1]*82}px,${c.pos[2]*82}px)`;
}
async function animateLayer(face, fromAngle, angle, duration=180) {
  const f=moves[face], axis='XYZ'[f.axis];
  const selected=model.cubies.filter(c=>c.pos[f.axis]===f.layer);
  if(!reducedMotion && duration>0) {
    await Promise.all(selected.map(c=>{
      const el=elements.get(c.id), base=cubieTranslation(c);
      return el.animate([{transform:`rotate${axis}(${fromAngle}deg) ${base}`},{transform:`rotate${axis}(${angle}deg) ${base}`}],{duration,easing:'cubic-bezier(.3,.05,.2,1)'}).finished;
    }));
  }
}
async function animateTurn(face, reverse, duration=180, fromAngle=0) {
  await animateLayer(face,fromAngle,moves[face].sign*(reverse?-90:90),duration);
  model.turn(face,reverse);
  trackBeginnerMove(face,reverse);
  solutionPath=model.isSolved()?[]:recordMove(solutionPath,face,reverse);
  renderCube();
}
async function turn(face,reverse=inverse,fromAngle=0) {
  if(busy) return;
  busy=true;
  if(!running) { if(challenge && model.isSolved()) elapsed=0;running=true;startedAt=performance.now(); }
  renderStats();
  await animateTurn(face,reverse,180,fromAngle);
  history.push({face,inverse:reverse});moveCount++;busy=false;
  if(model.isSolved()) { stopTimer();toast(challenge?`クリア！ ${moveCount}手で6面がそろいました。`:'6つの面がそろいました！'); }
  renderStats();renderTime();
}
function setDirection(reverse) {
  inverse=reverse;
  $('clockwise').classList.toggle('active',!reverse);$('counterclockwise').classList.toggle('active',reverse);
  $('clockwise').setAttribute('aria-pressed',String(!reverse));$('counterclockwise').setAttribute('aria-pressed',String(reverse));
}
document.querySelectorAll('[data-face]').forEach(b=>b.addEventListener('click',()=>turn(b.dataset.face)));
$('clockwise').onclick=()=>setDirection(false);$('counterclockwise').onclick=()=>setDirection(true);
$('undo').onclick=async()=>{
  if(busy||!history.length)return;
  busy=true;renderStats();const last=history.pop();await animateTurn(last.face,!last.inverse);
  moveCount=Math.max(0,moveCount-1);busy=false;if(model.isSolved())stopTimer();renderStats();renderTime();
};
$('shuffle').onclick=async()=>{
  if(busy)return;
  busy=true;stopTimer();elapsed=0;history=[];moveCount=0;challenge=true;solutionPath=[];invalidateBeginner();model.reset();renderCube();renderStats();renderTime();
  let lastAxis=-1;
  for(let i=0;i<22;i++) {
    const candidates=Object.keys(faces).filter(face=>faces[face].axis!==lastAxis);
    const face=candidates[Math.floor(Math.random()*candidates.length)];lastAxis=faces[face].axis;
    await animateTurn(face,Math.random()<.5,55);
  }
  busy=false;renderStats();toast('準備OK！ 最初の一手からタイムを計ります。');
};
$('reset').onclick=()=>{
  if(busy)return;
  model.reset();history=[];moveCount=0;solutionPath=[];invalidateBeginner();stopTimer();elapsed=0;challenge=false;renderCube();renderStats();renderTime();toast('キューブを初期状態に戻しました。');
};
$('solution-toggle').onclick=()=>{
  solutionVisible=!solutionVisible;if(solutionVisible)beginnerVisible=false;renderStats();
  if(solutionVisible)showDetails($('solution-panel'));
};
$('solution-step').onclick=async()=>{
  if(busy || model.isSolved())return;
  const next=solutionFor(solutionPath)[0];
  if(next)await turn(next.face,next.inverse);
};
$('beginner-toggle').onclick=()=>{
  beginnerVisible=!beginnerVisible;if(beginnerVisible)solutionVisible=false;renderStats();
  if(beginnerVisible)showDetails($('beginner-panel'));
};
$('dock-close').onclick=()=>{
  beginnerVisible=false;solutionVisible=false;renderStats();
  $('control-scroll').scrollTo({top:0,behavior:reducedMotion?'auto':'smooth'});
};
$('beginner-calculate').onclick=async()=>{
  if(busy || drag)return;
  busy=true;beginnerCalculating=true;invalidateBeginner('手順を作っています…');renderStats();
  try {
    const answer=await CubeBeginner.plan(model,{onProgress:title=>{beginnerProgress=`手順を作っています：${title}`;renderBeginner();renderDock();}});
    beginnerSteps=answer.steps;beginnerIndex=0;beginnerStage=answer.steps.find(s=>s.stage!=='prepare')?.stage||'cross';beginnerProgress='';
  } catch(error) {
    invalidateBeginner('手順を作れませんでした。もう一度試してください。');toast('手順を作れませんでした。もう一度試してください。');
    console.error(error);
  } finally {busy=false;beginnerCalculating=false;renderStats();}
};
$('beginner-step').onclick=async()=>{
  if(busy || !beginnerSteps || model.isSolved())return;
  const next=beginnerSteps[beginnerIndex];if(next)await turn(next.face,next.inverse);
};
function renderView() {orbit.style.transform=`rotateX(${viewX}deg) rotateY(${viewY}deg)`;}
$('view-reset').onclick=()=>{viewX=-24;viewY=-34;renderView();};
let drag=null;
function dragView() {
  const origin=orbit.getBoundingClientRect(), rect=scene.getBoundingClientRect();
  const style=getComputedStyle(scene), center=style.perspectiveOrigin.split(' ').map(parseFloat);
  return {
    x:viewX,y:viewY,scale:parseFloat(getComputedStyle(orbit).scale)||1,
    perspective:parseFloat(style.perspective)||1100,
    offsetX:origin.left-rect.left-(center[0]||rect.width/2),
    offsetY:origin.top-rect.top-(center[1]||rect.height/2)
  };
}
scene.addEventListener('pointerdown',e=>{
  if(e.button!==0 || drag)return;
  const side=e.target.closest('.cubie-face'), tile=side?.querySelector('.sticker');
  if(tile && busy)return;
  const c=tile && model.cubies.find(c=>c.id===tile.closest('.cubie').dataset.cubie);
  drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,tile:!!tile,pos:c?[...c.pos]:null,side:side?.dataset.side,view:dragView(),move:null,angle:0};
  if(tile){busy=true;renderStats();}
  scene.setPointerCapture(e.pointerId);scene.focus({preventScroll:true});e.preventDefault();
});
scene.addEventListener('pointermove',e=>{
  if(!drag || drag.pointerId!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.tile) {
    viewY+=dx*.4;viewX=Math.max(-85,Math.min(85,viewX-dy*.4));drag.x=e.clientX;drag.y=e.clientY;renderView();return;
  }
  if(!drag.move) {
    if(Math.hypot(dx,dy)<8)return;
    drag.move=pickDragMove(drag.pos,drag.side,dx,dy,drag.view);
    if(!drag.move)return;
    busy=true;renderStats();scene.classList.add('turning');
  }
  const {face,unit}=drag.move, f=moves[face];
  drag.angle=Math.max(-100,Math.min(100,(dx*unit[0]+dy*unit[1])*.8/drag.view.scale));
  for(const c of model.cubies)if(c.pos[f.axis]===f.layer) {
    const el=elements.get(c.id);el.classList.add('selected-layer');
    el.style.transform=`rotate${'XYZ'[f.axis]}(${drag.angle}deg) ${cubieTranslation(c)}`;
  }
});
async function finishDrag(e,cancel=false) {
  if(!drag || drag.pointerId!==e.pointerId)return;
  const gesture=drag;drag=null;
  scene.classList.remove('turning');elements.forEach(el=>el.classList.remove('selected-layer'));
  if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);
  if(!gesture.move){if(gesture.tile){busy=false;renderStats();}return;}
  if(!cancel && Math.abs(gesture.angle)>=20) {
    busy=false;
    await turn(gesture.move.face,Math.sign(gesture.angle)!==moves[gesture.move.face].sign,gesture.angle);
  } else {
    await animateLayer(gesture.move.face,gesture.angle,0,120);
    renderCube();busy=false;renderStats();
  }
}
scene.addEventListener('pointerup',e=>finishDrag(e));
scene.addEventListener('pointercancel',e=>finishDrag(e,true));
scene.addEventListener('lostpointercapture',e=>finishDrag(e,true));
window.addEventListener('keydown',e=>{
  if($('help-dialog').open || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(drag)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const face=e.key.toUpperCase();
  if(Object.hasOwn(faces,face)){e.preventDefault();turn(face,e.shiftKey||inverse);}
  if(e.key.startsWith('Arrow')) {
    e.preventDefault();if(e.key==='ArrowLeft')viewY-=12;if(e.key==='ArrowRight')viewY+=12;if(e.key==='ArrowUp')viewX=Math.min(85,viewX+12);if(e.key==='ArrowDown')viewX=Math.max(-85,viewX-12);renderView();
  }
});
$('help').onclick=()=>$('help-dialog').showModal();
for(const id of ['close-help','start-playing'])$(id).onclick=()=>$('help-dialog').close();
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function fitCubeToScene() {
  if(!scene.clientWidth || !scene.clientHeight)return;
  orbit.style.scale=String(Math.max(.2,Math.min(1.1,(scene.clientWidth-36)/400,(scene.clientHeight-12)/400)));
}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitCubeToScene).observe(scene);
window.addEventListener('resize',fitCubeToScene);
setInterval(renderTime,100);renderCube();renderStats();renderTime();fitCubeToScene();
