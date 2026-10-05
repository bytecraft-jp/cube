const assert=require('node:assert/strict');
const {CubeModel,moves}=require('./dist/cube.js');
const {plan,checkpoints}=require('./dist/beginner.js');
const yieldFn=()=>Promise.resolve();
let seed=20261005;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
(async()=>{
  const empty=await plan(new CubeModel(),{yieldFn});assert.equal(empty.steps.length,0);
  const samples=Number(process.argv[2]||12);
  for(let sample=0;sample<samples;sample++){
    const cube=new CubeModel(),names=Object.keys(moves).filter(n=>sample%3===0 || 'UDFBRL'.includes(n));
    for(let i=0;i<22;i++)cube.turn(names[Math.floor(random()*names.length)],random()<.5);
    const before=cube.snapshot(),start=performance.now(),answer=await plan(cube,{yieldFn});assert.equal(cube.snapshot(),before);
    for(const stage of answer.stages){
      stage.steps.forEach(s=>cube.turn(s.face,s.inverse));
      const index=['cross','corners','middle','yellowCross','yellowEdges','yellowCorners','orient'].indexOf(stage.id);
      if(index>=0)assert.ok(checkpoints(cube).slice(0,index+1).every(Boolean),stage.id);
    }
    assert.ok(cube.isSolved());console.log(`PASS sample ${sample+1}: ${answer.steps.length} turns, ${(performance.now()-start).toFixed(0)}ms; all seven checkpoints.`);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
