import { TYPES } from '../data/zombies';
import { ctx } from '../canvas';
import { box, walkerHitboxes, walkerPose } from '../sim/projection';
import { fogT, zColors } from './colors';
import type { Zombie } from '../types';
import { imageAsset } from '../assets/loader';
import { BOSS_VISUAL, BRUTE_VISUAL, RUNNER_VISUAL, WALKER_VISUAL } from '../assets/manifest';

const WALKER_FRAME_ENDS: number[] = [];
const RUNNER_FRAME_ENDS: number[] = [];
const BRUTE_FRAME_ENDS: number[] = [];
const BOSS_FRAME_ENDS: number[] = [];
const DEBUG_WALKER_HITBOXES = WALKER_VISUAL.debugHitboxes
  || (typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('debugWalkerHitboxes') === '1');
let walkerCycle = 0;
for(const duration of WALKER_VISUAL.frameDurationsMs){
  walkerCycle += duration;
  WALKER_FRAME_ENDS.push(walkerCycle);
}
let runnerCycle = 0;
for(const duration of RUNNER_VISUAL.frameDurationsMs){
  runnerCycle += duration;
  RUNNER_FRAME_ENDS.push(runnerCycle);
}
let bruteCycle = 0;
for(const duration of BRUTE_VISUAL.frameDurationsMs){
  bruteCycle += duration;
  BRUTE_FRAME_ENDS.push(bruteCycle);
}
let bossCycle = 0;
for(const duration of BOSS_VISUAL.frameDurationsMs){
  bossCycle += duration;
  BOSS_FRAME_ENDS.push(bossCycle);
}

function frameAt(timeMs: number, ends: number[], cycle: number): number {
  const t = ((timeMs % cycle) + cycle) % cycle;
  let lo = 0, hi = ends.length - 1;
  while(lo < hi){
    const mid = (lo + hi) >> 1;
    if(t < ends[mid]!) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

type ProjectedSheetVisual = typeof RUNNER_VISUAL | typeof BRUTE_VISUAL | typeof BOSS_VISUAL;
interface ProjectedSpritePose {
  cx: number; fy: number; height: number; rotation: number;
}

interface InfectionGlowStyle {
  colorCore: string;
  colorMid: string;
  colorOuter: string;
  intensity: number;
  pulsePeriodMs: number;
  pulseMin: number;
  pulseMax: number;
  spots: readonly {x: number; y: number; radius: number; strength: number}[];
}

interface ProjectedSpriteStyle {
  colorFilter: string;
  glow?: InfectionGlowStyle;
}

/* 원본 Boss 프레임의 발광 부위 위에만 작은 additive 열원을 얹는다.
   프레임을 다시 읽거나 픽셀을 처리하지 않아 애니메이션 재생 비용은 일정하다. */
function drawInfectionGlow(
  style: InfectionGlowStyle,
  dx: number, dy: number, dw: number, dh: number,
  fogAlpha: number,
): void {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const wave = Math.sin(now / style.pulsePeriodMs * Math.PI * 2) * 0.5 + 0.5;
  const pulse = style.pulseMin + (style.pulseMax - style.pulseMin) * wave;

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'lighter';
  for(const spot of style.spots){
    const x = dx + dw * spot.x;
    const y = dy + dh * spot.y;
    const radius = Math.max(1.35, dh * spot.radius);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, style.colorCore);
    glow.addColorStop(0.34, style.colorMid);
    glow.addColorStop(1, style.colorOuter);
    ctx.globalAlpha = fogAlpha * style.intensity * spot.strength * pulse;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fogAlpha;
}

/* Runner·Brute·Boss가 공유하는 투명 WebP 시트 화가. 거리 투영과 판정 크기는
   각 종류가 계산하고, 프레임 선택·anchor·피격 플래시는 여기서 한 번만 처리한다. */
function drawProjectedSheetSprite(
  z: Zombie,
  visual: ProjectedSheetVisual,
  pose: ProjectedSpritePose,
  phaseMs: number,
  frameEnds: number[],
  cycle: number,
  shadowWidth: number,
  shadowHeight: number,
  extraRotation = 0,
  style?: ProjectedSpriteStyle,
): boolean {
  let frame = frameAt(phaseMs, frameEnds, cycle);
  if(pose.height < 58) frame -= frame % 3;
  const sheetIndex = Math.floor(frame / visual.framesPerSheet);
  const image = imageAsset(visual.sheets[sheetIndex]!);
  if(!image) return false;

  const local = frame % visual.framesPerSheet;
  const sx = (local % visual.columns) * visual.frameWidth;
  const sy = Math.floor(local / visual.columns) * visual.frameHeight;
  const dh = pose.height * visual.scale;
  const dw = dh * visual.frameWidth / visual.frameHeight;

  ctx.save();
  ctx.translate(pose.cx, pose.fy);
  if(pose.rotation || extraRotation) ctx.rotate(pose.rotation + extraRotation);
  if(pose.height > 62){
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(0, 0, pose.height*shadowWidth, pose.height*shadowHeight, 0, 0, 7); ctx.fill();
  }
  const fogAlpha = 1 - fogT(z.d) * 0.32;
  ctx.globalAlpha = fogAlpha;
  const dx = -dw * visual.anchorX;
  const dy = -dh * visual.anchorY;
  if(style) ctx.filter = style.colorFilter;
  ctx.drawImage(image, sx, sy, visual.frameWidth, visual.frameHeight,
                dx, dy, dw, dh);
  ctx.filter = 'none';
  if(style?.glow) drawInfectionGlow(style.glow, dx, dy, dw, dh, fogAlpha);
  if(z.flash > 0){
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = z.flash * 0.36;
    ctx.drawImage(image, sx, sy, visual.frameWidth, visual.frameHeight,
                  dx, dy, dw, dh);
  }
  ctx.restore();
  return true;
}

function drawWalkerSprite(z: Zombie): boolean {
  const pose = walkerPose(z);
  let frame = frameAt(z.animT * 1000, WALKER_FRAME_ENDS, walkerCycle);
  if(pose.height < 58) frame -= frame % 3;         // 먼 개체는 프레임 LOD
  const sheetIndex = Math.floor(frame / WALKER_VISUAL.framesPerSheet);
  const image = imageAsset(WALKER_VISUAL.sheets[sheetIndex]!);
  if(!image) return false;

  const local = frame % WALKER_VISUAL.framesPerSheet;
  const sx = (local % WALKER_VISUAL.columns) * WALKER_VISUAL.frameWidth;
  const sy = Math.floor(local / WALKER_VISUAL.columns) * WALKER_VISUAL.frameHeight;
  const dh = pose.height;
  const dw = pose.width;

  ctx.save();
  ctx.translate(pose.cx, pose.fy);
  if(pose.rotation) ctx.rotate(pose.rotation);
  if(pose.height > 62){
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(0, 0, dh*0.20, dh*0.035, 0, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1 - fogT(z.d) * 0.32;
  const dx = -dw * WALKER_VISUAL.anchorX;
  const dy = -dh * WALKER_VISUAL.anchorY;
  ctx.drawImage(image, sx, sy, WALKER_VISUAL.frameWidth, WALKER_VISUAL.frameHeight,
                dx, dy, dw, dh);
  if(z.flash > 0){
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = z.flash * 0.36;
    ctx.drawImage(image, sx, sy, WALKER_VISUAL.frameWidth, WALKER_VISUAL.frameHeight,
                  dx, dy, dw, dh);
  }
  ctx.restore();

  if(DEBUG_WALKER_HITBOXES){
    const hit = walkerHitboxes(z, pose);
    ctx.save(); ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,72,72,.95)';
    ctx.beginPath(); ctx.ellipse(hit.head.cx, hit.head.cy, hit.head.rx, hit.head.ry, hit.head.rotation, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(62,214,255,.90)';
    ctx.beginPath(); ctx.ellipse(hit.body.cx, hit.body.cy, hit.body.rx, hit.body.ry, hit.body.rotation, 0, 7); ctx.stroke();
    ctx.restore();
  }
  return true;
}

function drawRunnerSprite(z: Zombie): boolean {
  // Runner 판정 비율은 유지하면서 화면 투영은 Walker와 같은 전장 평면을 쓴다.
  const pose = walkerPose(z);
  const phaseMs = z.ph / (Math.PI * 2) * RUNNER_VISUAL.cycleMs;
  return drawProjectedSheetSprite(
    z, RUNNER_VISUAL, pose, phaseMs, RUNNER_FRAME_ENDS, runnerCycle,
    0.21, 0.045, z.swing > 0.05 ? z.swing * 0.10 : 0,
  );
}

function drawBruteSprite(z: Zombie): boolean {
  // 기존 box가 HP 판정과 충돌 크기를 그대로 제공하고, 이미지만 그 위에 얹는다.
  const b = box(z);
  return drawProjectedSheetSprite(
    z, BRUTE_VISUAL,
    {cx: b.cx, fy: b.fy, height: b.h, rotation: 0},
    z.animT * 1000, BRUTE_FRAME_ENDS, bruteCycle,
    0.30, 0.055, z.swing > 0.05 ? z.swing * 0.08 : 0,
    BRUTE_VISUAL.renderStyle,
  );
}

function drawBossSprite(z: Zombie): boolean {
  // 기존 Boss box와 체력바/피격 판정은 유지하고, 절차적 도형만 애니메이션으로 교체한다.
  const b = box(z);
  return drawProjectedSheetSprite(
    z, BOSS_VISUAL,
    {cx: b.cx, fy: b.fy, height: b.h, rotation: 0},
    z.animT * 1000, BOSS_FRAME_ENDS, bossCycle,
    0.34, 0.060, z.swing > 0.05 ? z.swing * 0.07 : 0,
    BOSS_VISUAL.renderStyle,
  );
}

function drawZombieHealthBar(z: Zombie): void {
  const T = TYPES[z.type];
  if(z.hp >= z.max || !T.bar) return;
  const b = box(z);
  if(b.h <= 40) return;
  const width = Math.max(20, b.w*0.9), x = b.cx - width/2, y = b.y - 10;
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x - 1, y - 1, width + 2, 6);
  ctx.fillStyle = T.barCol;
  ctx.fillRect(x, y, width * (z.hp/z.max), 4);
}

export function drawZombie(z: Zombie){
  if(z.type === 'walker' && drawWalkerSprite(z)) return;
  if(z.type === 'runner' && drawRunnerSprite(z)) return;
  if(z.type === 'brute' && drawBruteSprite(z)){ drawZombieHealthBar(z); return; }
  if(z.type === 'boss' && drawBossSprite(z)){ drawZombieHealthBar(z); return; }
  const b = box(z), t = fogT(z.d);
  const cc = zColors(z.type, z.hue, t);
  const body = cc.body, head = cc.head, dark = cc.dark;
  const s = b.s * z.sz, h = b.h, x = b.cx, fy = b.fy;
  const walk = Math.sin(z.ph), walk2 = Math.cos(z.ph);

  /* 화면에서 차지하는 키로 디테일 단계를 나눈다.
     수백 마리가 몰려오면 멀리 있는 놈의 눈·입·림라이트·비틀거림 회전은
     보이지도 않는데 값은 똑같이 나갔다. 특히 회전은 모든 도형을
     축에 어긋나게 래스터화시켜서 제일 비싸다. */
  const FAR = h < 74, NEAR = h > 118;

  ctx.save();
  ctx.translate(x, fy);
  if(!FAR || z.swing > 0.05)                                 // 비틀거림 + 내려찍는 반동
    ctx.rotate(Math.sin(z.ph*0.5) * 0.035 + z.swing * 0.10);

  if(!FAR){                                                  // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(0, 0, h*0.22, h*0.05, 0, 0, 7); ctx.fill();
  }

  const legH = h*0.40, torH = h*0.36, headR = h*0.115, bw = h*0.20;

  // 다리
  ctx.strokeStyle = dark; ctx.lineWidth = h*0.075; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-bw*0.30, -legH); ctx.lineTo(-bw*0.30 + walk*h*0.09, 0);
  ctx.moveTo( bw*0.30, -legH); ctx.lineTo( bw*0.30 - walk*h*0.09, 0);
  ctx.stroke();

  /* 몸통 — 위가 밝은 그라디언트로 통을 세우고, 밑단은 찢긴 옷처럼 들쭉날쭉하게.
     그라디언트 객체 생성이 비싸서 가까운 놈에게만 쓴다. 멀리 있는 놈은
     어차피 몇 픽셀이라 단색으로 칠해도 차이가 안 보인다. */
  if(s > 0.62){
    const tg = ctx.createLinearGradient(0, -legH - torH, 0, -legH);
    tg.addColorStop(0, body);
    tg.addColorStop(1, cc.deep);
    ctx.fillStyle = tg;
  }else{
    ctx.fillStyle = body;
  }
  ctx.beginPath();
  ctx.moveTo(-bw*0.62, -legH - torH);
  ctx.lineTo( bw*0.62, -legH - torH);
  if(FAR){                                                   // 밑단 톱니는 가까울 때만
    ctx.lineTo( bw*0.50, -legH + torH*0.08);
    ctx.lineTo(-bw*0.50, -legH + torH*0.08);
  }else{
    ctx.lineTo( bw*0.50, -legH + torH*0.10);
    ctx.lineTo( bw*0.28, -legH - torH*0.04);
    ctx.lineTo( bw*0.02, -legH + torH*0.12);
    ctx.lineTo(-bw*0.26, -legH - torH*0.02);
    ctx.lineTo(-bw*0.50, -legH + torH*0.08);
  }
  ctx.closePath(); ctx.fill();
  if(!FAR){                                                  // 찢긴 옷 얼룩
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(-bw*0.5, -legH - torH*0.45, bw*0.42, torH*0.30);
  }

  // 팔 — 전진 중엔 앞으로 뻗고, 참호를 때릴 땐 위로 들었다 내려찍는다.
  // 양팔을 똑같이 움직이면 허수아비처럼 보이므로 개체마다 좌우를 어긋나게 둔다.
  const asym = z.hue / 26;
  ctx.strokeStyle = head; ctx.lineWidth = h*0.062;
  const sy = -legH - torH*0.86;
  const armY = z.melee ? (h*0.34*z.swing - h*0.24*(1 - z.swing)) : h*0.05 ;
  ctx.beginPath();
  ctx.moveTo(-bw*0.55, sy);
  ctx.lineTo(-bw*(0.95 + asym*0.12), sy + armY*(1 + asym*0.28) + walk2*h*0.03);
  ctx.moveTo( bw*0.55, sy);
  ctx.lineTo( bw*(0.95 - asym*0.12), sy + armY*(1 - asym*0.34) - walk2*h*0.03);
  ctx.stroke();

  // 머리 (히트박스 상단 26%)
  const hy = -legH - torH - headR*0.85;
  ctx.fillStyle = head;
  ctx.beginPath(); ctx.arc(0, hy, headR, 0, 7); ctx.fill();
  if(!FAR){                                                  // 붉은 눈 + 벌어진 입
    ctx.fillStyle = 'rgba(255,60,50,.9)';
    ctx.beginPath();
    ctx.arc(-headR*0.38, hy - headR*0.12, headR*0.20, 0, 7);
    ctx.arc( headR*0.38, hy - headR*0.12, headR*0.20, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,8,8,.8)';
    ctx.fillRect(-headR*0.42, hy + headR*0.35, headR*0.84, headR*0.22);
  }else{
    ctx.fillStyle = 'rgba(255,60,50,.75)';                   // 멀면 눈만 한 덩이로
    ctx.fillRect(-headR*0.5, hy - headR*0.3, headR, headR*0.34);
  }

  // 달빛 림라이트 — 광원이 오른쪽 위(달)에 있으니 그쪽 윤곽만 밝게 딴다.
  // 평면 실루엣이 입체로 읽히는 데 이 한 줄이 제일 크게 먹는다.
  if(NEAR){
    ctx.strokeStyle = `rgba(196,212,236,${0.30 * (1 - t)})`;
    ctx.lineWidth = Math.max(0.8, h*0.014);
    ctx.beginPath();
    ctx.arc(0, hy, headR, -Math.PI*0.85, -Math.PI*0.10);
    ctx.moveTo(bw*0.62, -legH - torH);
    ctx.lineTo(bw*0.50, -legH + torH*0.08);
    ctx.stroke();
  }

  /* 피격 플래시 — 예전엔 히트박스 사각형을 통째로 밝혀서, 맞을 때마다 좀비 위에
     흰 상자가 떠올랐다. 몸통과 머리 실루엣만 물들인다. */
  if(z.flash > 0){
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,152,138,${z.flash*0.34})`;
    ctx.beginPath();
    ctx.moveTo(-bw*0.62, -legH - torH);
    ctx.lineTo( bw*0.62, -legH - torH);
    ctx.lineTo( bw*0.50, -legH + torH*0.10);
    ctx.lineTo(-bw*0.50, -legH + torH*0.08);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, hy, headR*1.04, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  /* 체력바는 브루트·보스만. 워커와 러너는 한두 발에 터지는데 떼로 몰려오면
     막대 수백 개가 머리 위에 깔려서, 정작 봐야 할 큰 놈이 안 보였다.
     "이건 오래 쏴야 하는 놈이다" 를 알려주는 게 목적이므로 그 놈들에게만 준다. */
  drawZombieHealthBar(z);
}
