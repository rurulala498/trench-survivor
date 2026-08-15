import { ctx } from '../canvas';
import { imageAsset } from '../assets/loader';
import { FUNNEL } from '../config';
import { SLOTS, WORKS } from '../data/works';
import { defenseGroundY, projS, projX, projY } from '../sim/projection';
import { g } from '../state';
import { FOG, fogT, mix } from './colors';
import { C } from './theme';
import type { ImageAssetKey } from '../assets/types';
import type { Work, WorkKind } from '../types';


/* 한 방어선을 그릴 때 화가들이 공유하는 값.
   투영 결과를 매번 다시 계산하지 않도록 미리 풀어서 넘긴다. */
export interface WorkView {
  wk: Work; lv: number;
  d: number; y: number; s: number;
  xl: number; xr: number;
  t: number; ratio: number;
}
type Painter = (v: WorkView) => void;

const WORK_IMAGE: Partial<Record<WorkKind, {
  asset: ImageAssetKey;
  widthScaleFar: number;
  widthScaleMid: number;
  widthScaleNear: number;
  heightWidthScale: number;
  heightScale: number;
  groundOffset: number;
}>> = {
  // 세 설치선마다 배경 통로의 좌우 폐허까지 이어지도록 폭을 따로 맞춘다.
  // 높이는 기존 기준 폭으로 계산해 가림 높이는 유지하고 가로만 확장한다.
  trench: {
    asset: 'workTrench', widthScaleFar: 1.85, widthScaleMid: 2.15,
    widthScaleNear: 2.30, heightWidthScale: 1.55, heightScale: 0.56, groundOffset: 4,
  },
  wire: {
    asset: 'workWire', widthScaleFar: 1.92, widthScaleMid: 2.23,
    widthScaleNear: 2.42, heightWidthScale: 1.62, heightScale: 0.52, groundOffset: 3,
  },
};

function workWidthScale(d: number, cfg: NonNullable<(typeof WORK_IMAGE)[WorkKind]>): number {
  const [far, mid, near] = SLOTS;
  if(d >= mid){
    const t = Math.max(0, Math.min(1, (far - d) / (far - mid)));
    return cfg.widthScaleFar + (cfg.widthScaleMid - cfg.widthScaleFar) * t;
  }
  const t = Math.max(0, Math.min(1, (mid - d) / (mid - near)));
  return cfg.widthScaleMid + (cfg.widthScaleNear - cfg.widthScaleMid) * t;
}

/* 참호/철조망은 현재 배경과 같은 재질·조명을 가진 투명 에셋으로 그린다.
   투영된 통로 폭을 기준으로 크기를 잡으므로 세 설치 거리에서 같은 원근을 따른다.
   에셋 로드 실패 시 아래 Canvas 화가가 그대로 fallback 역할을 한다. */
function paintWorkImage(kind: WorkKind, v: WorkView): boolean {
  const cfg = WORK_IMAGE[kind];
  if(!cfg) return false;
  const image = imageAsset(cfg.asset);
  if(!image || !image.naturalWidth || !image.naturalHeight) return false;

  const laneWidth = v.xr - v.xl;
  const width = laneWidth * workWidthScale(v.d, cfg);
  const height = laneWidth * cfg.heightWidthScale
               * image.naturalHeight / image.naturalWidth * cfg.heightScale;
  const cx = (v.xl + v.xr) * 0.5;
  const bottom = v.y + cfg.groundOffset * v.s;
  const healthAlpha = 0.58 + v.ratio * 0.42;

  ctx.save();
  ctx.globalAlpha *= healthAlpha * (1 - v.t * 0.25);
  ctx.drawImage(image, cx - width/2, bottom - height, width, height);

  // 등급 상승 시 실루엣을 흐리지 않으면서 재질이 한층 보강된 느낌만 더한다.
  if(v.lv >= 2){
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha *= v.lv >= 3 ? 0.17 : 0.10;
    ctx.drawImage(image, cx - width/2, bottom - height - (v.lv-1)*1.5*v.s, width, height);
  }
  ctx.restore();
  return true;
}

/* 종류별 화가 표.
   예전에는 drawWork 안의 if/else-if 사슬이었다. 표로 바꾸면 WorkKind 에
   종류를 하나 더 넣는 순간 tsc 가 "이 종류의 화가가 빠졌다"고 잡아준다.
   데이터(data/works.ts)는 여전히 순수하고, 그리기 지식은 여기만 안다. */
const PAINT: Record<WorkKind, Painter> = {
  trench(v){
    if(paintWorkImage('trench', v)) return;
    const { lv, y, s, xl, xr, t, ratio } = v;
    // 모래주머니 두 줄 + 통나무 — 내 참호의 축소판
    const hgt = 30*s, bw = 26*s;
    const dark = mix([26,22,16], FOG, t);
    ctx.fillStyle = dark;                                   // 밑동 흙
    ctx.beginPath(); ctx.ellipse((xl+xr)/2, y + 5*s, (xr-xl)/2 + 12*s, 8*s, 0, 0, 7); ctx.fill();
    for(let x = xl; x < xr + bw; x += bw*1.72){
      const broken = ratio < 0.5 && ((x*7|0) % 10) / 10 > ratio*1.9;
      if(broken){                                           // 터져나간 자리
        ctx.fillStyle = mix([64,56,40], FOG, t);
        ctx.beginPath(); ctx.ellipse(x, y - 2*s, bw*0.85, 6*s, 0, 0, 7); ctx.fill();
        continue;
      }
      [0, 1].forEach(rowi=>{
        const cy = y - hgt*0.30 - rowi*hgt*0.52 + (1-ratio)*4*s;
        const grd = ctx.createLinearGradient(x, cy - 9*s, x, cy + 9*s);
        grd.addColorStop(0, mix([138,124,98], FOG, t));
        grd.addColorStop(0.5, mix([95,84,64], FOG, t));
        grd.addColorStop(1, mix([38,33,24], FOG, t));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(x, cy, bw*0.86, 9*s, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(0,0,0,${0.5*(1-t)})`; ctx.lineWidth = Math.max(0.6, 1.2*s);
        ctx.stroke();
      });
    }
    ctx.fillStyle = mix([70,58,36], FOG, t);                 // 가로 통나무
    ctx.fillRect(xl - 6*s, y - hgt*0.86, (xr-xl) + 12*s, 5*s);
    ctx.fillStyle = `rgba(255,232,186,${0.10*(1-t)})`;
    ctx.fillRect(xl - 6*s, y - hgt*0.86, (xr-xl) + 12*s, 1.6*s);

    // 등급별 보강 — 내 참호가 강화되는 방식과 같은 언어를 쓴다
    if(lv >= 2){                                          // 2등급: 앞면 판자
      for(let x = xl; x < xr; x += 46*s){
        ctx.fillStyle = mix([86,68,40], FOG, t);
        ctx.fillRect(x, y - hgt*0.52, 42*s, 13*s);
        ctx.fillStyle = `rgba(255,236,196,${0.10*(1-t)})`;
        ctx.fillRect(x, y - hgt*0.52, 42*s, 3*s);
        ctx.fillStyle = mix([30,24,14], FOG, t);              // 못
        ctx.beginPath(); ctx.arc(x + 5*s, y - hgt*0.45, 1.6*s, 0, 7); ctx.fill();
      }
    }
    if(lv >= 3){                                          // 3등급: 리벳 철판
      for(let x = xl - 4*s; x < xr; x += 62*s){
        const pl = ctx.createLinearGradient(0, y - hgt*0.72, 0, y - hgt*0.1);
        pl.addColorStop(0, mix([116,124,128], FOG, t));
        pl.addColorStop(0.5, mix([74,82,86], FOG, t));
        pl.addColorStop(1, mix([38,42,46], FOG, t));
        ctx.fillStyle = pl;
        ctx.fillRect(x, y - hgt*0.72, 58*s, hgt*0.62);
        ctx.strokeStyle = `rgba(0,0,0,${0.5*(1-t)})`; ctx.lineWidth = Math.max(0.6, 1.2*s);
        ctx.strokeRect(x, y - hgt*0.72, 58*s, hgt*0.62);
        ctx.fillStyle = mix([150,158,162], FOG, t);
        for(let k=0;k<3;k++){
          ctx.beginPath(); ctx.arc(x + 10*s + k*19*s, y - hgt*0.66, 1.8*s, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 10*s + k*19*s, y - hgt*0.16, 1.8*s, 0, 7); ctx.fill();
        }
      }
    }

  },
  wire(v){
    if(paintWorkImage('wire', v)) return;
    const { lv, y, s, xl, xr, t, ratio } = v;
    // 코일 철조망 — 낮게 깔려 통로를 덮는다.
    // 배경의 좌우 철조망 울타리와 같은 톤이면 설치물로 안 읽히므로 더 밝게 하고
    // 바닥에 그림자를 깔아 "여기 놓인 물건"으로 분리한다.
    ctx.fillStyle = `rgba(0,0,0,${0.34*(1-t)})`;
    ctx.beginPath(); ctx.ellipse((xl+xr)/2, y + 2*s, (xr-xl)/2, 7*s, 0, 0, 7); ctx.fill();
    const a = (0.92 - t*0.5) * (0.4 + ratio*0.6);
    ctx.strokeStyle = `rgba(206,212,198,${a})`;
    ctx.lineWidth = Math.max(0.8, 1.8*s);
    // 등급이 오르면 코일이 겹으로 늘어난다 — 붙잡는 힘이 세진 게 보이도록
    for(let row=0; row<lv; row++){
      const ry = y - 10*s - row*9*s;
      for(let x = xl + (row%2)*11*s; x < xr; x += 22*s){
        const yy = ry + Math.sin(x*0.05 + row)*3*s;
        ctx.beginPath(); ctx.ellipse(x, yy, 15*s, 8*s, 0.2, 0, 7); ctx.stroke();
      }
    }
    ctx.lineWidth = Math.max(0.6, 1.1*s);                    // 가시
    ctx.strokeStyle = `rgba(206,210,196,${a*0.9})`;
    for(let x = xl + 5*s; x < xr; x += 12*s){
      const yy = y - 10*s + Math.sin(x*0.05)*3*s;
      ctx.beginPath();
      ctx.moveTo(x - 3.5*s, yy - 3.5*s); ctx.lineTo(x + 3.5*s, yy + 3.5*s);
      ctx.moveTo(x + 3.5*s, yy - 3.5*s); ctx.lineTo(x - 3.5*s, yy + 3.5*s);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(150,152,142,${a})`;              // 말뚝
    ctx.lineWidth = Math.max(1, 2.4*s);
    for(let x = xl; x <= xr; x += 62*s){
      ctx.beginPath(); ctx.moveTo(x, y + 3*s); ctx.lineTo(x, y - 24*s); ctx.stroke();
    }

  },
  mine({ wk, d, y, s, t }){
    // 지뢰밭 — 파묻은 흙무덤과 신관 머리. 남은 개수를 눈으로 세게 한다.
    const n = Math.max(0, Math.ceil(wk.hp));
    for(let k=0;k<n;k++){
      const wx = (-1 + (2*(k + 0.5) / Math.max(1, n))) * FUNNEL*0.86;
      const x = projX(wx, d), yy = y - 2*s + ((k%2) ? 4*s : 0);
      ctx.fillStyle = `rgba(0,0,0,${0.4*(1-t)})`;                  // 파낸 자리
      ctx.beginPath(); ctx.ellipse(x, yy + 2*s, 15*s, 5.4*s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = mix([84,72,46], FOG, t);                     // 흙무덤
      ctx.beginPath(); ctx.ellipse(x, yy, 13*s, 4.8*s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = mix([132,118,76], FOG, t);                   // 노출된 상판
      ctx.beginPath(); ctx.ellipse(x, yy - 2.4*s, 6.4*s, 2.8*s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(20,16,10,${0.6*(1-t)})`; ctx.lineWidth = Math.max(0.6, 1.1*s);
      ctx.stroke();
      const blink = 0.35 + 0.65*Math.abs(Math.sin(g.t*2.4 + k));   // 신관 램프
      ctx.fillStyle = `rgba(236,96,62,${blink*(1-t)})`;
      ctx.beginPath(); ctx.arc(x, yy - 3.4*s, 2*s, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(x, yy - 3.4*s, 0, x, yy - 3.4*s, 9*s);
      lg.addColorStop(0, `rgba(255,90,50,${blink*0.4*(1-t)})`);
      lg.addColorStop(1, 'rgba(255,90,50,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(x, yy - 3.4*s, 9*s, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  },
};

/* ── 전방 방어선 ───────────────────────────────────────────
   전부 투영 헬퍼로 그린다. 거리 d 에서의 통로 폭·스케일을 그대로 쓰므로
   먼 자리에 놓으면 작게, 가까운 자리에 놓으면 크게 선다.
   alpha 인자는 설치 미리보기용 반투명.
   ─────────────────────────────────────────────────────── */
export function drawWork(wk: Work, alpha?: number){
  const W2 = WORKS[wk.kind];
  const lv = wk.lv || 1;                    // 등급이 없으면 1로 본다
  const d = wk.d;
  const y = wk.kind === 'mine' ? projY(d) : defenseGroundY(d);
  const s = projS(d);
  const xl = projX(-FUNNEL*1.02, d), xr = projX(FUNNEL*1.02, d);
  const t  = fogT(d);
  const ratio = Math.max(0, wk.hp / wk.max);
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  const jolt = wk.fx ? Math.sin(wk.fx*30) * wk.fx * 3 * s : 0;
  ctx.translate(0, jolt);

  PAINT[wk.kind]({ wk, lv, d, y, s, xl, xr, t, ratio });

  // 내구도 게이지 — 저지물만. 지뢰는 위 개수로 이미 보인다.
  if(alpha == null && W2.blocks !== false && ratio < 1){
    const gw = (xr - xl) * 0.5, gx = (xl + xr)/2 - gw/2, gy = y - 46*s;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(gx - 1, gy - 1, gw + 2, 5);
    ctx.fillStyle = ratio > 0.5 ? '#c9a34b' : ratio > 0.25 ? '#d4762e' : C.red;
    ctx.fillRect(gx, gy, gw * ratio, 3);
  }
  if(wk.fx > 0){                                            // 얻어맞은 순간 번쩍
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,170,120,${wk.fx*0.14})`;
    ctx.fillRect(xl - 20*s, y - 52*s, (xr-xl) + 40*s, 60*s);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/* 지뢰 폭발 */
export function drawBooms(){
  g.booms.forEach(b=>{
    const r = (1 - b.life) * 90 * b.s + 8;
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(b.x, b.y - 10*b.s, 2, b.x, b.y - 10*b.s, r);
    gr.addColorStop(0,   `rgba(255,246,208,${b.life})`);
    gr.addColorStop(0.35,`rgba(255,158,54,${b.life*0.6})`);
    gr.addColorStop(1,   'rgba(120,40,10,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(b.x, b.y - 10*b.s, r, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(40,34,28,${b.life*0.5})`;          // 흙먼지
    ctx.beginPath(); ctx.ellipse(b.x, b.y, r*0.8, r*0.3, 0, 0, 7); ctx.fill();
  });
}
