const assert = require('node:assert/strict');
const { CubeModel, faces, moves, pickDragMove, recordMove, solutionFor } = require('./dist/cube.js');
const cube = new CubeModel();
const initial = cube.snapshot();
assert.equal(cube.cubies.length, 26);
assert.equal(cube.cubies.reduce((n,c)=>n+c.stickers.length,0),54);
assert.ok(cube.isSolved());
for(const face of Object.keys(moves)) {
  cube.reset();cube.turn(face);assert.equal(cube.isSolved(),false);
  cube.turn(face,true);assert.equal(cube.snapshot(),initial);
  for(let i=0;i<4;i++)cube.turn(face);
  assert.equal(cube.snapshot(),initial);
}
// A standard R U R' U' sequence has order six.
cube.reset();
for(let i=0;i<6;i++)for(const [face,inverse] of [['R',false],['U',false],['R',true],['U',true]])cube.turn(face,inverse);
assert.equal(cube.snapshot(),initial);
// Check the conventional clockwise front turn against known sticker locations.
cube.reset();cube.turn('F');
const corner=cube.cubies.find(c=>c.id==='1,-1,1');
assert.deepEqual(corner.pos,[1,1,1]);
assert.deepEqual(corner.stickers.find(s=>s.face==='U').normal,[1,0,0]);
// Long mixed sequences preserve cubie occupancy and all sticker normals.
const sequence=[];
let seed=314159;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
cube.reset();
for(let i=0;i<1000;i++) {
  const names=Object.keys(moves);
  const face=names[Math.floor(random()*names.length)],inverse=random()<.5;
  sequence.push([face,inverse]);cube.turn(face,inverse);
  assert.equal(new Set(cube.cubies.map(c=>c.pos.join(','))).size,26);
  for(const c of cube.cubies)for(const s of c.stickers) {
    assert.equal(s.normal.reduce((n,v)=>n+Math.abs(v),0),1);
    const axis=s.normal.findIndex(v=>v!==0);
    assert.equal(c.pos[axis],s.normal[axis]);
  }
}
assert.equal(cube.isSolved(),false);
for(const [face,inverse] of sequence.reverse())cube.turn(face,!inverse);
assert.equal(cube.snapshot(),initial);
assert.throws(()=>cube.turn('invalid'));
assert.equal(cube.snapshot(),initial);
// Known swipes while looking straight at the front, then the back/right/top.
const view={x:0,y:0,scale:1,perspective:1100,offsetX:0,offsetY:0};
for(const [pos,side,dx,dy,face,inverse,orientation] of [
  [[1,-1,1],'F',-100,0,'U',false,{}],
  [[1,-1,1],'F',100,0,'U',true,{}],
  [[1,-1,1],'F',0,100,'R',true,{}],
  [[-1,1,1],'F',100,0,'D',false,{}],
  [[0,0,1],'F',100,0,'E',false,{}],
  [[0,0,1],'F',0,100,'M',false,{}],
  [[1,-1,-1],'B',-100,0,'U',false,{y:180}],
  [[1,-1,0],'R',-100,0,'U',false,{y:-90}],
  [[1,-1,1],'U',0,100,'R',false,{x:90}]
]) {
  const move=pickDragMove(pos,side,dx,dy,{...view,...orientation});
  assert.equal(move.face,face);
  assert.equal(Math.sign(dx*move.unit[0]+dy*move.unit[1])!==moves[face].sign,inverse);
}
console.log('PASS: nine layers, inverses, four-turn identity, standard algorithm, 1,000-turn invariants/reversal, and drag direction after front/back/right/top views.');
// Every generated answer must restore the real model, including middle slices.
let path=[];
cube.reset();
for(let i=0;i<300;i++) {
  const names=Object.keys(moves), face=names[Math.floor(random()*names.length)], inverse=random()<.5;
  cube.turn(face,inverse);path=recordMove(path,face,inverse);
  if(i%7===0) {
    const probe=new CubeModel();probe.cubies=structuredClone(cube.cubies);
    const answer=solutionFor(path);
    for(const step of answer)probe.turn(step.face,step.inverse);
    assert.equal(probe.snapshot(),initial);
    // The next indicated quarter turn must reduce the answer by one step.
    if(answer.length) {
      const next=answer[0], advanced=recordMove(path,next.face,next.inverse);
      assert.equal(solutionFor(advanced).length,answer.length-1);
      const undone=recordMove(advanced,next.face,!next.inverse);
      assert.deepEqual(undone,path);
    }
  }
}
assert.deepEqual(recordMove(recordMove([],'F'),'F',true),[]);
let fourTurns=[];for(let i=0;i<4;i++)fourTurns=recordMove(fourTurns,'M');assert.deepEqual(fourTurns,[]);
const double=recordMove(recordMove([],'R'),'R');
assert.deepEqual(solutionFor(double),[{face:'R',inverse:false},{face:'R',inverse:false}]);
const before=JSON.stringify(double);solutionFor(double);recordMove(double,'U');assert.equal(JSON.stringify(double),before);
assert.throws(()=>recordMove(double,'invalid'));assert.equal(JSON.stringify(double),before);
console.log('PASS: generated solutions restore 300 mixed moves, including middle slices; next-step progress, undo, cancellation, doubles, and immutability.');
