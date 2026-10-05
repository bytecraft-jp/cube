/* A layer-by-layer planner based on cubie positions, never on scramble history. */
(function(root){
  'use strict';
  const engine=typeof module!=='undefined' && module.exports?require('./cube.js'):root.CubeEngine;
  const {CubeModel,faces,moves,rotate}=engine;
  const solved=new CubeModel();
  const clone=model=>{const copy=new CubeModel();copy.cubies=model.cubies.map(c=>({id:c.id,pos:[...c.pos],stickers:c.stickers.map(s=>({face:s.face,normal:[...s.normal]}))}));return copy;};
  const same=(a,b)=>a.every((n,i)=>n===b[i]);
  const parse=text=>text.trim().split(/\s+/).filter(Boolean).flatMap(token=>{
    if(!/^[UDFBRLMES](?:2|'|′)?$/.test(token))throw new Error('Invalid algorithm');
    const step={face:token[0],inverse:/['′]/.test(token)};
    return token.endsWith('2')?[{...step},{...step}]:[step];
  });
  const inverse=steps=>steps.slice().reverse().map(s=>({face:s.face,inverse:!s.inverse}));
  const yaw=(steps,n)=>steps.map(s=>({face:'FRBL'.includes(s.face)?'FRBL'[('FRBL'.indexOf(s.face)+n)%4]:s.face,inverse:s.inverse}));
  const variants=(text,includeInverse=false)=>{
    const base=parse(text), result=[];
    for(let i=0;i<4;i++){const steps=yaw(base,i);result.push(steps);if(includeInverse)result.push(inverse(steps));}
    return result;
  };
  const up=['U',"U'",'U2'].map(parse);
  const algorithms={
    cross:Object.keys(faces).flatMap(face=>[face,face+"'",face+'2'].map(parse)),
    corners:[...up,...variants("R U R' U'",true)],
    middle:[...up,...variants("U R U' R' U' F' U F"),...variants("U' L' U L U F U' F'")],
    yellowCross:[...up,...variants("F R U R' U' F'")],
    yellowEdges:[...up,...variants("R U R' U R U2 R' U")],
    yellowCorners:variants("U R U' L' U R' U' L",true)
  };
  const guides=[
    {id:'cross',title:'白のクロス',goal:'白い十字と、エッジの側面の色を中心に合わせる。',
      text:'白を含む2色のエッジを4個、白の中心のまわりへ集めます。白い十字だけでなく、側面の色と中心も一致していれば完成です。',
      hint:'白のエッジが上にあり、側面の色が中心と合っているときは、その側面を180°回して下へ移せます。',formulas:[],diagram:'whiteCross'},
    {id:'corners',title:'白の面・1段目',goal:'白の4つの角を入れ、側面の下段までそろえる。',
      text:'角の3色から入れる場所を決めます。その真上に角を移し、入れる場所を手前右にして、右手の4手を必要な回数くり返します。下段に間違って入った角は、同じ動きで一度上へ出します。',
      hint:'手順は R U R′ U′。白い面に加えて、側面の下段の色も中心に合わせます。',formulas:["R U R' U'"],diagram:'whiteFace'},
    {id:'middle',title:'中段のエッジ',goal:'白い1段目を保ちながら、側面の2段目をそろえる。',
      text:'上段から黄色を含まないエッジを探し、側面の色を前の中心に合わせます。行き先が右なら右入れ、左なら左入れ。中段に間違った向きで入っている場合は、いったん上段へ出して入れ直します。',
      hint:'白を下、黄色を上にしたまま進めます。',formulas:["U R U' R' U' F' U F","U' L' U L U F U' F'"],diagram:'middle'},
    {id:'yellowCross',title:'黄色のクロス',goal:'上面の4つのエッジを黄色の十字にする。',
      text:'上面の黄色が点・L字・横線のどれかを確認し、6手をくり返して十字にします。ここでは、側面の色の並びはまだ気にしなくて大丈夫です。',
      hint:'横線は左右に伸びる向きに。L字は上面の奥と左に黄色のエッジがある向きにして回します。',formulas:["F R U R' U' F'"],diagram:'yellowCross'},
    {id:'yellowEdges',title:'黄色のエッジの位置',goal:'黄色の十字を保ち、側面のエッジも中心に合わせる。',
      text:'上段のエッジの位置を入れ替えます。上面の向きを調整し、この手順とその向きを変えた手順で、4つの側面の色を中心に合わせます。',
      hint:'この手順は前と左の上段エッジを入れ替えます。必要なら向きを変えてもう一度。',formulas:["R U R' U R U2 R' U"],diagram:'yellowCross'},
    {id:'yellowCorners',title:'黄色の角の位置',goal:'角の3色が、隣り合う3つの中心と一致する位置へ。',
      text:'黄色の角を正しい場所へ移します。黄色が上を向いているかは、この段階では問いません。正しい場所にある角を手前右上にして、残る3つを循環させます。',
      hint:'正しい位置の角がない場合は、一度回してから確認します。',formulas:["U R U' L' U R' U' L"],diagram:'corners'},
    {id:'orient',title:'黄色の角の向き・完成',goal:'角の黄色を上に向けて、6面を完成させる。',
      text:'向きが違う角を手前右上に置き、4手を2回または4回くり返します。次の角は上面だけを回して手前右上へ。全体の持ち方を変えず、最後に上面を合わせます。',
      hint:'途中で下段が崩れて見えても、4手を最後まで回してください。全部の角が終わると下段も戻ります。',formulas:["R' D' R D"],diagram:'yellowFace'}
  ];
  const groups={
    whiteEdges:solved.cubies.filter(c=>c.stickers.length===2 && c.stickers.some(s=>s.face==='D')),
    whiteCorners:solved.cubies.filter(c=>c.stickers.length===3 && c.stickers.some(s=>s.face==='D')),
    middle:solved.cubies.filter(c=>c.stickers.length===2 && c.pos[1]===0),
    yellowEdges:solved.cubies.filter(c=>c.stickers.length===2 && c.stickers.some(s=>s.face==='U')),
    yellowCorners:solved.cubies.filter(c=>c.stickers.length===3 && c.stickers.some(s=>s.face==='U'))
  };
  const slots={2:solved.cubies.filter(c=>c.stickers.length===2).map(c=>c.pos),3:solved.cubies.filter(c=>c.stickers.length===3).map(c=>c.pos)};
  function stateOf(pos,normal,size){
    const slot=slots[size].findIndex(p=>same(p,pos));
    const axes=pos.flatMap((n,i)=>n?[i]:[]);
    const orientation=axes.findIndex(axis=>normal[axis]!==0);
    if(slot<0 || orientation<0)throw new Error('Invalid cubie');
    return slot*size+orientation;
  }
  function unpack(state,size){
    const pos=slots[size][Math.floor(state/size)], axes=pos.flatMap((n,i)=>n?[i]:[]), normal=[0,0,0];
    normal[axes[state%size]]=pos[axes[state%size]];
    return {pos:[...pos],normal};
  }
  const powers=[1,24,576,13824];
  function keyOf(model,pieces){
    return pieces.reduce((key,piece,i)=>{
      const c=model.cubies.find(c=>c.id===piece.id), s=c.stickers.find(s=>s.face===piece.stickers[0].face);
      return key+stateOf(c.pos,s.normal,c.stickers.length)*powers[i];
    },0);
  }
  function transforms(macros,size){
    return macros.map(macro=>Uint8Array.from({length:24},(_,code)=>{
      let {pos,normal}=unpack(code,size);
      for(const step of macro){const f=moves[step.face];if(pos[f.axis]===f.layer){const sign=f.sign*(step.inverse?-1:1);pos=rotate(pos,f.axis,sign);normal=rotate(normal,f.axis,sign);}}
      return stateOf(pos,normal,size);
    }));
  }
  function transformKey(key,table){
    let next=0;
    for(let i=0;i<4;i++){next+=table[key%24]*powers[i];key=Math.floor(key/24);}
    return next;
  }
  function exactGoal(key,pieces,positionOnly=false){
    for(const piece of pieces){const expected=stateOf(piece.pos,piece.stickers[0].normal,piece.stickers.length), actual=key%24;key=Math.floor(key/24);
      if(positionOnly?Math.floor(actual/piece.stickers.length)!==Math.floor(expected/piece.stickers.length):actual!==expected)return false;
    }
    return true;
  }
  function yellowGoal(key){
    for(let i=0;i<4;i++){const {normal}=unpack(key%24,2);if(!same(normal,faces.U.normal))return false;key=Math.floor(key/24);}return true;
  }
  const cache=new Map();
  async function search(model,pieces,macros,goal,yieldFn){
    const start=keyOf(model,pieces);if(goal(start))return [];
    const cacheKey=macros;
    if(!cache.has(cacheKey))cache.set(cacheKey,transforms(macros,pieces[0].stickers.length));
    const tables=cache.get(cacheKey), capacity=24**4;
    const parents=new Int32Array(capacity).fill(-1), via=new Uint8Array(capacity), queue=new Uint32Array(capacity);
    let head=0,tail=1,found=-1;queue[0]=start;parents[start]=start;
    while(head<tail && found<0){
      const current=queue[head++];
      for(let a=0;a<tables.length;a++){
        const next=transformKey(current,tables[a]);if(parents[next]!==-1)continue;
        parents[next]=current;via[next]=a;queue[tail++]=next;
        if(goal(next)){found=next;break;}
      }
      if(head%3000===0)await yieldFn();
    }
    if(found<0)throw new Error('この段階の手順を見つけられませんでした。');
    const route=[];while(found!==start){route.push(via[found]);found=parents[found];}
    return route.reverse().flatMap(a=>macros[a].map(s=>({...s})));
  }
  function centersKey(model){return Object.keys(faces).map(face=>model.cubies.find(c=>c.stickers.length===1 && c.stickers[0].face===face).pos.join(',')).join(';');}
  const targetCenters=centersKey(solved);
  const wholeTurns=[parse("R M' L'"),parse("D E U'"),parse("F S B'")];
  function normalize(model){
    if(centersKey(model)===targetCenters)return [];
    const queue=[{cube:clone(model),steps:[]}],seen=new Set([centersKey(model)]);
    for(let head=0;head<queue.length;head++)for(const macro of wholeTurns){
      const cube=clone(queue[head].cube);macro.forEach(s=>cube.turn(s.face,s.inverse));
      const key=centersKey(cube),steps=[...queue[head].steps,...macro];
      if(key===targetCenters)return steps;
      if(!seen.has(key)){seen.add(key);queue.push({cube,steps});}
    }
    throw new Error('中心の配置を確認できませんでした。');
  }
  function pieceSolved(model,piece,positionOnly=false){
    const c=model.cubies.find(c=>c.id===piece.id);
    return same(c.pos,piece.pos) && (positionOnly || piece.stickers.every(s=>same(s.normal,c.stickers.find(t=>t.face===s.face).normal)));
  }
  function checkpoints(model){
    const check=pieces=>pieces.every(p=>pieceSolved(model,p));
    return [check(groups.whiteEdges),check(groups.whiteEdges)&&check(groups.whiteCorners),check(groups.whiteEdges)&&check(groups.whiteCorners)&&check(groups.middle),
      check(groups.whiteEdges)&&check(groups.whiteCorners)&&check(groups.middle)&&groups.yellowEdges.every(p=>{const c=model.cubies.find(c=>c.id===p.id);return same(c.stickers.find(s=>s.face==='U').normal,faces.U.normal);}),
      check(groups.whiteEdges)&&check(groups.whiteCorners)&&check(groups.middle)&&check(groups.yellowEdges),
      check(groups.whiteEdges)&&check(groups.whiteCorners)&&check(groups.middle)&&check(groups.yellowEdges)&&groups.yellowCorners.every(p=>pieceSolved(model,p,true)),model.isSolved()];
  }
  async function plan(input,{onProgress=()=>{},yieldFn=()=>new Promise(r=>setTimeout(r,0))}={}){
    const model=clone(input),result=[];
    if(model.isSolved())return {stages:[],steps:[]};
    function add(id,title,steps){
      for(const s of steps)model.turn(s.face,s.inverse);
      result.push({id,title,steps:steps.map(s=>({...s,stage:id}))});
    }
    const orientation=normalize(model);if(orientation.length)add('prepare','準備：白を下、黄色を上へ',orientation);
    const configs=[
      [groups.whiteEdges,algorithms.cross,key=>exactGoal(key,groups.whiteEdges)],
      [groups.whiteCorners,algorithms.corners,key=>exactGoal(key,groups.whiteCorners)],
      [groups.middle,algorithms.middle,key=>exactGoal(key,groups.middle)],
      [groups.yellowEdges,algorithms.yellowCross,yellowGoal],
      [groups.yellowEdges,algorithms.yellowEdges,key=>exactGoal(key,groups.yellowEdges)],
      [groups.yellowCorners,algorithms.yellowCorners,key=>exactGoal(key,groups.yellowCorners,true)]
    ];
    for(let i=0;i<configs.length;i++){
      onProgress(guides[i].title);await yieldFn();
      const [pieces,macros,goal]=configs[i];const steps=await search(model,pieces,macros,goal,yieldFn);
      add(guides[i].id,guides[i].title,steps);
      if(!checkpoints(model).slice(0,i+1).every(Boolean))throw new Error('段階の完成チェックに失敗しました。');
    }
    onProgress(guides[6].title);await yieldFn();
    const final=[];
    const apply=steps=>{steps.forEach(s=>model.turn(s.face,s.inverse));final.push(...steps);};
    if(!model.isSolved())for(let corner=0;corner<4;corner++){
      const oriented=()=>{const c=model.cubies.find(c=>same(c.pos,[1,-1,1]));return same(c.stickers.find(s=>s.face==='U').normal,faces.U.normal);};
      let turns=0;
      while(!oriented()){
        if(turns++>=2)throw new Error('角の向きを確認できませんでした。');
        apply(parse("R' D' R D R' D' R D"));
      }
      apply(parse('U'));
    }
    result.push({id:'orient',title:guides[6].title,steps:final.map(s=>({...s,stage:'orient'}))});
    if(!model.isSolved())throw new Error('完成チェックに失敗しました。');
    return {stages:result,steps:result.flatMap(s=>s.steps)};
  }
  const api={plan,guides,parse,checkpoints,algorithms,clone};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.CubeBeginner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
