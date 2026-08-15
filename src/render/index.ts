import { fxRnd } from '../rng';
import { ctx } from '../canvas';
import { H, W } from '../config';
import { gunAim } from '../sim/aim';
import { BLOOD } from '../sim/combat';
import { g, phase } from '../state';
import { drainCorpses, gore, tickGore } from './gore';
import { drawGun } from './weapon';
import { drawCross, drawHUD, drawUpFx } from './hud';
import { drawForegroundCover, drawGround, drawMotes, drawSky } from './scene';
import { drawBranch, drawMenu, drawOver, drawPlace, drawShop } from './screens';
import { font } from './theme';
import { drawTrench } from './trench';
import { drawBooms, drawWork } from './works';
import { drawZombie } from './zombie';
import type { Particle, Work, Zombie } from '../types';

/* 좀비와 방어선을 한 배열에 섞어 거리로 정렬한다. kind 가 있으면 방어선. */
const DEPTH: Array<Zombie | Work> = [];                                // 깊이 정렬용 재사용 버퍼
/* 같은 거리면 방어선(kind 가 있는 쪽)을 살짝 앞에 둔다 */
const depthCmp = (a: Zombie | Work, b: Zombie | Work) => (b.d - ('kind' in b ? 0.001 : 0)) - (a.d - ('kind' in a ? 0.001 : 0));

export function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0, 0, W, H);
  // 자간은 컨텍스트에 남으므로 프레임마다 초기화한다
  if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.save();
  if(g && g.shake > 0)
    ctx.translate((fxRnd()-0.5)*g.shake, (fxRnd()-0.5)*g.shake);

  drawSky();
  drawGround();

  if(g){
    drainCorpses();                                   // sim 이 쌓아둔 시체를 층에 찍는다
    tickGore();                                       // 오래된 시체를 천천히 지운다
    ctx.drawImage(gore, 0, 0);                        // 시체 층 — 살아있는 좀비 아래에
    drawMotes(g.t);                                   // 공중의 먼지 — 공기감
    /* 좀비와 방어선을 거리 하나로 묶어 먼 것부터 그린다.
       따로 그리면 방어선 앞에 선 좀비가 방어선 뒤로 숨는다.
       버퍼를 재사용한다 — 800마리에서 프레임마다 배열 세 개를 새로 만들 이유가 없다. */
    DEPTH.length = 0;
    for(let i=0;i<g.zombies.length;i++) DEPTH.push(g.zombies[i]);
    for(let i=0;i<g.works.length;i++)   DEPTH.push(g.works[i]);
    DEPTH.sort(depthCmp);
    for(let i=0;i<DEPTH.length;i++){
      const o = DEPTH[i];
      if(!o) continue;
      if('kind' in o) drawWork(o); else drawZombie(o);
    }
    drawBooms();

    /* 혈흔 — arc + fill 은 입자 하나당 경로를 만든다. 700개면 그게 다 비용이다.
       사각형으로 바꾸고, 알파를 6단계로 뭉개 같은 색끼리 몰아 그려서
       fillStyle 문자열 조립 횟수를 700번에서 6번으로 줄인다. */
    const buckets: Particle[][] = [[],[],[],[],[],[]];
    g.parts.forEach(p=>{
      const a = Math.min(1, p.life*1.6);
      buckets[Math.min(5, (a*6)|0)].push(p);
    });
    for(let bi=0;bi<6;bi++){
      const list = buckets[bi];
      if(!list.length) continue;
      ctx.fillStyle = BLOOD[bi];
      for(let i=0;i<list.length;i++){
        const p = list[i], r = p.r*0.95;         // 크면 붉은 블록처럼 보여서 시야를 먹는다
        ctx.fillRect(p.x - r*0.5, p.y - r*0.5, r, r);
      }
    }
  }

  // 새 전경은 살아있는 적·혈흔보다 앞, 예광탄·HMG보다 뒤에 놓는다.
  // 로드 실패 시 기존 Canvas 참호가 즉시 fallback이 된다.
  if(!drawForegroundCover()) drawTrench();
  // 예광탄은 전경보다 앞, 총기보다 뒤에 그려 총구에서 실제 탄착점까지 이어진다.
  // 투명한 양 끝과 얇은 밝은 심으로 짧은 잔광만 남기고 레이저처럼 보이지 않게 한다.
  if(g){
    g.tracers.forEach(t=>{
      if(Math.hypot(t.x2 - t.x1, t.y2 - t.y1) < 1) return;
      const pw = Math.min(t.pierce, 5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const glow = ctx.createLinearGradient(t.x1, t.y1, t.x2, t.y2);
      glow.addColorStop(0, 'rgba(255,132,36,0)');
      glow.addColorStop(0.10, `rgba(255,132,36,${t.life*0.10})`);
      glow.addColorStop(0.82, `rgba(255,172,54,${t.life*0.16})`);
      glow.addColorStop(1, 'rgba(255,172,54,0)');
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.0 + pw*0.22;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();

      const core = ctx.createLinearGradient(t.x1, t.y1, t.x2, t.y2);
      core.addColorStop(0, 'rgba(255,224,150,0)');
      core.addColorStop(0.12, `rgba(255,224,150,${t.life*0.48})`);
      core.addColorStop(0.76, `rgba(255,244,210,${t.life*0.78})`);
      core.addColorStop(1, 'rgba(255,235,182,0)');
      ctx.strokeStyle = core;
      ctx.lineWidth = 0.68 + pw*0.05;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      ctx.restore();
    });
  }
  drawGun();

  if(g){
    // 탄피
    g.shells.forEach(s=>{
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r);
      ctx.fillStyle = `rgba(214,176,88,${Math.min(1, s.life)})`;
      ctx.fillRect(-5, -2, 10, 4); ctx.restore();
    });
    // 데미지 숫자 — 합쳐진 값이 커질 때 한 번 튄다
    ctx.textAlign = 'center';
    g.nums.forEach(n=>{
      ctx.globalAlpha = Math.min(1, n.life*1.6);
      font(15 + (n.pop || 0)*6, 800, 0);
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillText(n.txt, n.x + 1.5, n.y + 1.5);
      ctx.fillStyle = n.c;              ctx.fillText(n.txt, n.x, n.y);
      ctx.globalAlpha = 1;
    });
    /* 총구 섬광 — 화면 전체를 균일하게 띄우면 밤 하늘까지 밝아져 조명이 아니게 된다.
       총구를 광원으로 삼아 참호와 가까운 좀비만 물들인다. */
    /* 0.30 이면 연사 중에 좀비 떼 전체가 주황색으로 씻겨나갔다.
       "번쩍인다"만 남기고 세기를 절반 이하로 낮춘다. */
    if(g.flash > 0.05){
      const a = gunAim();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(a.mx, a.my, 0, a.mx, a.my, 540);
      lg.addColorStop(0,    `rgba(255,214,148,${g.flash*0.13})`);
      lg.addColorStop(0.34, `rgba(255,176,96,${g.flash*0.055})`);
      lg.addColorStop(1,    'rgba(255,150,60,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();

  // 비네트
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  /* 피격 적색 비네트 — 예전엔 화면 전체가 분홍으로 물들어 정작 몰려오는 좀비가
     안 보였다. 가장자리로 몰고 세기를 낮춰 "맞았다"만 전달한다. */
  if(g && g.hurtFx > 0){
    const hv = ctx.createRadialGradient(W/2, H*0.56, H*0.30, W/2, H*0.56, H*0.95);
    hv.addColorStop(0,   'rgba(190,20,20,0)');
    hv.addColorStop(0.62,`rgba(184,22,18,${g.hurtFx*0.15})`);
    hv.addColorStop(1,   `rgba(168,18,14,${g.hurtFx*0.46})`);
    ctx.fillStyle = hv; ctx.fillRect(0, 0, W, H);
  }

  if(phase === 'playing') { drawHUD(); drawUpFx(); drawCross(); }
  if(phase === 'shop')    { drawShop(); drawUpFx(); drawCross(); }
  if(phase === 'branch')  { drawBranch(); drawCross(); }
  if(phase === 'place' || phase === 'boost'){ drawPlace(); drawCross(); }
  if(phase === 'menu')    { drawMenu();  drawCross(); }
  if(phase === 'gameover'){ drawOver();  drawCross(); }
}
