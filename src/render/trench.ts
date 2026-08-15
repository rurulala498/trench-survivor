import { ctx } from '../canvas';
import { H, W } from '../config';
import { trTier } from '../data/branches';
import { g } from '../state';
import { font } from './theme';

/* 모래주머니 한 개 */
function sandbag(cx: number, cy: number, rx: number, ry: number, lit: boolean, tear: number){
  const grd = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  grd.addColorStop(0,    lit ? '#8a7c62' : '#6f6450');
  grd.addColorStop(0.48, lit ? '#5f553f' : '#4c4432');
  grd.addColorStop(1,    '#26221a');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; ctx.stroke();
  // 봉제선
  ctx.strokeStyle = 'rgba(30,24,16,.45)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - rx*0.74, cy - ry*0.06);
  ctx.quadraticCurveTo(cx, cy + ry*0.34, cx + rx*0.74, cy - ry*0.06);
  ctx.stroke();
  // 윗면 하이라이트
  ctx.fillStyle = 'rgba(255,240,200,.07)';
  ctx.beginPath(); ctx.ellipse(cx - rx*0.15, cy - ry*0.46, rx*0.52, ry*0.26, -0.12, 0, 7); ctx.fill();
  if(tear > 0){                                    // 찢겨서 모래가 새는 자국
    ctx.fillStyle = `rgba(18,14,10,${Math.min(0.55, tear)})`;
    ctx.beginPath(); ctx.ellipse(cx + rx*0.24, cy - ry*0.1, rx*0.24, ry*0.3, 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(150,132,96,${Math.min(0.5, tear*0.8)})`;
    ctx.beginPath(); ctx.ellipse(cx + rx*0.28, cy + ry*0.72, rx*0.3, ry*0.2, 0, 0, 7); ctx.fill();
  }
}

/* 철조망 코일 */
function wireCoil(y: number){
  ctx.strokeStyle = 'rgba(158,160,150,.62)'; ctx.lineWidth = 2;
  for(let x=-30;x<W+50;x+=48){
    const yy = y + Math.sin(x*0.045)*5;
    ctx.beginPath(); ctx.ellipse(x, yy, 32, 13, 0.22, 0, 7); ctx.stroke();
  }
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(178,180,168,.55)';
  for(let x=6;x<W;x+=24){
    const yy = y + Math.sin(x*0.045)*5;
    ctx.beginPath();
    ctx.moveTo(x-6, yy-6); ctx.lineTo(x+6, yy+6);
    ctx.moveTo(x+6, yy-6); ctx.lineTo(x-6, yy+6);
    ctx.stroke();
  }
}

export function drawTrench(){
  const ratio = g ? Math.max(0, g.bar / g.barMax) : 1;    // 내구도 비율
  const hurt  = 1 - ratio;
  const jolt  = g ? g.barFx * 5 : 0;                       // 얻어맞을 때 흔들림

  ctx.save();
  ctx.translate(0, jolt);

  // ① 참호 뒤편 흙벽
  ctx.fillStyle = '#0e0d0a';
  ctx.beginPath(); ctx.moveTo(0, H + 30); ctx.lineTo(0, 600);
  for(let x=0;x<=W;x+=8) ctx.lineTo(x, 600 + Math.sin(x*0.021)*8);
  ctx.lineTo(W, H + 30); ctx.closePath(); ctx.fill();

  // ② 철조망 (모래주머니 뒤로 살짝 보이게)
  wireCoil(596);

  // ③ 뒷줄 모래주머니 — 내구도가 떨어지면 여기서부터 터져나간다
  let i = 0;
  for(let x=-44;x<W+90;x+=90, i++){
    const thr = ((i*7) % 10) / 10;
    const jt  = Math.sin(x*0.7)*4;
    if(hurt > 0.32 + thr*0.62){                    // 파괴 → 흘러내린 모래 더미만
      ctx.fillStyle = 'rgba(78,68,50,.75)';
      ctx.beginPath(); ctx.ellipse(x, 646 + jt, 46, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(16,13,9,.8)';
      ctx.beginPath(); ctx.ellipse(x, 636 + jt, 34, 9, 0, 0, 7); ctx.fill();
      continue;
    }
    const sag = hurt * 11 * thr;
    sandbag(x, 626 + jt + sag, 51, 27 - sag*0.45, true, hurt - 0.15);
  }

  // ④ 가로 통나무 보 — 나뭇결까지
  const beam = ctx.createLinearGradient(0, 652, 0, 684);
  beam.addColorStop(0, '#5c4c2e'); beam.addColorStop(0.42, '#463a22'); beam.addColorStop(1, '#241d11');
  ctx.fillStyle = beam; ctx.fillRect(0, 652, W, 32);
  ctx.strokeStyle = 'rgba(20,15,8,.5)'; ctx.lineWidth = 1.4;
  for(let x=0;x<W;x+=6){
    const yy = 660 + Math.sin(x*0.11)*3.2;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x+6, yy + Math.sin((x+6)*0.11)*0.4); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,180,.08)'; ctx.fillRect(0, 652, W, 5);

  // ⑤ 앞줄 모래주머니
  for(let x=0; x<W+90; x+=90){
    sandbag(x, 690 + Math.sin(x*0.6)*4, 55, 29, false, hurt - 0.5);
  }

  // ⑥ 단계별 보강물 — 3회 강화마다 참호 외관이 실제로 달라진다
  const TT = g ? trTier(g.trUps) : 0;
  if(TT >= 1){                                   // 1단계: 앞줄에 판자 덧대기
    for(let x=-10;x<W+40;x+=196){
      ctx.fillStyle = '#4b3d24'; ctx.fillRect(x, 672, 180, 20);
      ctx.fillStyle = 'rgba(255,235,190,.09)'; ctx.fillRect(x, 672, 180, 4);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, 688, 180, 4);
      ctx.fillStyle = '#241d11';                                    // 못
      ctx.beginPath(); ctx.arc(x+12, 682, 3.5, 0, 7); ctx.arc(x+168, 682, 3.5, 0, 7); ctx.fill();
    }
  }
  if(TT >= 2){                                   // 2단계: 볼트로 박은 철판
    for(let x=0;x<W+30;x+=164){
      const pl = ctx.createLinearGradient(0, 664, 0, 706);
      pl.addColorStop(0, '#6a6f72'); pl.addColorStop(0.5, '#474d50'); pl.addColorStop(1, '#282c2e');
      ctx.fillStyle = pl; ctx.fillRect(x, 664, 156, 44);
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, 664, 156, 44);
      ctx.fillStyle = '#8b9196';                                    // 리벳
      for(let k=0;k<4;k++){
        ctx.beginPath(); ctx.arc(x+18+k*40, 672, 3.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x+18+k*40, 700, 3.5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x+4, 668, 148, 4);
    }
  }
  if(TT >= 3){                                   // 3단계: 총안구 뚫린 중앙 방탄판
    const sh = ctx.createLinearGradient(0, 606, 0, 672);
    sh.addColorStop(0, '#7d8286'); sh.addColorStop(0.55, '#4d5256'); sh.addColorStop(1, '#2a2e30');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.roundRect(W/2 - 210, 606, 420, 66, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#0c0e0f';                                      // 총안구
    ctx.beginPath(); ctx.roundRect(W/2 - 120, 622, 240, 17, 5); ctx.fill();
    ctx.fillStyle = '#9aa0a5';
    for(let k=0;k<8;k++){ ctx.beginPath(); ctx.arc(W/2 - 190 + k*54, 662, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(W/2 - 206, 610, 412, 5);
  }

  // ⑦ 세로 지지 기둥 — 전경 프레임
  for(let x=126;x<W;x+=248){
    ctx.fillStyle = '#3a3020'; ctx.fillRect(x - 15, 588, 30, H - 588 + 30);
    ctx.fillStyle = 'rgba(255,235,190,.09)'; ctx.fillRect(x - 15, 588, 9, H - 588 + 30);
    ctx.fillStyle = 'rgba(0,0,0,.4)';        ctx.fillRect(x + 7,  588, 8, H - 588 + 30);
    ctx.fillStyle = '#4e4229';                                       // 기둥 윗단면
    ctx.beginPath(); ctx.ellipse(x, 588, 15, 6, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2b2318';                                       // 고정 볼트
    ctx.beginPath(); ctx.arc(x, 668, 5, 0, 7); ctx.fill();
  }

  // ⑧ 참호 바닥 + 소품
  ctx.fillStyle = '#0a0906'; ctx.fillRect(0, 706, W, H - 706 + 30);
  ctx.fillStyle = 'rgba(150,120,60,.5)';                             // 발밑에 쌓인 탄피
  for(let k=0;k<70;k++){
    const sx = (k*173) % W, sy = 708 + ((k*57) % 12);
    ctx.fillRect(sx, sy, 7, 3);
  }
  ctx.fillStyle = '#3e3524';                                         // 탄약 상자
  ctx.fillRect(52, 676, 132, 46);
  ctx.fillStyle = 'rgba(255,235,190,.08)'; ctx.fillRect(52, 676, 132, 6);
  ctx.fillStyle = 'rgba(0,0,0,.45)';       ctx.fillRect(52, 700, 132, 5);
  ctx.fillStyle = '#8a7a4e'; font(15, 700, 1.2); ctx.textAlign = 'center';
  ctx.fillText('7.62', 118, 697);

  ctx.restore();

  // 참호가 맞은 순간 붉게 번쩍
  if(g && g.barFx > 0){
    ctx.fillStyle = `rgba(180,40,25,${g.barFx*0.22})`;
    ctx.fillRect(0, 588, W, H - 588);
  }
}
