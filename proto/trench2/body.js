/* ══════════════════════════════════════════════════════════════════
   몸 — 부위별 픽셀 점유 격자와 그 파괴

   부위마다 체력이 있는 게 아니다. 부위마다 격자가 있고, 총알은 거기서
   재료를 실제로 파낸다. 파낸 뒤 관절에서 연결 성분을 훑어, 더 이상
   관절과 이어지지 않는 덩어리를 떨어뜨린다.
   임계점을 숫자로 정하지 않는다 — 팔뚝을 가로로 훑으면 잘리고,
   가운데만 파면 아직 붙어 있다. 규칙이 아니라 결과다.

   속살과 뼈는 재료로는 늘 거기 있지만 **지금 겉으로 드러난 칸에서만**
   보인다. 그래서 겉 스프라이트와 속 스프라이트를 따로 그리지 않아도
   파인 자리에서 상처가 생긴다.
   ══════════════════════════════════════════════════════════════════ */

export const GONE = 0, SURF = 1, SHADE = 2, FLESH = 3, BONE = 4, EYE = 5;

const FLESH_C = [[0x7c,0x21,0x1d], [0x5d,0x16,0x13]];
const BONE_C  = [[0xde,0xd7,0xbd], [0xb3,0xab,0x8e]];
const EYE_C   = [0xe2,0x3c,0x2a];
const SOCK_C  = [0x1d,0x18,0x14];

/* 머리에 눈을 박는다. 도트라 한두 칸이지만, 이게 있고 없고로
   "덩어리"와 "쳐다보는 놈"이 갈린다. 눈두덩을 한 줄 어둡게 깔아
   작은 크기에서도 눈이 파묻히지 않게 한다. */
export function stampEyes(mask, w, h){
  const ey = Math.round(h*0.40);
  const ew = Math.max(1, Math.round(w*0.16));
  const xs = [Math.round(w*0.20), Math.round(w*0.80) - ew + 1];
  for(let x=0;x<w;x++){                       // 눈두덩 그늘
    const i = (ey-1)*w + x;
    if(ey-1 >= 0 && mask[i]) mask[i] = SHADE;
  }
  for(const x0 of xs) for(let dx=0; dx<ew; dx++){
    const x = x0 + dx;
    if(x < 0 || x >= w) continue;
    const i = ey*w + x;
    if(mask[i]) mask[i] = EYE;
  }
}

/* ── 모양 만들기 ────────────────────────────────────────────── */
export function rrect(w, h, r){
  const s = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const cx = x < r ? r : (x > w-1-r ? w-1-r : x);
    const cy = y < r ? r : (y > h-1-r ? h-1-r : y);
    if((x-cx)*(x-cx) + (y-cy)*(y-cy) <= r*r + 0.6) s[y*w+x] = 1;
  }
  return s;
}
/* 각 칸이 겉면에서 몇 칸 안쪽인지 — 침식으로 잰다 */
function depthMap(shape, w, h){
  const d = new Int16Array(w*h).fill(-1);
  let cur = [];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i = y*w+x;
    if(!shape[i]) continue;
    if(x===0||y===0||x===w-1||y===h-1 || !shape[i-1]||!shape[i+1]||!shape[i-w]||!shape[i+w]){
      d[i] = 0; cur.push(i);
    }
  }
  let lvl = 0;
  while(cur.length){
    const next = [];
    for(const i of cur){
      const x = i % w, y = (i / w) | 0;
      if(x>0   && shape[i-1] && d[i-1]<0){ d[i-1]=lvl+1; next.push(i-1); }
      if(x<w-1 && shape[i+1] && d[i+1]<0){ d[i+1]=lvl+1; next.push(i+1); }
      if(y>0   && shape[i-w] && d[i-w]<0){ d[i-w]=lvl+1; next.push(i-w); }
      if(y<h-1 && shape[i+w] && d[i+w]<0){ d[i+w]=lvl+1; next.push(i+w); }
    }
    cur = next; lvl++;
  }
  return d;
}
/* 깊이에 따라 겉면·속살·뼈를 배치한다. 뼈는 부위 한가운데를 세로로 지난다. */
export function materialize(w, h, r, boned){
  const shape = rrect(w, h, r);
  const d = depthMap(shape, w, h);
  const m = new Uint8Array(w*h);
  const cx = (w-1)/2;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i = y*w+x;
    if(!shape[i]) continue;
    if(d[i] === 0)      m[i] = SURF;
    else if(d[i] === 1) m[i] = SHADE;
    else                m[i] = (boned && Math.abs(x-cx) < Math.max(0.9, w*0.18)) ? BONE : FLESH;
  }
  return m;
}

/* ── 그림 굽기 ──────────────────────────────────────────────────
   col = [겉밝음, 겉어두움]. fog 는 거리감 — 멀수록 배경색으로 끌어당긴다. */
export function bakeRGBA(mask, w, h, col, out, fog, fogCol){
  const need = w*h*4;
  if(!out || out.length < need) out = new Uint8Array(need);
  else out.fill(0, 0, need);
  const mix = (c)=>{
    if(!fog) return c;
    return [ c[0] + (fogCol[0]-c[0])*fog | 0,
             c[1] + (fogCol[1]-c[1])*fog | 0,
             c[2] + (fogCol[2]-c[2])*fog | 0 ];
  };
  const CIN = mix(col[0]), CED = mix(col[1]);
  const CF0 = mix(FLESH_C[0]), CF1 = mix(FLESH_C[1]);
  const CB0 = mix(BONE_C[0]),  CB1 = mix(BONE_C[1]);
  const CEY = mix(EYE_C),      CSK = mix(SOCK_C);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i = y*w+x, m = mask[i];
    if(!m) continue;
    const edge = x===0 || y===0 || x===w-1 || y===h-1
              || !mask[i-1] || !mask[i+1] || !mask[i-w] || !mask[i+w];
    let c;
    if(m === EYE)         c = CEY;                       // 눈은 늘 보인다
    else if(y > 0 && mask[i+w] === EYE && !edge) c = CSK; // 눈 바로 위 = 눈두덩
    else if(!edge)        c = CIN;                       // 아직 살갗에 덮인 안쪽
    else if(m === BONE)   c = ((x+y)&1) ? CB1 : CB0;     // 드러난 뼈
    else if(m === FLESH)  c = ((x+y)&1) ? CF1 : CF0;     // 드러난 속살
    else                  c = CED;                       // 원래부터 겉이던 테두리
    const o = i*4;
    out[o] = c[0]; out[o+1] = c[1]; out[o+2] = c[2]; out[o+3] = 255;
  }
  return out;
}

/* ── 파내기 ──────────────────────────────────────────────────────
   지운 칸의 색을 그대로 파편으로 돌려준다 — "부서졌다"는 이게 판다. */
export function carve(part, lx, ly, rad, spit){
  const {w, h} = part.spec;
  const mask = part.mask;
  let removed = 0;
  for(let y = Math.floor(ly-rad); y <= ly+rad; y++){
    if(y<0||y>=h) continue;
    for(let x = Math.floor(lx-rad); x <= lx+rad; x++){
      if(x<0||x>=w) continue;
      const i = y*w+x, m = mask[i];
      if(!m) continue;
      const dx = x-lx, dy = y-ly, dist = Math.hypot(dx, dy);
      if(dist > rad) continue;
      // 가장자리는 확률적으로 남겨 파인 자리가 원이 아니라 너덜해지게.
      // 0.5 로 두면 안쪽까지 듬성듬성해져서 크레이터가 서로 안 이어졌다.
      if(dist > rad*0.62 && Math.random() < (dist/rad - 0.62)*2.4) continue;
      // 뼈는 더 잘 버틴다 — 살이 먼저 없어져 뼈만 남아 덜렁거리는 그림이 나온다
      if(m === BONE && Math.random() < 0.55) continue;
      if(spit) spit(x, y, m);
      mask[i] = GONE; removed++;
    }
  }
  if(removed){ part.alive -= removed; part.dirty = true; }
  return removed;
}

/* ── 연결성: 관절에서 닿지 않는 덩어리는 떨어진다 ──────────────
   부위 하나가 100~300칸이라 매번 전수로 훑어도 값이 거의 안 나간다. */
export function settle(part, drop){
  const {w, h} = part.spec;
  const sy = part.spec.sy ?? part.spec.jy;      // 매달린 줄 — 그리기 축과 별개다
  const mask = part.mask;

  /* 실오라기로 매달린 줄은 끊어진다.
     팔이 5칸 폭인데 한 줄에 한 칸만 남아도 연결 성분으로는 "이어져 있음"이라
     안 떨어졌다. 위아래로 살이 있는 다리(bridge) 줄만 보고, 그게 너무
     가늘면 거기서 끊는다 — 다음 연결성 검사가 아래쪽을 떨어뜨린다. */
  const sm = part.spec.snap || 0;
  if(sm){
    const cnt = new Int16Array(h);
    for(let y=0;y<h;y++){ let n=0; for(let x=0;x<w;x++) if(mask[y*w+x]) n++; cnt[y]=n; }
    for(let y=1;y<h-1;y++){
      if(Math.abs(y - sy) <= 1) continue;          // 관절 줄은 건드리지 않는다
      if(cnt[y] === 0 || cnt[y] > sm) continue;
      if(cnt[y-1] === 0 || cnt[y+1] === 0) continue;  // 끝동강이 아니라 다리여야 한다
      for(let x=0;x<w;x++) if(mask[y*w+x]){ mask[y*w+x] = GONE; part.alive--; }
      part.dirty = true;
    }
  }

  const seen = new Uint8Array(w*h);
  const stack = [];
  for(let dy=-1; dy<=1; dy++){
    const y = sy + dy;
    if(y<0||y>=h) continue;
    for(let x=0;x<w;x++){
      const i = y*w+x;
      if(mask[i] && !seen[i]){ seen[i] = 1; stack.push(i); }
    }
  }
  let held = stack.length;
  while(stack.length){
    const i = stack.pop(), x = i % w;
    if(x>0        && mask[i-1] && !seen[i-1]){ seen[i-1]=1; held++; stack.push(i-1); }
    if(x<w-1      && mask[i+1] && !seen[i+1]){ seen[i+1]=1; held++; stack.push(i+1); }
    if(i>=w       && mask[i-w] && !seen[i-w]){ seen[i-w]=1; held++; stack.push(i-w); }
    if(i<w*(h-1)  && mask[i+w] && !seen[i+w]){ seen[i+w]=1; held++; stack.push(i+w); }
  }

  if(held < part.alive){
    const comp = new Uint8Array(w*h);
    for(let i=0;i<w*h;i++){
      if(!mask[i] || seen[i] || comp[i]) continue;
      const cells = [], st = [i];
      comp[i] = 1;
      while(st.length){
        const k = st.pop(); cells.push(k);
        const x = k % w;
        if(x>0       && mask[k-1] && !seen[k-1] && !comp[k-1]){ comp[k-1]=1; st.push(k-1); }
        if(x<w-1     && mask[k+1] && !seen[k+1] && !comp[k+1]){ comp[k+1]=1; st.push(k+1); }
        if(k>=w      && mask[k-w] && !seen[k-w] && !comp[k-w]){ comp[k-w]=1; st.push(k-w); }
        if(k<w*(h-1) && mask[k+w] && !seen[k+w] && !comp[k+w]){ comp[k+w]=1; st.push(k+w); }
      }
      if(drop) drop(cells);
      for(const k of cells) mask[k] = GONE;
    }
    part.alive = held; part.dirty = true;
    if(part.alive === 0) part.detached = true;
  }

  // 남은 살이 얼마 없으면 그만큼 처진다 — 떨어지기 전에 눈에 보여야 한다
  if(part.spec.sag){
    const t = 1 - part.alive / part.orig;
    part.ang = part.spec.sag * Math.min(1, t*1.4) * Math.min(1, t*1.4);
  }
  return held;
}

/* 떨어져 나간 칸들을 잘라 독립 그림으로 만든다 */
export function cutout(part, cells){
  const {w} = part.spec;
  const mask = part.mask;
  let x0=1e9, y0=1e9, x1=-1e9, y1=-1e9;
  for(const k of cells){
    const x = k % w, y = (k / w) | 0;
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  const gw = x1-x0+1, gh = y1-y0+1;
  const gm = new Uint8Array(gw*gh);
  for(const k of cells){
    const x = k % w, y = (k / w) | 0;
    gm[(y-y0)*gw + (x-x0)] = mask[k];
  }
  return {mask: gm, w: gw, h: gh, ox: x0, oy: y0};
}
