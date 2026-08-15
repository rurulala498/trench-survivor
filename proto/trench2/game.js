/* ══════════════════════════════════════════════════════════════════
   참호 2 — 도트 1인칭, 맞은 자리가 부서지는 좀비

   기존 게임(src/)과는 완전히 별개다. 렌더는 WebGL2 배치 한 방,
   좀비는 부위마다 픽셀 격자를 들고 있고 총알은 거기서 재료를 파낸다.
   ══════════════════════════════════════════════════════════════════ */
import { createGL } from './gl.js';
import { materialize, bakeRGBA, carve, settle, cutout, rrect, stampEyes } from './body.js';

/* ── 화면 · 원근 ────────────────────────────────────────────────
   논리 해상도를 작게 두고 캔버스를 통째로 확대한다 — 그게 도트다. */
export const W = 384, H = 216;
const HORIZON = 86;
const PROJ_K = 0.6, PROJ_Y = 197, PROJ_X = 190, PROJ_S = 4.32;
/* 5.0 은 "나타나자마자 이미 위협"인 거리다. 8.0 일 때는 지평선 근처에서
   점만 하게 오래 걸어와서, 총을 쏠 이유가 생기기까지 십 초가 걸렸다. */
const D_SPAWN = 5.0, D_MELEE = 1.8;
const FUNNEL = 1.45;                     // 통로 반폭 — 좁을수록 앞뒤로 겹쳐 밀려온다
const MAX_LIVE = 190;

const projP = d => 1 / (d + PROJ_K);
const projY = d => HORIZON + PROJ_Y * projP(d);
const projX = (wx, d) => W/2 + wx * PROJ_X * projP(d);
const projS = d => PROJ_S * projP(d);

/* ── 부위 배치 ──────────────────────────────────────────────────
   좌표는 전부 몸통 안의 칸 단위. pj = 몸통에서 붙는 자리,
   j = 자기 안에서 관절이 있는 자리(연결성 검사의 출발점). */
/* fail = 이만큼 아래로 재료가 줄면 남은 것도 매달려 있을 이유가 없다.
   격자만으로 두면 가장자리 몇 칸이 끝까지 살아남아 "머리 1/58" 같은 상태가
   된다 — 사실상 없어진 건데 0 이 아니라서 판정이 안 걸린다. */
/* jx,jy = 그릴 때의 회전축이자 부모에 붙는 점. 이 점이 pjx,pjy 위에 얹힌다.
   sy    = 연결성 검사의 출발 줄. 몸통만 다르다 — 몸통은 어디에도 매달려 있지
           않으므로 한가운데(척추)에서 뻗어나가야 한다. 예전에 이 둘을 같은
           값으로 묶었더니 몸통이 (7,9)만큼 밀려 그려져서 배가 다리와 떨어져
           보였다. */
/* snap = 한 줄에 이만큼 이하만 남으면 그 줄이 끊어진다. 팔다리는 폭이
   5~6칸이라 한두 칸으로 매달리는 상태가 자주 생기는데, 연결 성분만으로는
   "이어져 있음"이라 안 떨어졌다 — 그게 "너무 안 잘린다"의 정체다.
   fail 도 함께 올렸다: 3분의 1 남은 팔은 더 붙어 있을 이유가 없다. */
/* pn* = 엎드렸을 때의 부착 자리. 옆으로 눕히는(회전) 대신 배치를 바꾼다 —
   카메라 쪽으로 엎드리면 머리가 제일 앞(화면 아래), 다리 그루터기가 뒤(위)로
   가고, 몸 전체가 세로로 납작해진다. 회전으로 눕히면 옆구리를 보이며
   미끄러지는 그림이 된다. */
const SPECS = [
  {key:'legL', w:6,  h:17, r:2, jx:3, jy:1, sy:1, pjx:4,  pjy:18, pnx:3,  pny:1,  sag: 0.5,  z:0, boned:true,  fail:0.34, snap:2},
  {key:'legR', w:6,  h:17, r:2, jx:3, jy:1, sy:1, pjx:10, pjy:18, pnx:11, pny:1,  sag:-0.5,  z:0, boned:true,  fail:0.34, snap:2},
  {key:'torso',w:15, h:19, r:5, jx:0, jy:0, sy:9, pjx:0,  pjy:0,  pnx:0,  pny:5,  sag: 0,    z:1, boned:true,  fail:0,    snap:0},
  {key:'head', w:9,  h:10, r:4, jx:4, jy:9, sy:9, pjx:7,  pjy:0,  pnx:7,  pny:22, sag: 0.45, z:2, boned:false, fail:0.22, snap:0, eyes:true},
  {key:'armL', w:5,  h:17, r:2, jx:2, jy:1, sy:1, pjx:0,  pjy:4,  pnx:-2, pny:14, sag: 0.95, z:3, boned:true,  fail:0.34, snap:2},
  {key:'armR', w:5,  h:17, r:2, jx:2, jy:1, sy:1, pjx:14, pjy:4,  pnx:16, pny:14, sag:-0.95, z:3, boned:true,  fail:0.34, snap:2},
];
const FOOT = 34;                          // 몸통 좌표계에서 발바닥 y
const HEADI = 3, TORSOI = 2;

/* ── 좀비 종류 ───────────────────────────────────────────────── */
const TYPES = {
  walker: {sz:1.00, spd:0.44, tough:1.00, hit:14, cash:3,
           col:{cloth:[[0x46,0x54,0x3a],[0x2b,0x36,0x24]], skin:[[0xb4,0xbb,0x94],[0x84,0x8c,0x69]],
                sleeve:[[0x39,0x45,0x30],[0x22,0x2b,0x1d]],
                trous:[[0x3a,0x40,0x54],[0x22,0x27,0x35]]}},
  runner: {sz:0.88, spd:0.96, tough:0.85, hit:10, cash:5,
           col:{cloth:[[0x5c,0x3a,0x36],[0x3b,0x24,0x22]], skin:[[0xbc,0xa9,0x88],[0x8a,0x7b,0x62]],
                sleeve:[[0x4c,0x30,0x2d],[0x30,0x1e,0x1c]],
                trous:[[0x42,0x33,0x3a],[0x28,0x1e,0x23]]}},
  brute:  {sz:1.34, spd:0.30, tough:1.85, hit:34, cash:16,
           col:{cloth:[[0x4a,0x44,0x5c],[0x2e,0x2a,0x3b]], skin:[[0xa6,0xad,0x9f],[0x78,0x7e,0x72]],
                sleeve:[[0x3d,0x38,0x4c],[0x25,0x22,0x30]],
                trous:[[0x30,0x33,0x3e],[0x1c,0x1e,0x25]]}},
};
/* 팔을 소매(어두운 천)로 두면 살색이 머리 하나만 남아 실루엣이 또렷해진다 —
   전부 살색이면 떼로 몰려왔을 때 머리와 팔이 뭉쳐 덩어리로 보인다. */
const PART_PAL = {legL:'trous', legR:'trous', torso:'cloth', head:'skin', armL:'sleeve', armR:'sleeve'};

/* ══════════════════════════════════════════════════════════════ */
export function boot(canvas, hud){
  canvas.width = W; canvas.height = H;
  const R = createGL(canvas);

  /* ── 기본 스프라이트를 아틀라스에 한 번만 굽는다 ─────────────
     안 다친 부위는 전부 이 칸을 같이 쓴다. 다치는 순간에만 자기 칸을 얻는다. */
  const BASE = {};                              // BASE[type][partKey] = {uv, mask}
  const scratch = new Uint8Array(18*22*4);
  for(const [tk, T] of Object.entries(TYPES)){
    BASE[tk] = {};
    for(const s of SPECS){
      const mask = materialize(s.w, s.h, s.r, s.boned);
      if(s.eyes) stampEyes(mask, s.w, s.h);
      const slot = R.alloc(s.w, s.h);
      R.upload(slot, bakeRGBA(mask, s.w, s.h, T.col[PART_PAL[s.key]], scratch), s.w, s.h);
      let orig = 0;
      for(let i=0;i<mask.length;i++) if(mask[i]) orig++;
      BASE[tk][s.key] = {uv: R.sub(slot, s.w, s.h), mask, orig};
    }
  }

  /* ── 배경 조각들 ───────────────────────────────────────────── */
  function bakeMask(mask, w, h, colFn){
    const slot = R.alloc(w, h);
    const buf = new Uint8Array(w*h*4);
    for(let i=0;i<w*h;i++){
      if(!mask[i]) continue;
      const c = colFn(i % w, (i / w) | 0);
      buf[i*4]=c[0]; buf[i*4+1]=c[1]; buf[i*4+2]=c[2]; buf[i*4+3]=255;
    }
    R.upload(slot, buf, w, h);
    return R.sub(slot, w, h);
  }
  // 달
  const MOON_R = 9, moonMask = rrect(MOON_R*2, MOON_R*2, MOON_R);
  const MOON = bakeMask(moonMask, MOON_R*2, MOON_R*2,
    (x,y)=> (x+y) % 7 === 0 ? [0xc8,0xcc,0xc2] : [0xdc,0xdf,0xd4]);
  // 능선 두 겹
  function ridge(h, amp, base, col, seed){
    const m = new Uint8Array(W*h);
    let r = seed;
    const rnd = ()=> (r = (r*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pts = [];
    for(let x=0;x<W;x++){
      if(x % 24 === 0) pts.push(base + (rnd()-0.5)*amp*2);
      const a = pts[pts.length-1] ?? base;
      const b = (x % 24 === 0) ? a : a;
      pts.push(b);
    }
    let cur = base, target = base, t = 0;
    for(let x=0;x<W;x++){
      if(x % 19 === 0){ cur = target; target = base + (rnd()-0.5)*amp*2; t = 0; }
      t += 1/19;
      const y0 = Math.max(0, Math.round(cur + (target-cur)*t));
      for(let y=y0;y<h;y++) m[y*W+x] = 1;
    }
    return bakeMask(m, W, h, ()=> col);
  }
  const RIDGE_FAR  = ridge(28, 9,  8,  [0x1b,0x20,0x2c], 7);
  const RIDGE_NEAR = ridge(22, 6,  8,  [0x15,0x19,0x22], 99);
  // 모래주머니
  const SB_W = 13, SB_H = 7;
  const SAND = bakeMask(rrect(SB_W, SB_H, 3), SB_W, SB_H, (x,y)=>{
    if(y === 0) return [0x8a,0x7a,0x56];
    if(y >= SB_H-2) return [0x4a,0x3f,0x2c];
    return ((x+y*3) % 11 === 0) ? [0x6e,0x60,0x42] : [0x77,0x68,0x48];
  });
  // 말뚝
  const POST = bakeMask(new Uint8Array(3*20).fill(1), 3, 20,
    (x)=> x === 0 ? [0x4b,0x46,0x3c] : (x === 2 ? [0x24,0x21,0x1b] : [0x39,0x35,0x2c]));

  /* ── 총 — 뒤에서 본 1인칭 뷰모델 ──────────────────────────────
     예전에는 측면 실루엣을 조준점 쪽으로 회전만 시켰다. 그래서 총을
     옆이나 위에서 내려다보는 그림이 됐다. 1인칭은 **총을 뒤에서 보는**
     것이므로, 총구 쪽이 좁고 개머리 쪽이 넓은 사다리꼴이어야 한다.
     좌우 폭이 아래로 갈수록 넓어지는 것만으로 원근이 읽힌다.
     여기에 총을 쥔 두 손을 얹으면 "내 손에 들려 있다"가 완성된다. */
  const GUN_W = 72, GUN_H = 126, GUN_S = 1.0;
  const G_BAR = 1, G_MET = 2, G_LIT = 3, G_WD = 4, G_WDL = 5, G_HND = 6, G_HNL = 7,
        G_SLV = 8, G_SKN = 9;
  const GUN_C = {
    1:[0x3a,0x38,0x33], 2:[0x5e,0x5a,0x51], 3:[0x9a,0x94,0x86],
    4:[0x59,0x40,0x25], 5:[0x81,0x5f,0x36], 6:[0x7c,0x68,0x50], 7:[0xa4,0x8c,0x6c],
    8:[0x3c,0x44,0x33], 9:[0x8a,0x74,0x59],
  };
  const GUN = (()=>{
    const m = new Uint8Array(GUN_W*GUN_H), CX = 36;
    const put = (x,y,v)=>{ if(x>=0&&y>=0&&x<GUN_W&&y<GUN_H) m[y*GUN_W+x] = v; };
    /* 사다리꼴 — 위(먼 쪽)가 좁고 아래(가까운 쪽)가 넓다 */
    const taper = (y0,y1,w0,w1,v,dx)=>{
      for(let y=y0;y<=y1;y++){
        const t = (y-y0)/Math.max(1,y1-y0), hw = (w0 + (w1-w0)*t)/2;
        const cx = CX + (dx||0)*t;
        for(let x=Math.round(cx-hw); x<=Math.round(cx+hw); x++) put(x,y,v);
      }
    };
    const blob = (cx,cy,rw,rh,v)=>{
      for(let y=cy-rh;y<=cy+rh;y++) for(let x=cx-rw;x<=cx+rw;x++){
        const u=(x-cx)/rw, w=(y-cy)/rh;
        if(u*u+w*w <= 1.04) put(x,y,v);
      }
    };
    taper(0,   3,  11,11,  G_MET);        // 총구 장치
    taper(4,  34,   7,11,  G_BAR);        // 총열 — 멀어서 가늘다
    taper(14, 17,  18,18,  G_MET);        // 가늠쇠
    taper(35, 56,  18,27,  G_WD);         // 핸드가드
    taper(37, 54,  10,16,  G_WDL);
    taper(57, 78,  29,38,  G_MET);        // 리시버
    taper(60, 75,  18,25,  G_LIT);
    taper(79,101,  40,54,  G_WD);         // 개머리
    taper(81,99,   26,38,  G_WDL);
    taper(102,125, 46,58,  G_SLV);        // 소매 — 화면 밖으로 이어지는 팔뚝
    taper(104,124, 30,42,  G_SKN);
    blob(CX-2, 47, 19, 9, G_HND);         // 왼손 — 핸드가드를 감싼다
    blob(CX-2, 45, 14, 6, G_HNL);
    blob(CX+3, 78, 17, 9, G_HND);         // 오른손 — 손잡이를 쥔다
    blob(CX+3, 76, 12, 6, G_HNL);
    return bakeMask(m, GUN_W, GUN_H, (x,y)=> GUN_C[m[y*GUN_W+x]]);
  })();

  /* ── 상태 ───────────────────────────────────────────────────── */
  const S = {
    zombies: [], gibs: [], debris: [], tracers: [], shells: [], hits: [], shotN: 0,
    wave: 0, queue: 0, spawnT: 0, kills: 0, cash: 0,
    bar: 100, barMax: 100, over: false,
    ammo: 24, mag: 24, reloadT: 0, cool: 0, flash: 0,
    /* 반동은 셋으로 나눈다 —
       recoil : 총 자체가 뒤로 밀렸다 돌아오는 것
       kick   : 화면이 위로 튀는 것 (한 발마다)
       climb  : 연사를 이어가면 총구가 실제로 들리는 것 (조준점을 밀어올린다) */
    recoil: 0, kick: 0, climb: 0,
    aim: {x: W/2, y: 130}, down: false, t: 0, shake: 0,
  };

  /* ── 좀비 ───────────────────────────────────────────────────── */
  function makeZombie(typeKey){
    const T = TYPES[typeKey];
    const parts = SPECS.map(s=>({
      spec: s, type: typeKey,
      mask: BASE[typeKey][s.key].mask,       // 다치기 전엔 기본 격자를 같이 쓴다
      own: false, slot: null, uv: BASE[typeKey][s.key].uv,
      orig: BASE[typeKey][s.key].orig, alive: BASE[typeKey][s.key].orig,
      ang: 0, detached: false, dirty: false,
    }));
    return {
      type: typeKey, T, parts,
      d: D_SPAWN + Math.random()*1.6,
      wx: (Math.random()*2-1) * FUNNEL,
      sz: T.sz * (0.92 + Math.random()*0.16),
      ph: Math.random()*6.28, crawl: false, dead: false,
      hitT: 0.5, melee: false,
      leanT: 0, limp: 0,          // 쓰러진 정도 / 절뚝이는 정도
    };
  }
  /* 다치는 순간에만 자기 격자와 자기 아틀라스 칸을 갖는다 */
  function makeOwn(p){
    if(p.own) return;
    p.mask = Uint8Array.from(p.mask);
    p.slot = R.allocDyn();
    p.own = true;
    p.uv = R.sub(p.slot, p.spec.w, p.spec.h);
    p.dirty = true;
  }
  function repaint(p){
    if(!p.dirty || !p.own) return;
    const s = p.spec;
    R.upload(p.slot, bakeRGBA(p.mask, s.w, s.h, TYPES[p.type].col[PART_PAL[s.key]], scratch), s.w, s.h);
    p.dirty = false;
  }
  function releaseZombie(z){
    for(const p of z.parts) if(p.slot){ R.freeDyn(p.slot); p.slot = null; }
  }

  /* 몸통 원점(화면) — 부위 좌표는 전부 여기서 출발한다.

     다리를 잃으면 몸이 실제로 무너진다. 강체 물리를 돌리는 게 아니라
     "받쳐주는 다리가 얼마나 남았나"를 하나의 값(leanT)으로 두고,
     몸 전체를 엉덩이 축으로 눕히면서 그만큼 바닥으로 내린다.
     떨어지는 데 시간이 걸리므로 무너지는 게 눈에 보인다. */
  const HIPX = 7.5, HIPY = 19;              // 회전축 = 엉덩이 (몸통 좌표계)
  /* 기어가는 주기 — 팔을 뻗어 당길 때마다 몸이 한 번씩 앞으로 쏠린다.
     이동 속도도 같은 주기로 맥동해서, 미끄러지는 게 아니라 끌고 오는 것으로 보인다. */
  const crawlCycle = z => Math.sin(z.ph*1.7);
  const PRONE_BOTTOM = 23;                  // 엎드렸을 때 몸의 제일 아래(머리 끝)
  function torsoOrigin(z){
    const t = z.leanT;
    const s = projS(z.d) * z.sz;
    const sy = s * (1 - 0.56*t);            // 카메라 쪽으로 엎드리면 세로로 납작해진다
    const cx = projX(z.wx, z.d);
    const fy = projY(z.d);
    const bottom = FOOT + (PRONE_BOTTOM - FOOT)*t;
    const heave = t > 0.4 ? Math.max(0, crawlCycle(z)) * 2.2 * t : 0;   // 당길 때 앞으로 쏠린다
    return {x: cx - HIPX*s, y: fy - bottom*sy + heave*sy, s, sy, t};
  }
  /* 부위가 붙는 자리 — 서 있을 때와 엎드렸을 때 사이를 오간다 */
  function partAnchor(z, p, o){
    const sp = p.spec, t = o.t;
    const ax = sp.pjx + (sp.pnx - sp.pjx)*t;
    const ay = sp.pjy + (sp.pny - sp.pjy)*t;
    return {x: o.x + ax*o.s, y: o.y + ay*o.sy};
  }
  const partRot = (p, o)=> p.ang;

  /* ── 사격 ───────────────────────────────────────────────────── */
  /* 파내는 반경. 몸통이 245칸이라 한 발에 15칸쯤 없어져야 십수 발에 무너진다.
     구멍이 뚫린 자리는 총알이 그대로 통과하므로, 이미 판 자리를 계속 쏘는 건
     낭비가 된다 — 옆으로 옮겨가며 새 살을 파야 빨리 죽는다. */
  const CAL = {r: 3.1};
  function fire(){
    if(S.over || S.cool > 0 || S.reloadT > 0) return;
    if(S.ammo <= 0){ reload(); return; }
    S.ammo--; S.cool = 0.085; S.recoil = 1; S.flash = 1;
    S.kick  = Math.min(7, S.kick + 3.4);              // 화면이 위로 튄다
    S.climb = Math.min(1, S.climb + 0.20);            // 연사를 이어갈수록 총구가 들린다

    const mx = S.aim.x, my = S.aim.y;
    const gm = muzzle();
    // 탄피 — 오른쪽으로 튄다
    if(S.shells.length < 40) S.shells.push({
      x: gm.ox + 6, y: gm.oy - 26,
      vx: 34 + Math.random()*30, vy: -46 - Math.random()*34, life: 1.1,
    });
    /* 총구 상승 — 조준점을 실제로 밀어올린다. 연사를 길게 물면 손으로
       눌러 내려야 한다. 이게 없으면 아무리 흔들어도 "쏘는 느낌"이 안 난다. */
    S.aim.y = Math.max(HORIZON + 4, S.aim.y - (0.55 + S.climb*1.5));
    /* 실총은 탄자가 안 보인다. 예광탄도 보통 네댓 발에 한 발만 섞여 있다.
       매 발 그리면 초당 12줄이라 무슨 짓을 해도 레이저로 읽힌다.
       보이는 건 총구 화염과 **맞은 자리**여야 한다. */
    S.shotN = (S.shotN|0) + 1;
    if(S.shotN % 4 === 0){
      const FLY = 0.075;
      S.tracers.push({x: gm.x, y: gm.y, vx: (mx-gm.x)/FLY, vy: (my-gm.y)/FLY, life: FLY});
    }

    // 가까운 놈부터 본다
    const cands = S.zombies.filter(z=>!z.dead).sort((a,b)=> a.d - b.d);
    for(const z of cands){
      const o = torsoOrigin(z);
      const order = [...z.parts].sort((a,b)=> b.spec.z - a.spec.z);
      for(const p of order){
        if(p.detached || p.alive <= 0) continue;
        const an = partAnchor(z, p, o);
        const rot = partRot(p, o);
        const dx = mx - an.x, dy = (my - an.y) * (o.s / o.sy);   // 납작해진 만큼 되돌린다
        const c = Math.cos(-rot), sn = Math.sin(-rot);
        const lx = (dx*c - dy*sn) / o.s + p.spec.jx;
        const ly = (dx*sn + dy*c) / o.s + p.spec.jy;
        const ix = Math.round(lx), iy = Math.round(ly);
        if(ix<0||iy<0||ix>=p.spec.w||iy>=p.spec.h) continue;
        if(!solidNear(p, ix, iy)) continue;        // 뚫린 구멍으로는 그대로 지나간다
        S.hits.push({x: mx, y: my, life: 1});      // 착탄 섬광
        hitPart(z, p, lx, ly, o);
        return;
      }
    }
    // 아무것도 못 맞히면 흙먼지
    if(my > HORIZON) for(let i=0;i<4;i++) puff(mx, my, [0x3a,0x32,0x28]);
  }

  /* 총알에도 굵기가 있다 — 겨눈 칸이 비었어도 그 언저리에 살이 남아 있으면
     스치고 지나간다. 한 칸만 보고 통과시키면, 격자로 구멍을 뚫어놓은 뒤
     그 사이에 낀 살이 영원히 안 없어진다(몸통이 59% 에서 멈춰버렸다).
     구멍이 3칸은 돼야 총알이 지나간다. */
  function solidNear(p, ix, iy){
    const {w, h} = p.spec;
    for(let y=iy-1; y<=iy+1; y++){
      if(y<0||y>=h) continue;
      for(let x=ix-1; x<=ix+1; x++){
        if(x<0||x>=w) continue;
        if(p.mask[y*w+x]) return true;
      }
    }
    return false;
  }

  function hitPart(z, p, lx, ly, o){
    makeOwn(p);
    const rad = CAL.r / Math.max(0.6, z.T.tough);
    const an = partAnchor(z, p, o);
    const rot = partRot(p, o);
    const c = Math.cos(rot), sn = Math.sin(rot);
    carve(p, lx, ly, rad, (x, y, m)=>{
      // 없어진 칸을 그 자리 색으로 날린다 — "부서졌다"는 이게 판다
      const px = (x - p.spec.jx) * o.s, py = (y - p.spec.jy) * o.sy;
      const wxs = an.x + px*c - py*sn, wys = an.y + px*sn + py*c;
      const col = m === 4 ? [0xd8,0xd1,0xb6] : (m >= 3 ? [0x7c,0x21,0x1d]
                : TYPES[z.type].col[PART_PAL[p.spec.key]][0]);
      puff(wxs, wys, col, 1.4);
    });
    settle(p, cells=>{
      const cut = cutout(p, cells);
      spawnGib(z, p, cut, o);
    });
    // 재료가 임계 아래로 내려가면 남은 것도 떨어진다
    if(p.spec.fail && p.alive > 0 && p.alive < p.orig * p.spec.fail) shedAll(z, p, o);
    repaint(p);

    /* 몸통을 팠으면 거기 붙어 있던 것들이 아직 붙어 있는지 다시 본다.
       배를 날려버렸는데 다리가 허공에 매달려 있으면 안 된다. */
    if(p === z.parts[TORSOI]) checkAttach(z, o);

    // 죽는 조건 — 머리가 날아가거나 몸통 재료가 절반 아래로 떨어지면
    const head = z.parts[HEADI], torso = z.parts[TORSOI];
    if(head.alive === 0 || torso.alive < torso.orig*0.55){ kill(z); return; }
  }

  /* 다리가 아직 바닥을 짚는가 — 아래쪽 네 줄에 재료가 남아 있는지만 본다 */
  function footed(p){
    if(p.detached || p.alive <= 0) return false;
    const {w, h} = p.spec;
    for(let y=h-4; y<h; y++)
      for(let x=0;x<w;x++) if(p.mask[y*w+x]) return true;
    return false;
  }

  /* 부모(몸통)의 부착 자리가 날아갔으면 자식도 떨어진다.
     이게 없으면 몸통 아래를 도려냈을 때 다리가 몸에서 떨어진 채
     허공에 서 있다 — "배랑 몸통이 분리"돼 보이던 게 이것이다. */
  function checkAttach(z, o){
    const torso = z.parts[TORSOI];
    for(let i=0;i<z.parts.length;i++){
      if(i === TORSOI) continue;
      const p = z.parts[i];
      if(p.detached || p.alive <= 0) continue;
      const ax = Math.max(0, Math.min(torso.spec.w-1, Math.round(p.spec.pjx)));
      const ay = Math.max(0, Math.min(torso.spec.h-1, Math.round(p.spec.pjy)));
      if(!solidNear(torso, ax, ay)) shedAll(z, p, o);
    }
  }

  /* 부위에 남은 것을 통째로 떨어뜨린다 */
  function shedAll(z, p, o){
    const cells = [];
    for(let i=0;i<p.mask.length;i++) if(p.mask[i]) cells.push(i);
    if(cells.length) spawnGib(z, p, cutout(p, cells), o);
    for(const k of cells) p.mask[k] = 0;
    p.alive = 0; p.detached = true; p.dirty = true;
  }

  function spawnGib(z, p, cut, o){
    if(S.gibs.length > 170){
      const old = S.gibs.shift();
      if(old.slot) R.freeDyn(old.slot);
    }
    const slot = R.allocDyn();
    R.upload(slot, bakeRGBA(cut.mask, cut.w, cut.h,
             TYPES[z.type].col[PART_PAL[p.spec.key]], scratch), cut.w, cut.h);
    const an = partAnchor(z, p, o);
    const c = Math.cos(p.ang), sn = Math.sin(p.ang);
    const px = (cut.ox - p.spec.jx) * o.s, py = (cut.oy - p.spec.jy) * o.sy;
    const f = Math.min(0.78, Math.max(0, (z.d - 1.4) / 7.4)), t = 1 - f*0.72;
    S.gibs.push({
      slot, uv: R.sub(slot, cut.w, cut.h), w: cut.w*o.s, h: cut.h*o.sy,
      x: an.x + px*c - py*sn, y: an.y + px*sn + py*c,
      vx: (Math.random()-0.5)*46, vy: -20 - Math.random()*34,
      ang: p.ang, va: (Math.random()-0.5)*6,
      gy: projY(z.d), d: z.d, tint: [t*0.96, t*0.98, t*1.06],
      rest: false, life: 1,
    });
  }

  function kill(z){
    if(z.dead) return;
    z.dead = true;
    S.kills++; S.cash += z.T.cash;
    const o = torsoOrigin(z);
    for(const p of z.parts){
      if(p.detached || p.alive <= 0) continue;
      makeOwn(p);
      const cells = [];
      for(let i=0;i<p.mask.length;i++) if(p.mask[i]) cells.push(i);
      if(cells.length) spawnGib(z, p, cutout(p, cells), o);
      for(const k of cells) p.mask[k] = 0;
      p.alive = 0; p.detached = true;
    }
    for(let i=0;i<24;i++) puff(projX(z.wx, z.d), projY(z.d) - 14*o.s, [0x7c,0x21,0x1d], 1.8);
    releaseZombie(z);
  }

  function puff(x, y, col, spd){
    if(S.debris.length > 900) return;
    const a = Math.random()*6.283, v = (10 + Math.random()*40) * (spd || 1);
    S.debris.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 18,
                   gy: y + 2 + Math.random()*6, c: col, life: 1, rest: false});
  }

  function reload(){
    if(S.reloadT > 0 || S.ammo >= S.mag) return;
    S.reloadT = 1.15;
  }
  /* 총은 시선에 붙어 있다. 조준점을 향해 통째로 돌리면 포탑처럼 보이므로,
     살짝 기울이기만 하고 옆으로 조금 흔들리게 둔다. 조준점을 따라가는 일은
     카메라가 한다 — 그게 1인칭이다. */
  /* 총은 오른쪽 아래 구석에서 대각선으로 올라온다 — 팔뚝이 화면 밖으로
     이어지는 그 구도가 1인칭을 만든다.
     그리고 총열이 실제로 조준점을 향한다. 살짝만 기울이던 때는 총알이
     총구에서 나오는데 총은 딴 데를 보고 있어서 "안 맞는다"로 읽혔다. */
  function gunPose(){
    const rec = S.recoil;
    const ox = W*0.70;
    const oy = H + 24 - rec*16;                       // 반동은 수직 — 위로 튄다
    const raw = Math.atan2(S.aim.x - ox, oy - S.aim.y);
    const ang = Math.max(-1.20, Math.min(0.22, raw));
    const len = (GUN_H - 26) * GUN_S;                 // 소매 길이는 총열이 아니다
    return {ox, oy, ang,
            x: ox + Math.sin(ang)*len, y: oy - Math.cos(ang)*len};
  }
  const muzzle = gunPose;

  /* ── 웨이브 ─────────────────────────────────────────────────── */
  function nextWave(){
    S.wave++;
    S.queue = Math.round(16 + S.wave*9 + S.wave*S.wave*0.7);
    S.spawnT = 0;
  }
  function pick(){
    const r = Math.random(), w = S.wave;
    if(w >= 4 && r < 0.10 + w*0.006) return 'brute';
    if(w >= 2 && r < 0.34) return 'runner';
    return 'walker';
  }

  /* ── 갱신 ───────────────────────────────────────────────────── */
  function update(dt){
    S.t += dt;
    S.recoil = Math.max(0, S.recoil - dt*9);
    S.flash  = Math.max(0, S.flash - dt*16);
    S.shake  = Math.max(0, S.shake - dt*5);
    S.kick  += (0 - S.kick)  * Math.min(1, dt*13);    // 튀었다가 제자리로
    S.climb += (0 - S.climb) * Math.min(1, dt*2.6);   // 손을 떼면 천천히 가라앉는다
    for(const s of S.shells){ s.vy += 260*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.life -= dt; }
    S.shells = S.shells.filter(s=> s.life > 0);
    if(S.cool > 0) S.cool -= dt;
    if(S.reloadT > 0 && (S.reloadT -= dt) <= 0){ S.ammo = S.mag; S.reloadT = 0; }
    if(!S.over && S.down && S.cool <= 0) fire();

    // 스폰
    if(!S.over && S.queue > 0 && S.zombies.length < MAX_LIVE){
      S.spawnT -= dt;
      if(S.spawnT <= 0){
        S.spawnT = Math.max(0.045, 0.42 - S.wave*0.014);
        let burst = 1 + ((S.wave/4)|0);
        while(burst-- > 0 && S.queue > 0 && S.zombies.length < MAX_LIVE){
          S.zombies.push(makeZombie(pick())); S.queue--;
        }
      }
    }
    if(!S.over && S.queue === 0 && S.zombies.length === 0) nextWave();

    // 좀비
    for(const z of S.zombies){
      if(z.dead) continue;

      /* 받쳐주는 다리가 몇인지 — 이게 자세와 속도를 함께 정한다.
         "재료가 남았는가"가 아니라 "발이 남았는가"로 센다. 무릎 아래를
         끊으면 허벅지는 그대로 붙어 있어서, 남은 칸 수로 보면 멀쩡한 것으로
         읽힌다 — 실제로는 설 수 없는 몸이다. */
      const legs = (footed(z.parts[0]) ? 1 : 0) + (footed(z.parts[1]) ? 1 : 0);
      const want = legs === 0 ? 1 : 0;
      z.leanT += (want - z.leanT) * Math.min(1, dt*3.4);   // 넘어지는 데 시간이 걸린다
      if(z.leanT < 0.002) z.leanT = 0;
      z.limp = legs === 1 ? 1 : 0;
      z.crawl = z.leanT > 0.5;

      // 기어올 땐 팔을 당기는 순간에만 앞으로 나간다 — 미끄러지지 않는다
      const pull = z.crawl ? 0.35 + 1.3*Math.max(0, crawlCycle(z)) : 1;
      const spd = z.T.spd * (legs === 0 ? 0.34 : legs === 1 ? 0.62 : 1) * pull;
      z.ph += dt * (2 + z.T.spd*3);
      if(z.d > D_MELEE){
        z.d -= spd * dt;
        z.wx += Math.sin(S.t*1.1 + z.ph)*dt*0.10;
        z.wx = Math.max(-FUNNEL, Math.min(FUNNEL, z.wx));
        if(z.d <= D_MELEE){ z.d = D_MELEE; z.melee = true; z.hitT = 0.5; }
      }else{
        z.melee = true;
        if((z.hitT -= dt) <= 0){
          z.hitT = 1.1;
          // 팔이 둘 다 없으면 때리지 못한다 — 팔을 끊는 게 곧 방어다
          const arms = (z.parts[4].alive > 0 ? 1 : 0) + (z.parts[5].alive > 0 ? 1 : 0);
          if(arms > 0){
            S.bar -= z.T.hit * (arms === 2 ? 1 : 0.5);
            S.shake = Math.max(S.shake, 2.4);
            if(S.bar <= 0){ S.bar = 0; S.over = true; }
          }
        }
      }
    }
    S.zombies = S.zombies.filter(z=>!z.dead);

    // 조각 · 파편
    for(const gb of S.gibs){
      if(gb.rest) continue;
      gb.vy += 190*dt;
      gb.x += gb.vx*dt; gb.y += gb.vy*dt; gb.ang += gb.va*dt;
      if(gb.y + gb.h >= gb.gy){
        gb.y = gb.gy - gb.h; gb.rest = true;
        gb.ang = Math.round(gb.ang/(Math.PI/2))*(Math.PI/2);
        for(let i=0;i<5;i++) puff(gb.x + gb.w/2, gb.gy, [0x5d,0x16,0x13], 0.7);
      }
    }
    for(const p of S.debris){
      if(p.rest) continue;
      p.vy += 170*dt;
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.y >= p.gy){ p.y = p.gy; p.rest = true; }
    }
    if(S.debris.length > 900) S.debris.splice(0, S.debris.length - 900);
    for(const t of S.tracers){ t.x += t.vx*dt; t.y += t.vy*dt; t.life -= dt; }
    S.tracers = S.tracers.filter(t=> t.life > 0);
    for(const h of S.hits) h.life -= dt*9;
    S.hits = S.hits.filter(h=> h.life > 0);
  }

  /* ── 그리기 ─────────────────────────────────────────────────── */
  const SKY = [[0x0d,0x10,0x16],[0x11,0x14,0x1c],[0x15,0x19,0x22],[0x19,0x1e,0x28],
               [0x1d,0x23,0x2e],[0x21,0x27,0x33],[0x25,0x2b,0x37],[0x28,0x2f,0x3b]];
  const c255 = c => [c[0]/255, c[1]/255, c[2]/255];

  function draw(){
    R.begin(W, H);
    const sh = S.shake > 0.05 ? (Math.random()-0.5)*S.shake : 0;

    /* 카메라 — 조준을 따라 시선이 돌고, 쏘면 위로 튄다.
       월드에만 걸고 총·참호·HUD 에는 걸지 않는다. 그 차이가 시차가 되고,
       고개가 못에 박힌 채 총만 도는 그림에서 벗어난다. */
    R.setOffset(-(S.aim.x - W/2)*0.075 + sh, S.kick*0.9);

    // 하늘 — 띠로 나눠 칠한다. 도트에선 그라디언트보다 띠가 맞다
    const bandH = Math.ceil(HORIZON / SKY.length);
    for(let i=0;i<SKY.length;i++) R.rect(0, i*bandH, W, bandH+1, c255(SKY[i]));
    R.sprite(MOON, W-64, 16, MOON_R*2, MOON_R*2, [1,1,1]);
    R.sprite(RIDGE_FAR,  0, HORIZON-26, W, 28, [1,1,1]);
    R.sprite(RIDGE_NEAR, 0, HORIZON-12, W, 22, [1,1,1]);

    // 땅 — 가까울수록 밝게 띠로 나눈다. 포탄 자국으로 허전한 중간을 메운다
    R.rect(0, HORIZON, W, H-HORIZON, c255([0x2a,0x24,0x1d]));
    for(let i=0;i<9;i++){
      const d = 7.5 - i*0.8, y0 = projY(d), y1 = projY(Math.max(1.2, d-0.8));
      const k = 0.72 + i*0.035;
      R.rect(0, y0, W, Math.max(1, y1-y0), [0x2a/255*k, 0x24/255*k, 0x1d/255*k]);
    }
    for(let i=0;i<14;i++){
      const d = 1.9 + ((i*37) % 60)/10, s = projS(d);
      const cx = projX(((i*53) % 100 - 50)/13, d), cy = projY(d);
      const rw = Math.max(3, 18*s), rh = Math.max(1, 5*s);
      R.rect(cx-rw/2, cy-rh/2, rw, rh, c255([0x21,0x1c,0x16]));
      R.rect(cx-rw/2, cy-rh/2, rw, 1, c255([0x33,0x2c,0x22]));
    }
    // 말뚝 — 깊이감
    for(let i=0;i<12;i++){
      const d = 2.4 + (i%6)*0.9, s = projS(d);
      const x = projX((i<6? -1 : 1) * (FUNNEL + 0.55 + (i%3)*0.25), d);
      const t = 1 - Math.min(0.72, (d-1)/8);
      R.sprite(POST, x, projY(d)-20*s, 3*s, 20*s, [t*0.9, t*0.92, t]);
    }

    // 바닥 파편
    for(const p of S.debris){
      const a = p.rest ? 1 : p.life;
      R.rect(p.x, p.y, 1, 1, [...c255(p.c), a]);
    }
    /* 좀비와 떨어진 조각을 한 깊이 목록으로 묶는다 — 따로 그리면 시체가
       살아있는 놈들 뒤로 숨어서 학살한 흔적이 화면에 안 남는다 */
    const scene = [];
    for(const z of S.zombies) scene.push({d: z.d, z});
    for(const gb of S.gibs)   scene.push({d: gb.d, gb});
    scene.sort((a,b)=> b.d - a.d);

    for(const it of scene){
      if(it.gb){
        const gb = it.gb;
        R.spriteRot(gb.uv, gb.x, gb.y, gb.w, gb.h, gb.ang, 0, 0, gb.tint);
        continue;
      }
      const z = it.z;
      const o = torsoOrigin(z);
      // 거리 안개는 텍스처가 아니라 정점 색으로 — 기본 스프라이트 한 장을 계속 쓴다
      const f = Math.min(0.78, Math.max(0, (z.d - 1.4) / 7.4));
      const t = 1 - f*0.72;
      const tint = [t*0.96, t*0.98, t*1.06];
      // 다리 하나로 절뚝일 땐 위아래로 더 크게 흔들린다
      const up = 1 - z.leanT;
      const bob = up * Math.sin(z.ph) * (0.9 + z.limp*1.7) * o.s;
      for(const p of [...z.parts].sort((a,b)=> a.spec.z - b.spec.z)){
        if(p.detached || p.alive <= 0) continue;
        const an = partAnchor(z, p, o);
        const sp = p.spec;
        let swing = sp.key.startsWith('leg')
          ? Math.sin(z.ph + (sp.key === 'legL' ? 0 : 3.14)) * 0.18 * up : 0;
        /* 엎드리면 팔이 걷는 팔이 아니라 끌어당기는 팔이 된다 —
           앞으로 뻗었다가 몸쪽으로 당기는 왕복. 좌우가 엇갈린다. */
        /* 엎드리면 팔이 걷는 팔이 아니라 바닥을 짚어 끌어당기는 팔이 된다 —
           앞(화면 아래)으로 뻗었다가 몸쪽으로 당기는 왕복. 좌우가 엇갈린다. */
        if(z.leanT > 0.2 && sp.key.startsWith('arm')){
          const side = sp.key === 'armL' ? -1 : 1;
          const ph = z.ph*1.7 + (side < 0 ? 0 : 3.14);
          swing = -p.ang + side * (0.55 + Math.sin(ph)*0.62) * z.leanT;
        }
        R.spriteRot(p.uv, an.x, an.y + bob, sp.w*o.s, sp.h*o.sy,
                    partRot(p, o) + swing, sp.jx*o.s, sp.jy*o.sy, tint);
      }
    }

    // 예광탄 — 네 발에 한 발. 가늘고 어둡게, 꼬리만 남긴다
    for(const t of S.tracers){
      const tl = 0.020, n = 4;
      const dx = -t.vx*tl, dy = -t.vy*tl;
      for(let i=0;i<n;i++){
        const u = i/n;
        R.rect(t.x+dx*u, t.y+dy*u, 1, 1, [1, 0.80, 0.42, (0.55 - u*0.42) * (t.life/0.075)]);
      }
    }
    // 착탄 — 실제로 보여야 하는 건 맞은 자리다
    for(const h of S.hits){
      const a = h.life;
      R.rect(h.x-2, h.y-2, 4, 4, [1, 0.95, 0.78, a]);
      R.rect(h.x-4, h.y-1, 8, 2, [1, 0.78, 0.40, a*0.6]);
      R.rect(h.x-1, h.y-4, 2, 8, [1, 0.78, 0.40, a*0.6]);
    }

    R.setOffset(0, 0);                                // 여기부터는 시점에 붙은 것들

    // 참호 흉벽 — 화면 아래를 가로지르는 모래주머니
    const PY0 = H - 30;
    R.rect(0, PY0+4, W, H-PY0, c255([0x1a,0x16,0x12]));
    for(let row=0; row<3; row++){
      const y = PY0 + row*6;
      for(let x=-6; x<W+SB_W; x+=SB_W-1){
        const off = (row%2)*6 + ((x*7)%3);
        R.sprite(SAND, x+off, y, SB_W, SB_H, row === 0 ? [1,1,1] : [0.84,0.84,0.86]);
      }
    }

    // 탄피
    for(const s of S.shells)
      R.rect(s.x, s.y, 2, 1, [0.84, 0.68, 0.34, Math.min(1, s.life*2)]);

    // 총 — 시점에 붙어 있다. 개머리가 화면 아래 밖으로 나가야 1인칭으로 읽힌다
    const m = gunPose();
    const rl = S.reloadT > 0 ? Math.sin((1 - S.reloadT/1.15)*Math.PI) : 0;
    R.spriteRot(GUN, m.ox + sh, m.oy + rl*34, GUN_W*GUN_S, GUN_H*GUN_S,
                m.ang + rl*0.34, GUN_W*GUN_S/2, GUN_H*GUN_S, [1,1,1]);
    if(S.flash > 0.1){
      // 총구 화염 — 짧고 세게. 총열 축을 따라 앞으로 뻗는다
      /* 사각형 하나면 노란 블록으로 보인다. 총열 축을 따라 길게, 옆으로는
         짧게 — 별 모양으로 흩어야 "터졌다"로 읽힌다. */
      const f = S.flash, cs = Math.cos(m.ang), sn = Math.sin(m.ang);
      const P = (d, o)=> [m.x + sn*d + cs*o, m.y - cs*d + sn*o];
      const core = P(3, 0);
      R.rect(core[0]-2, core[1]-2, 4, 4, [1, 0.97, 0.82, f]);
      for(const [d, o, s] of [[9,0,3],[15,0,2],[6,-5,2],[6,5,2],[11,-4,1],[11,4,1]]){
        const p = P(d*f + 2, o*f);
        R.rect(p[0]-s, p[1]-s, s*2, s*2, [1, 0.84, 0.42, f*0.8]);
      }
      // 총구가 광원이 된다 — 참호 앞이 한 프레임 밝아진다
      R.rect(0, HORIZON, W, H-HORIZON, [1, 0.72, 0.34, f*0.07]);
    }

    // 조준선
    const a = S.aim;
    const cc = [0.86, 0.33, 0.24, 1];
    R.rect(a.x-4, a.y, 3, 1, cc); R.rect(a.x+2, a.y, 3, 1, cc);
    R.rect(a.x, a.y-4, 1, 3, cc); R.rect(a.x, a.y+2, 1, 3, cc);

    // 피격 비네트
    if(S.bar < S.barMax*0.4){
      const k = 1 - S.bar/(S.barMax*0.4);
      R.rect(0, 0, W, 3, [0.7,0.1,0.08, k*0.5]);
      R.rect(0, H-3, W, 3, [0.7,0.1,0.08, k*0.5]);
      R.rect(0, 0, 3, H, [0.7,0.1,0.08, k*0.5]);
      R.rect(W-3, 0, 3, H, [0.7,0.1,0.08, k*0.5]);
    }
    R.flush();
  }

  function drawHud(){
    if(!hud) return;
    const bar = Math.max(0, Math.round(S.bar));
    hud.innerHTML =
      `<div class="row"><span class="k">웨이브</span><b>${S.wave}</b>`
      + `<span class="k">처치</span><b>${S.kills}</b>`
      + `<span class="k">자금</span><b>₩${S.cash}</b></div>`
      + `<div class="row"><span class="k">참호</span>`
      + `<span class="gauge"><i style="width:${bar}%;background:${bar<35?'#d8543e':'#c8a24a'}"></i></span>`
      + `<span class="k">탄</span><b>${S.reloadT>0 ? '재장전' : S.ammo + ' / ' + S.mag}</b>`
      + `<span class="k">화면</span><b>${S.zombies.length}</b></div>`
      + (S.over ? `<div class="over">참호 함락 — 클릭해서 다시</div>` : '');
  }

  /* ── 입력 ───────────────────────────────────────────────────── */
  function toLocal(e){
    const r = canvas.getBoundingClientRect();
    S.aim.x = (e.clientX - r.left) / (r.width / W);
    S.aim.y = (e.clientY - r.top)  / (r.height / H);
  }
  canvas.addEventListener('mousemove', toLocal);
  canvas.addEventListener('mousedown', e=>{
    toLocal(e);
    if(S.over){ restart(); return; }
    S.down = true;
  });
  addEventListener('mouseup', ()=> S.down = false);
  addEventListener('keydown', e=>{
    const k = e.key.toLowerCase();
    if(k === 'r') reload();
    if(k === 'p') restart();
  });

  function restart(){
    for(const z of S.zombies) releaseZombie(z);
    for(const gb of S.gibs) if(gb.slot) R.freeDyn(gb.slot);
    S.zombies = []; S.gibs = []; S.debris = []; S.tracers = []; S.shells = [];
    S.wave = 0; S.queue = 0; S.kills = 0; S.cash = 0;
    S.bar = S.barMax; S.over = false; S.ammo = S.mag; S.reloadT = 0;
    S.kick = 0; S.climb = 0; S.recoil = 0;
    nextWave();
  }

  nextWave();
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000); last = now;
    update(dt); draw(); drawHud();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ── 헤드리스 확인용 ────────────────────────────────────────── */
  return {
    S, update, draw, drawHud, fire, restart,
    step(n){ for(let i=0;i<n;i++) update(1/60); },
    aimAt(x,y){ S.aim.x = x; S.aim.y = y; },
    // 헤드리스 확인용 — 탄창·연사 간격을 무시하고 한 발씩 확실히 쏜다
    shoot(x,y,n){ for(let i=0;i<n;i++){ S.aim.x=x; S.aim.y=y;
      S.cool=0; S.reloadT=0; S.ammo=S.mag; fire(); } },
    png(){ draw(); return canvas.toDataURL('image/png'); },
    /* 가까운 놈부터 화면상 몸통·팔 좌표를 돌려준다 (헤드리스 조준용) */
    targets(n){
      return S.zombies.filter(z=>!z.dead).sort((a,b)=> a.d-b.d).slice(0, n||8).map(z=>{
        const o = torsoOrigin(z);
        return {d:+z.d.toFixed(2), s:+o.s.toFixed(2),
                torso:[Math.round(o.x+7.5*o.s), Math.round(o.y+9*o.s)],
                head: [Math.round(o.x+7.5*o.s), Math.round(o.y-4*o.s)],
                armL: [Math.round(o.x-0.5*o.s), Math.round(o.y+12*o.s)],
                armR: [Math.round(o.x+15.5*o.s), Math.round(o.y+12*o.s)],
                legL: [Math.round(o.x+4*o.s),    Math.round(o.y+25*o.s)],
                legR: [Math.round(o.x+10*o.s),   Math.round(o.y+25*o.s)]};
      });
    },
    stat(){ return {웨이브:S.wave, 화면:S.zombies.length, 처치:S.kills,
                    조각:S.gibs.length, 파편:S.debris.length, 참호:Math.round(S.bar)}; },
  };
}
