import { ctx } from '../canvas';
import { D_MELEE, D_SPAWN, FUNNEL, H, HORIZON, W } from '../config';
import { projS, projX, projY } from '../sim/projection';
import { fogT } from './colors';
import { imageAsset } from '../assets/loader';
import { BACKGROUND_VISUAL, FOREGROUND_VISUAL } from '../assets/manifest';

function drawBattlefield(): boolean {
  const image = imageAsset(BACKGROUND_VISUAL.asset);
  if(!image) return false;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = W / H;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if(sourceRatio > targetRatio){
    sw = sh * targetRatio;
    sx = (image.naturalWidth - sw) * 0.5;
  }else{
    sh = sw / targetRatio;
    sy = (image.naturalHeight - sh) * 0.5;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);
  return true;
}

/* 투명 PNG의 알파가 실제 성벽·모래주머니 형상 그대로 좀비 하반신을 가린다. */
export function drawForegroundCover(): boolean {
  const image = imageAsset(FOREGROUND_VISUAL.asset);
  if(!image) return false;
  ctx.save();
  // 앞선 설치물/폭발 화가가 합성 상태를 남겨도 전경은 항상 불투명도 100%의
  // source-over 최상단 월드 레이어로 합성한다.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.drawImage(image, FOREGROUND_VISUAL.x, FOREGROUND_VISUAL.y,
                FOREGROUND_VISUAL.width, FOREGROUND_VISUAL.height);
  ctx.restore();
  return true;
}

/* 공중에 떠 있는 먼지 — 달빛에 걸려 반짝이는 것만으로 공기가 생긴다.
   매 프레임 새로 만들지 않고 고정 시드로 한 번만 배치한다. */
type Mote = { wx: number; d: number; hh: number; ph: number; sp: number };
const MOTES: Mote[] = [];
for(let i=0;i<72;i++){
  MOTES.push({
    wx: (((i*53) % 100) / 100 * 2 - 1) * 4.4,
    d:  1.15 + ((i*29) % 82) / 10,
    hh: 0.18 + ((i*17) % 62) / 100,
    ph: i * 0.83,
    sp: 0.22 + ((i*13) % 42) / 100,
  });
}
export function drawMotes(t: number){
  MOTES.forEach(m=>{
    const d  = m.d;
    const wx = m.wx + Math.sin(t*m.sp + m.ph) * 0.10;
    const s  = projS(d);
    const x  = projX(wx, d);
    const y  = projY(d) - (m.hh + Math.sin(t*m.sp*0.7 + m.ph)*0.05) * 92 * s;
    const a  = 0.16 * (1 - fogT(d)) * (0.5 + 0.5*Math.sin(t*1.7 + m.ph));
    if(a <= 0.01) return;
    ctx.fillStyle = `rgba(206,218,238,${a})`;
    const r = Math.max(0.8, 1.15 * s);
    ctx.fillRect(x, y, r, r);
  });
}

export function drawSky(){
  if(drawBattlefield()) return;
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0,   '#0a0d16');
  sky.addColorStop(0.55,'#141b28');
  sky.addColorStop(1,   '#2b3140');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 2);

  // 달 + 헤일로
  ctx.save();
  const mg = ctx.createRadialGradient(1010, 96, 8, 1010, 96, 130);
  mg.addColorStop(0, 'rgba(210,220,240,.45)'); mg.addColorStop(1, 'rgba(210,220,240,0)');
  ctx.fillStyle = mg; ctx.fillRect(860, -40, 300, 280);
  ctx.fillStyle = '#d8dceb'; ctx.beginPath(); ctx.arc(1010, 96, 30, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(150,160,185,.35)';
  ctx.beginPath(); ctx.arc(1000, 88, 7, 0, 7); ctx.arc(1020, 106, 5, 0, 7); ctx.fill();
  ctx.restore();

  // 폐허 실루엣
  ctx.fillStyle = '#0d121b';
  const sil = [[0,60],[70,95],[130,50],[210,110],[290,70],[360,120],[450,55],[520,100],
               [600,80],[690,125],[780,65],[860,105],[940,75],[1030,115],[1110,60],[1200,100],[1280,80]];
  ctx.beginPath(); ctx.moveTo(0, HORIZON);
  sil.forEach(([x,h])=>ctx.lineTo(x, HORIZON - h));
  ctx.lineTo(W, HORIZON); ctx.closePath(); ctx.fill();
}

export function drawGround(){
  if(imageAsset(BACKGROUND_VISUAL.asset)) return;
  const gr = ctx.createLinearGradient(0, HORIZON, 0, H);
  gr.addColorStop(0,   '#2b3140');
  gr.addColorStop(0.12,'#2a2a26');
  gr.addColorStop(0.5, '#1e1c16');
  gr.addColorStop(1,   '#141310');
  ctx.fillStyle = gr; ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // 지면 디테일 (고정 시드로 배치 → 깊이감)
  for(let i=0;i<90;i++){
    const d  = 1.0 + ((i*37) % 70) / 10;
    const wx = (((i*61) % 100) / 100 * 2 - 1) * 3.6;
    const x = projX(wx, d), y = projY(d), s = projS(d);
    const a = (0.10 + 0.14*Math.min(s,1)) * (1 - fogT(d)*0.8);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(x, y, (14 + (i%5)*9)*s, 5*s, 0, 0, 7); ctx.fill();
    if(i % 3 === 0){                                  // 마른 풀 몇 포기
      ctx.strokeStyle = `rgba(92,86,58,${a*1.6})`; ctx.lineWidth = Math.max(0.6, 1.6*s);
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + 5*s, y - 15*s);
      ctx.moveTo(x, y); ctx.lineTo(x - 6*s, y - 11*s);
      ctx.stroke();
    }
  }
  // 좌우를 막은 철조망 벽 — 가운데 통로만 열려 있어서 좀비가 전부 그리로 몰린다
  [1.35, 2.1, 3.2, 4.8, 6.6].forEach((d, li)=>{
    const y = projY(d), s = projS(d);
    const gl = projX(-FUNNEL, d), gr = projX(FUNNEL, d);   // 통로 양쪽 끝
    const a  = 0.62 - li*0.08;
    ctx.strokeStyle = `rgba(126,130,122,${a})`;
    ctx.lineWidth = Math.max(1, 2.6*s);

    // 통로 바깥 구간에만 철조망을 친다
    [[0, gl], [gr, W]].forEach(([x0, x1])=>{
      if(x1 - x0 < 6) return;
      ctx.beginPath();
      for(let x=x0;x<=x1;x+=12) ctx.lineTo(x, y - 26*s + Math.sin(x*0.085 + li)*6*s);
      ctx.stroke();
      ctx.beginPath();
      for(let x=x0;x<=x1;x+=12) ctx.lineTo(x, y - 8*s + Math.sin(x*0.07 - li)*4*s);
      ctx.stroke();
      for(let x=x0+14;x<x1;x+=64){                          // 지지 말뚝
        ctx.beginPath(); ctx.moveTo(x, y + 4*s); ctx.lineTo(x + 3*s, y - 40*s); ctx.stroke();
      }
    });

    // 통로 입구 양쪽에 세운 기둥 — 여기가 문이라는 걸 알려준다
    ctx.strokeStyle = `rgba(150,152,142,${a + 0.18})`;
    ctx.lineWidth = Math.max(1.5, 5*s);
    [gl, gr].forEach(gx=>{
      ctx.beginPath(); ctx.moveTo(gx, y + 6*s); ctx.lineTo(gx, y - 52*s); ctx.stroke();
    });
    // 기둥 밑동 흙무더기
    ctx.fillStyle = `rgba(34,30,22,${a})`;
    [gl, gr].forEach(gx=>{
      ctx.beginPath(); ctx.ellipse(gx, y + 6*s, 20*s, 6*s, 0, 0, 7); ctx.fill();
    });
  });

  // 통로 바닥에 난 발자국 길 — 여기로만 다녔다는 흔적
  const tg = ctx.createLinearGradient(0, HORIZON, 0, projY(D_MELEE));
  tg.addColorStop(0, 'rgba(90,74,48,0)');
  tg.addColorStop(1, 'rgba(90,74,48,.20)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(projX(-FUNNEL*0.8, D_SPAWN), projY(D_SPAWN));
  ctx.lineTo(projX( FUNNEL*0.8, D_SPAWN), projY(D_SPAWN));
  ctx.lineTo(projX( FUNNEL*0.95, D_MELEE), projY(D_MELEE));
  ctx.lineTo(projX(-FUNNEL*0.95, D_MELEE), projY(D_MELEE));
  ctx.closePath(); ctx.fill();

  // 지평선 안개 — 좀비가 안개를 뚫고 나오는 느낌
  const mist = ctx.createLinearGradient(0, HORIZON - 22, 0, HORIZON + 64);
  mist.addColorStop(0,   'rgba(46,54,66,0)');
  mist.addColorStop(0.35,'rgba(46,54,66,.34)');
  mist.addColorStop(1,   'rgba(46,54,66,0)');
  ctx.fillStyle = mist; ctx.fillRect(0, HORIZON - 22, W, 86);
}
