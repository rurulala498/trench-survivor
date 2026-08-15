import { H, W } from '../config';
import { g } from '../state';
import { cColors, fogT } from './colors';
import type { Corpse, Ctx2D } from '../types';

/* ── 시체 층 ───────────────────────────────────────────────
   시체는 한 번 눕고 나면 절대 움직이지 않는데, 매 프레임 260구를 다시 그리느라
   14.5ms 를 쓰고 있었다. 오프스크린 캔버스에 눕는 순간 한 번만 찍고,
   그 판을 통째로 얹는다 — 프레임 비용이 drawImage 한 번으로 줄고,
   상한도 필요 없어져 시체가 무한히 쌓인다(학살의 증거가 그대로 남는다).
   대신 아주 느리게 지워서 오래된 시체가 흙에 묻히게 한다.
   ─────────────────────────────────────────────────────── */
export const gore = document.createElement('canvas');
gore.width = W; gore.height = H;
const gctx = gore.getContext('2d') as Ctx2D;
export function clearGore(){ gctx.clearRect(0, 0, W, H); lastFade = 0; }
function fadeGore(){
  gctx.globalCompositeOperation = 'destination-out';
  gctx.fillStyle = 'rgba(0,0,0,0.05)';
  gctx.fillRect(0, 0, W, H);
  gctx.globalCompositeOperation = 'source-over';
}
/* x = 대상 컨텍스트. 시체 층에 찍을 때만 쓴다. */
function paintCorpse(x: Ctx2D, c: Corpse){
  const s = c.s;
  // 거리만큼 안개에 묻혀야 바닥에 깊이가 생긴다
  const t = Math.max(0.38, fogT(c.d == null ? 1.6 : c.d));
  x.save();
  x.translate(c.x, c.y);
  x.fillStyle = `rgba(74,10,10,${0.6 * (1 - t*0.7)})`;          // 핏자국
  x.beginPath(); x.ellipse(0, 2, c.pool*s, c.pool*s*0.32, 0, 0, 7); x.fill();
  x.rotate(c.rot);
  // 살아있는 놈보다 확실히 어두워야 바닥에 깔린 것으로 읽힌다
  const cc2 = cColors(c.type, c.hue, t);
  x.strokeStyle = 'rgba(18,20,16,.9)'; x.lineWidth = 5.5*s; x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-4*s, -3*s); x.lineTo(-26*s, 7*s);
  x.moveTo(-2*s, -1*s); x.lineTo(-22*s, -11*s);
  x.moveTo( 8*s, -2*s); x.lineTo( 28*s, 6*s);
  x.stroke();
  x.fillStyle = cc2.body;
  x.beginPath(); x.ellipse(0, -2*s, 20*s, 9*s, 0, 0, 7); x.fill();
  x.fillStyle = cc2.head;
  x.beginPath(); x.arc(22*s, -5*s, 8.5*s, 0, 7); x.fill();
  x.restore();
}

/* 시체는 바닥에 쌓인 채 남는다 — 학살한 흔적이 보이도록 */
/* ══════════════════════════════════════════════════════════
   sim 이 쌓아둔 시체 큐를 비워 층에 찍는다.
   예전에는 sim/combat 이 dropCorpse() 를 직접 불러서 sim → render 결합이
   있었고, 그 때문에 로직만 따로(서버·테스트) 돌릴 수 없었다.
   지금은 sim 이 g.corpseQ 에 값만 넣고, 그리는 쪽이 알아서 가져간다.
   ══════════════════════════════════════════════════════════ */
export function drainCorpses(): void {
  const q = g.corpseQ;
  if(!q.length) return;
  for(let i=0;i<q.length;i++) paintCorpse(gctx, q[i]!);
  q.length = 0;
}

/* 페이드 시점도 그리기 쪽 관심사라 여기서 센다.
   g.t(게임 시간)만 읽으므로 sim 함수를 부르지 않는다. */
let lastFade = 0;
export function tickGore(): void {
  if(g.t - lastFade > 2.2){ lastFade = g.t; fadeGore(); }
}
