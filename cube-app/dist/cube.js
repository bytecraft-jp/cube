/* A discrete cube model shared by the renderer and the verification script. */
(function (root) {
  'use strict';
  const faces = {
    U: { axis: 1, layer: -1, sign: -1, normal: [0,-1,0], color: '#ecc44d' },
    D: { axis: 1, layer: 1, sign: 1, normal: [0,1,0], color: '#f7f4e8' },
    F: { axis: 2, layer: 1, sign: 1, normal: [0,0,1], color: '#5bad88' },
    B: { axis: 2, layer: -1, sign: -1, normal: [0,0,-1], color: '#5b96ce' },
    R: { axis: 0, layer: 1, sign: 1, normal: [1,0,0], color: '#e57061' },
    L: { axis: 0, layer: -1, sign: -1, normal: [-1,0,0], color: '#efa064' }
  };
  const moves = {
    ...faces,
    M: { axis: 0, layer: 0, sign: -1 },
    E: { axis: 1, layer: 0, sign: 1 },
    S: { axis: 2, layer: 0, sign: 1 }
  };
  function rotateBy(v, axis, radians) {
    const result = [...v], a = (axis+1)%3, b = (axis+2)%3;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    result[a] = v[a]*cos-v[b]*sin;
    result[b] = v[a]*sin+v[b]*cos;
    return result;
  }
  function projectPoint(point, view) {
    const radians = Math.PI/180;
    const p = rotateBy(rotateBy(point,1,view.y*radians),0,view.x*radians).map(n=>n*view.scale);
    const factor = 1/(1-p[2]/view.perspective);
    return [(p[0]+view.offsetX)*factor,(p[1]+view.offsetY)*factor];
  }
  // Compare the screen-space tangents of the two rows crossing the picked tile.
  // This keeps a swipe following the finger even after the whole cube is orbited.
  function pickDragMove(pos, side, dx, dy, view) {
    const normal = faces[side].normal;
    const point = pos.map((n,i)=>n*82+normal[i]*40);
    let best = null;
    for(let axis=0;axis<3;axis++) {
      if(normal[axis]) continue;
      const before = projectPoint(rotateBy(point,axis,-.01),view);
      const after = projectPoint(rotateBy(point,axis,.01),view);
      const tangent = after.map((n,i)=>n-before[i]);
      const length = Math.hypot(...tangent);
      if(length<.001) continue;
      const unit = tangent.map(n=>n/length);
      const alignment = dx*unit[0]+dy*unit[1];
      if(!best || Math.abs(alignment)>best.score) {
        const face = Object.keys(moves).find(name=>moves[name].axis===axis && moves[name].layer===pos[axis]);
        best = { face, unit, score: Math.abs(alignment) };
      }
    }
    return best;
  }
  function rotate(v, axis, sign) {
    const [x,y,z] = v;
    if (axis === 0) return [x, -sign*z, sign*y];
    if (axis === 1) return [sign*z, y, -sign*x];
    return [-sign*y, sign*x, z];
  }
  // Keep a reduced path from the last completed cube to the current position.
  // Its inverse is always a valid solution, including middle-slice moves.
  function recordMove(path, face, inverse=false) {
    if(!Object.hasOwn(moves,face)) throw new Error('Unknown cube face');
    const result = [...path], last = result[result.length-1];
    const turns = ((last?.face===face ? result.pop().turns : 0)+(inverse?3:1))%4;
    if(turns) result.push({face,turns});
    return result;
  }
  function solutionFor(path) {
    const result = [];
    for(let i=path.length-1;i>=0;i--) {
      const {face,turns} = path[i];
      if(turns===1) result.push({face,inverse:true});
      else if(turns===3) result.push({face,inverse:false});
      else if(turns===2) result.push({face,inverse:false},{face,inverse:false});
    }
    return result;
  }
  class CubeModel {
    constructor() { this.reset(); }
    reset() {
      this.cubies = [];
      for (let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) {
        if (!x && !y && !z) continue;
        const pos = [x,y,z];
        const stickers = Object.entries(faces).filter(([,f]) => pos[f.axis] === f.layer)
          .map(([face,f]) => ({ face, normal: [...f.normal] }));
        this.cubies.push({ id: `${x},${y},${z}`, pos, stickers });
      }
    }
    turn(face, inverse=false) {
      if (!Object.hasOwn(moves,face)) throw new Error('Unknown cube face');
      const f = moves[face], sign = f.sign * (inverse ? -1 : 1);
      for (const c of this.cubies) if(c.pos[f.axis] === f.layer) {
        c.pos = rotate(c.pos,f.axis,sign);
        c.stickers.forEach(s => { s.normal = rotate(s.normal,f.axis,sign); });
      }
    }
    isSolved() {
      return Object.values(faces).every(f => {
        const colors = this.cubies.flatMap(c => c.stickers.filter(s => s.normal.every((n,i) => n === f.normal[i])).map(s => s.face));
        return colors.length === 9 && colors.every(c => c === colors[0]);
      });
    }
    snapshot() { return JSON.stringify(this.cubies.map(c => ({id:c.id,pos:c.pos.map(n=>n||0),stickers:c.stickers.map(s=>({face:s.face,normal:s.normal.map(n=>n||0)}))}))); }
  }
  const api = { CubeModel, faces, moves, rotate, projectPoint, pickDragMove, recordMove, solutionFor };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CubeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
