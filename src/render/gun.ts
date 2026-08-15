import { ctx } from '../canvas';
import { gunTier } from '../data/branches';
import { BARREL, legacyGunAim as gunAim } from '../sim/aim';
import { g } from '../state';

function poly(pts: number[][]){
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
/* ── 총 ────────────────────────────────────────────────────
   로컬 좌표: 원점이 어깨쪽 회전축, -y 가 총구 방향. 총구는 (0,-BARREL) 로
   고정이라 예광탄·화염과 절대 어긋나지 않는다.
   부품을 실제 소총 순서대로 쌓는다 — 개머리판 / 손잡이 / 방아쇠울 / 리시버 /
   탄창 / 핸드가드 / 가스블록 / 총열 / 총구장치 / 가늠쇠.
   반동은 노리쇠와 장전손잡이가 뒤로 왕복하고, 재장전은 탄창이 실제로 빠진다.
   ─────────────────────────────────────────────────────── */
/* 단계별 재질. 참호 바닥이 워낙 어두워서 최하단 값을 너무 낮추면 총이 묻힌다 —
   가장 어두운 톤도 #1e 이상으로 유지한다. */
/* 0 제식(목재+청강) → 1 개조 → 2 본격 → 3 중화기 → 4 최종.
   연사 계열은 황동·주황 쪽으로, 관통 계열은 강청색 쪽으로 갈린다. */
const GUN_MAT_BASE =
  {wood:['#8a6737','#634624','#3a2915'], body:['#6a6154','#4c463b','#2e2924'],
   metal:['#8f867a','#665f56','#3d3833'], grip:'#332714', tint:'#a37c40'};
const GUN_MAT = {
  rate: [
    GUN_MAT_BASE,
    {wood:['#6b5a3c','#4c4029','#2c251a'], body:['#635a4a','#463f33','#292419'],
     metal:['#9d907c','#726858','#443e34'], grip:'#2e2618', tint:'#c08f3c'},
    {wood:['#5e5340','#42392b','#26211a'], body:['#5c5343','#403a2e','#25211a'],
     metal:['#b0a184','#80745e','#4b4335'], grip:'#2a2318', tint:'#d4a03f'},
    {wood:['#4e4636','#373125','#201c15'], body:['#514a3c','#39332a','#211d17'],
     metal:['#c2ae86','#8d7f60','#524936'], grip:'#241f16', tint:'#e0b23f'},
    {wood:['#453e30','#302b21','#1c1913'], body:['#4a4335','#342f26','#1f1b15'],
     metal:['#d8bf8c','#a08f66','#5c5138'], grip:'#201c14', tint:'#f0c94a'},
  ],
  pierce: [
    GUN_MAT_BASE,
    {wood:['#525a5c','#3a4042','#232729'], body:['#565e60','#3d4345','#242829'],
     metal:['#8e989c','#677073','#3c4244'], grip:'#272d2f', tint:'#8fa6ae'},
    {wood:['#48545a','#333d42','#1f272a'], body:['#49545d','#333c43','#1e2226'],
     metal:['#98a1a6','#6c757a','#3d4346'], grip:'#252d31', tint:'#84a0ae'},
    {wood:['#3d4a54','#2b343c','#191f24'], body:['#3f4a55','#2c343d','#191d22'],
     metal:['#9fb0ba','#71808a','#404a52'], grip:'#212930', tint:'#7fb4c8'},
    {wood:['#38424f','#272e38','#171b21'], body:['#3a4350','#292f39','#171b20'],
     metal:['#a8bccc','#788896','#424c56'], grip:'#1e252c', tint:'#a5d4e8'},
  ],
};
/* 세로로 세운 원통 느낌 — 왼쪽 모서리가 밝고 가운데가 몸통색, 오른쪽이 그늘.
   어두운 외곽선을 같이 두른다. 참호 바닥이 총 색과 비슷해서 선이 없으면
   총의 절반이 배경에 묻혀 사라진다. */
function tube(x: number, y: number, w: number, h: number, cols: string[], r?: number){
  const grd = ctx.createLinearGradient(x, 0, x + w, 0);
  grd.addColorStop(0,    cols[0]);
  grd.addColorStop(0.34, cols[1]);
  grd.addColorStop(1,    cols[2]);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r == null ? 3 : r);
  ctx.fillStyle = grd; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
}
function screw(x: number, y: number, r: number, col?: string){
  ctx.fillStyle = col || '#1a1814';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = Math.max(0.6, r*0.28);
  ctx.beginPath(); ctx.moveTo(x - r*0.6, y); ctx.lineTo(x + r*0.6, y); ctx.stroke();
}

export function drawLegacyGun(){
  const aim = gunAim();
  const T   = g ? gunTier(g.gunUps) : 0;             // 0~4 단계
  const BR  = g && g.branch ? g.branch : 'rate';     // 계열 미선택이면 기본 도색
  const M   = GUN_MAT[BR][T];
  const isRate = BR === 'rate';
  const rec = g ? g.recoil : 0;
  const rl  = aim.rl;
  // 재장전 앞절반에 탄창이 빠지고 뒤절반에 새 탄창이 올라온다
  const magT   = rl > 0.02 ? Math.min(1, rl*1.5) : 0;
  const bolt   = rec * 24;                           // 노리쇠 후퇴량

  ctx.save();
  ctx.translate(aim.ox, aim.oy);
  ctx.rotate(aim.ang);                               // 총열이 조준점을 향한다
  /* 길이는 BARREL 로 묶여 있으니 단면만 넓힌다 — 세로로 세웠을 때 파이프처럼
     보이던 게 폭 부족 때문이었다. x 만 늘려도 총구는 축(x=0) 위에 그대로 있어
     예광탄·화염 정렬은 영향을 받지 않는다. */
  ctx.scale(1.34, 1);

  /* ① 개머리판 — 어깨에 붙는 쪽. 뺨받침(comb)과 고무 뒤판을 나눠 그린다 */
  ctx.fillStyle = M.wood[1];
  poly([[16,-52],[74,-16],[150,132],[128,150],[54,146],[24,-28]]);
  ctx.fillStyle = M.wood[0];                          // 위쪽 뺨받침 하이라이트
  poly([[16,-52],[46,-34],[110,120],[86,128]]);
  ctx.fillStyle = M.wood[2];                          // 아래 그늘
  poly([[74,-16],[150,132],[128,150],[96,120]]);
  ctx.fillStyle = '#1b1a18';                          // 고무 뒤판
  poly([[128,150],[150,132],[162,152],[140,170]]);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for(let i=0;i<3;i++) ctx.fillRect(134 + i*7, 142, 3, 22);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;   // 멜빵 고리
  ctx.beginPath(); ctx.ellipse(96, 84, 7, 4, 0.6, 0, 7); ctx.stroke();

  /* ② 권총 손잡이 + 방아쇠울 */
  ctx.fillStyle = M.grip;
  poly([[4,-26],[44,-10],[62,98],[20,106],[2,40]]);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for(let i=0;i<5;i++){                               // 미끄럼 방지 홈
    ctx.fillRect(12 + i*2, 10 + i*16, 34 - i*2, 4);
  }
  ctx.strokeStyle = M.metal[1]; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();                                    // 방아쇠울
  ctx.moveTo(-2,-16); ctx.quadraticCurveTo(20, 34, 44, 2); ctx.stroke();
  ctx.strokeStyle = M.metal[0]; ctx.lineWidth = 5;    // 방아쇠 — 쏘면 당겨진다
  ctx.beginPath();
  ctx.moveTo(16, -8); ctx.quadraticCurveTo(19 + rec*4, 8, 14 + rec*5, 18);
  ctx.stroke();

  /* ③ 탄창 — 2단계부터 드럼. 재장전 중엔 빠져 내려간다 */
  ctx.save();
  ctx.translate(magT * 26, magT * 96);
  ctx.rotate(magT * 0.42);
  ctx.globalAlpha = magT > 0.86 ? Math.max(0, (1 - magT) / 0.14) : 1;
  if(isRate && T >= 2){                               // 연사 계열 — 드럼탄창
    tube(-46, -4, 92, 92, ['#3a3630','#282520','#161412'], 46);
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 42, 45, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 42, 30, 0.6, 4.2); ctx.stroke();
    screw(0, 42, 6, '#22201b');
    tube(-19, -36, 38, 48, ['#3a3630','#282520','#161412'], 3);
    if(T >= 4){                                       // 회전 다연장 — 급탄 벨트
      ctx.strokeStyle = M.tint; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(30, 20); ctx.quadraticCurveTo(74, 54, 62, 104);
      ctx.stroke();
      ctx.fillStyle = '#2a2620';
      for(let i=0;i<5;i++) ctx.fillRect(40 + i*5, 30 + i*15, 12, 6);
    }
  }else{
    const big = T >= 2 ? 1.35 : 1;                    // 관통 계열 — 대구경 박스탄창
    ctx.fillStyle = M.body[1];
    poly([[-26*big,-36],[16*big,-36],[34*big,92],[-8*big,100]]);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    poly([[-26*big,-36],[-16*big,-36],[-2*big,96],[-8*big,100]]);
    ctx.fillStyle = 'rgba(0,0,0,.4)';                 // 탄 확인창
    for(let i=0;i<3;i++) ctx.fillRect(6*big, -18 + i*30, 16*big, 8);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  /* ④ 리시버 — 총의 몸통. 배출구·장전손잡이가 여기 붙는다 */
  tube(-36, -146, 74, 124, M.body, 6);
  ctx.fillStyle = 'rgba(0,0,0,.45)';                  // 아래 그림자 경계
  ctx.fillRect(-36, -30, 74, 4);
  ctx.fillStyle = M.metal[2];                         // 배출구
  ctx.beginPath(); ctx.roundRect(14, -128, 22, 40, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.beginPath(); ctx.roundRect(16, -126 + bolt*0.5, 18, 34, 3); ctx.fill();
  // 노리쇠 덮개 + 장전손잡이 (반동에 맞춰 뒤로 왕복)
  ctx.save();
  ctx.translate(0, bolt);
  tube(-24, -140, 46, 30, [M.metal[0], M.metal[1], M.metal[2]], 3);
  ctx.fillStyle = M.metal[0];
  ctx.beginPath(); ctx.roundRect(-34, -134, 16, 13, 3); ctx.fill();
  screw(-26, -128, 3);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.07)';            // 상단 광
  ctx.fillRect(-30, -146, 10, 122);
  screw(-26, -46, 3.4); screw(30, -46, 3.4);
  if(T >= 3){                                         // 3단계 금장식
    ctx.fillStyle = M.tint;
    ctx.fillRect(-36, -118, 74, 3); ctx.fillRect(-36, -44, 74, 3);
    ctx.globalAlpha = 0.5; ctx.fillRect(-36, -112, 74, 1); ctx.globalAlpha = 1;
  }

  /* ⑤ 핸드가드 — 잡는 부분. 방열 리브와 통풍구 */
  tube(-33, -286, 67, 146, T >= 1 ? M.body : M.wood, 8);
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  for(let i=0;i<5;i++) ctx.fillRect(-24, -276 + i*28, 20, 8);   // 통풍구
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for(let i=0;i<5;i++) ctx.fillRect(10, -276 + i*28, 16, 6);
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(-28, -286, 9, 146);
  ctx.fillStyle = 'rgba(0,0,0,.4)';        ctx.fillRect(26, -286, 8, 146);
  screw(-24, -150, 3); screw(28, -150, 3);

  /* ⑥ 상부 레일 */
  ctx.fillStyle = M.metal[2];
  ctx.beginPath(); ctx.roundRect(-13, -300, 26, 170, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for(let i=0;i<9;i++) ctx.fillRect(-11, -296 + i*18, 22, 3);

  /* ⑦ 가스블록 + 총열. 계열 3단계부터 실루엣이 크게 갈린다 —
        연사는 총열이 여러 개로, 관통은 총열이 굵어지고 양각대가 달린다. */
  if(isRate && T >= 3){                               // 다연장 — 곁 총열
    const pairs = T >= 4 ? [20, 34] : [21];
    pairs.forEach(px=>{
      [-px, px].forEach(sx=>{
        tube(sx - 8, -344, 16, 74, M.metal, 2);
        ctx.fillStyle = '#0a0b0c';
        ctx.beginPath(); ctx.ellipse(sx, -340, 5, 3.6, 0, 0, 7); ctx.fill();
      });
    });
    ctx.fillStyle = M.metal[2];                       // 회전 하우징
    ctx.beginPath(); ctx.roundRect(-(T>=4?46:32), -290, (T>=4?92:64), 26, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = M.tint;
    for(let i=0;i<(T>=4?7:5);i++) ctx.fillRect(-(T>=4?40:26) + i*13, -284, 5, 14);
  }
  const barW = (!isRate && T >= 2) ? 17 : 13;         // 관통 계열은 대구경
  tube(-barW, -356, barW*2, 92, M.metal, 2);
  ctx.fillStyle = M.metal[2];
  ctx.beginPath(); ctx.roundRect(-19, -318, 38, 24, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(-17, -314, 6, 18);
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(-barW + 2, -356, 5, 92);
  ctx.fillStyle = 'rgba(0,0,0,.35)';       ctx.fillRect(barW - 6, -356, 5, 92);
  if(!isRate && T >= 4){                              // 파열 관통포 — 달아오른 코일
    ctx.globalCompositeOperation = 'lighter';
    for(let i=0;i<4;i++){
      const py = -344 + i*22;
      const cg = ctx.createRadialGradient(0, py, 1, 0, py, 26);
      cg.addColorStop(0, 'rgba(255,132,72,.5)'); cg.addColorStop(1, 'rgba(255,132,72,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, py, 26, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ff9a54';
    for(let i=0;i<4;i++) ctx.fillRect(-barW, -346 + i*22, barW*2, 3);
  }
  if(!isRate && T >= 3){                              // 양각대
    ctx.strokeStyle = M.metal[1]; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -300); ctx.lineTo(-40, -238);
    ctx.moveTo( 6, -300); ctx.lineTo( 40, -238);
    ctx.stroke();
    ctx.fillStyle = M.metal[2];
    [-40, 40].forEach(sx=>{ ctx.beginPath(); ctx.ellipse(sx, -236, 9, 4, 0, 0, 7); ctx.fill(); });
  }

  /* ⑧ 총구장치 — 계열과 단계에 따라 커진다. 총구는 (0,-376) 고정 */
  const bw = (isRate && T >= 2) ? 24 : (!isRate && T >= 2) ? 21 : 17;
  tube(-bw, -382, bw*2, 34, M.metal, 4);
  if(isRate && T >= 2){
    ctx.fillStyle = 'rgba(0,0,0,.6)';                 // 제동기 포트
    [-20, 9].forEach(px=>{
      ctx.fillRect(px, -376, 11, 8); ctx.fillRect(px, -362, 11, 8);
    });
  }else if(!isRate && T >= 2){
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;   // 단계식 제퇴기
    [-374, -364, -354].forEach(py=>{
      ctx.beginPath(); ctx.moveTo(-bw+3, py); ctx.lineTo(bw-3, py); ctx.stroke();
    });
  }else{
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.6;
    [-370, -360, -350].forEach(py=>{                  // 소염기 홈
      ctx.beginPath(); ctx.moveTo(-bw+2, py); ctx.lineTo(bw-2, py); ctx.stroke();
    });
  }
  ctx.fillStyle = '#08090a';                          // 총구 구멍
  ctx.beginPath(); ctx.ellipse(0, -374, 8, 6, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(0, -374, 8, 6, 0, 3.4, 6.1); ctx.stroke();

  /* ⑨ 가늠쇠 — 접히는 형태 */
  ctx.fillStyle = M.metal[1];
  poly([[-8,-386],[8,-386],[5,-394],[-5,-394]]);
  ctx.fillStyle = M.metal[0];
  poly([[-4,-394],[4,-394],[2.5,-418],[-2.5,-418]]);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-1, -416, 2, 20);

  /* ⑩ 조준경(1단계+) — 대물렌즈·접안렌즈·마운트 링 */
  if(T >= 1){
    tube(-19, -312, 38, 96, ['#26262a','#1a1a1d','#0f0f11'], 9);
    ctx.fillStyle = '#2e2e30';
    ctx.beginPath(); ctx.roundRect(-24, -304, 48, 14, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-24, -244, 48, 14, 3); ctx.fill();
    screw(-18, -297, 3); screw(18, -297, 3);
    screw(-18, -237, 3); screw(18, -237, 3);
    ctx.fillStyle = '#191a1c';                        // 조절 다이얼
    ctx.beginPath(); ctx.roundRect(17, -278, 13, 20, 3); ctx.fill();
    const lens = ctx.createRadialGradient(-5, -308, 2, 0, -305, 17);
    lens.addColorStop(0,   'rgba(176,232,255,.85)');
    lens.addColorStop(0.55,'rgba(58,132,164,.8)');
    lens.addColorStop(1,   'rgba(14,38,52,.95)');
    ctx.fillStyle = lens;
    ctx.beginPath(); ctx.ellipse(0, -306, 15, 8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -306, 15, 8, 0, 0, 7); ctx.stroke();
  }
  /* ⑪ 레이저 모듈 — 관통 계열 3단계부터 */
  if(!isRate && T >= 3){
    tube(15, -268, 20, 44, ['#2c2c34','#202026','#141418'], 3);
    ctx.fillStyle = 'rgba(255,70,70,.95)';
    ctx.beginPath(); ctx.arc(25, -262, 4.5, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(25, -262, 1, 25, -262, 16);
    lg.addColorStop(0, 'rgba(255,60,60,.5)'); lg.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(25, -262, 16, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ⑫ 수직 손잡이 + 이걸 감아 쥔 왼손.
     예전엔 손등 타원 하나에 마디를 겹쳐 그려 뭉개져 있었다.
     손잡이를 먼저 세우고 손가락을 그 위로 감으면 잡은 모양이 읽힌다. */
  const fx = -30, fy = -214;
  tube(fx - 13, fy - 6, 26, 62, ['#3a332c','#282320','#151311'], 8);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  for(let i=0;i<4;i++) ctx.fillRect(fx - 10, fy + 4 + i*13, 20, 4);

  ctx.fillStyle = '#4a3a2e';                          // 손등
  ctx.beginPath(); ctx.ellipse(fx - 16, fy + 16, 21, 30, -0.2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(fx - 22, fy + 24, 13, 20, -0.2, 0, 7); ctx.fill();
  for(let i=0;i<4;i++){                               // 손가락 — 손잡이를 감아 쥔다
    const fyy = fy - 2 + i*15;
    ctx.fillStyle = i % 2 ? '#5e4a3a' : '#54402f';
    ctx.beginPath(); ctx.roundRect(fx - 26, fyy, 40, 13, 6.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,.07)';
    ctx.beginPath(); ctx.roundRect(fx - 24, fyy + 1, 36, 4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.28)';                // 마디 그늘
    ctx.fillRect(fx + 2, fyy + 2, 3, 9);
  }
  ctx.fillStyle = '#463628';                          // 엄지 — 반대쪽으로 넘어온다
  ctx.beginPath(); ctx.ellipse(fx + 14, fy + 6, 9, 19, 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,.06)';
  ctx.beginPath(); ctx.ellipse(fx + 12, fy - 1, 5, 11, 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = '#33281e';                          // 장갑 손목
  ctx.beginPath(); ctx.roundRect(fx - 34, fy + 44, 40, 20, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,.05)';
  ctx.fillRect(fx - 32, fy + 46, 36, 4);

  /* ⑬ 총구 연기 — 쏜 직후 옅게 피어오른다 */
  if(g && g.flash > 0.02){
    const sm = g.flash;
    ctx.fillStyle = `rgba(196,192,180,${sm*0.10})`;
    for(let i=0;i<3;i++){
      const py = -BARREL - 16 - i*20 - (1-sm)*26;
      ctx.beginPath();
      ctx.ellipse(Math.sin(g.t*7 + i)*7*(1-sm+0.4), py, 11 + i*7, 8 + i*5, 0, 0, 7);
      ctx.fill();
    }
  }

  /* ⑭ 총구 화염 — 회전축 위 BARREL 지점, 즉 예광탄 시작점과 정확히 같은 자리.
     예전엔 반지름 150px 짜리 별이 화면 가운데를 다 태워서, 연사 중엔 좀비가
     안 보였다. 절반으로 줄이고 좌우를 살짝 비대칭으로 흔든다. */
  /* 화염은 조준점 바로 위에 뜬다 — 즉 지금 쏘고 있는 좀비를 정확히 가린다.
     연사 중엔 flash 가 0 까지 내려가지도 못하니 상시 가림막이 된다.
     크기와 밝기를 더 줄이고, 세로 화염을 짧게 눌러 시야를 비운다. */
  if(g && g.flash > 0.04){
    const f = g.flash, my = -BARREL;
    const wob = Math.sin(g.t * 61) * 0.16;                              // 발마다 다른 모양
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(0, my, 2, 0, my, 74*f);
    fg.addColorStop(0,   `rgba(255,248,214,${f*0.72})`);
    fg.addColorStop(0.32,`rgba(255,172,62,${f*0.34})`);
    fg.addColorStop(1,   'rgba(255,118,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, my, 74*f, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,236,180,${f*0.8})`;
    poly([[0, my - 34*f], [13*f, my + 3], [-13*f, my + 3]]);            // 세로 화염
    poly([[(-34 + wob*22)*f, my - 5], [0, my - 13*f],
          [( 34 + wob*22)*f, my - 5], [0, my + 8]]);                    // 가로 화염
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
