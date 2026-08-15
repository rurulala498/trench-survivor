import { rnd } from '../rng';
import { sfxWave } from '../audio';
import { D_MELEE, D_SPAWN, FUNNEL } from '../config';
import { BOSS_KINDS, TYPES } from '../data/zombies';
import { g } from '../state';
import type { ZombieKind } from '../types';
import { WALKER_VISUAL } from '../assets/manifest';

/* ── 웨이브 구성 ───────────────────────────────────────── */
export function nextWave(){
  g.wave++;
  const w = g.wave;
  if(w > 1){                                       // 웨이브 사이 기본 보수 + 수리 키트
    g.bar = Math.min(g.barMax, g.bar + g.barMax * (0.17 + g.repair));
  }
  /* 학살하는 맛이 목표라 마리수를 제곱항까지 넣어 올린다.
     예전 `24 + w*7` → w10 에 94마리였고, 지금은 268마리.
     1웨이브는 42로 시작해 초반이 벽이 되지 않게 둔다.
     w1 42 · w3 77 · w5 121 · w8 202 · w10 268 · w15 471 · w20 728 */
  const q: ZombieKind[] = [];
  const total = Math.round(28 + w * 13 + w * w * 1.1);
  for(let i=0;i<total;i++){
    let t: ZombieKind = 'walker';
    if(w >= 2 && rnd() < Math.min(0.14 + w*0.035, 0.46)) t = 'runner';
    if(w >= 4 && rnd() < Math.min(0.05 + w*0.018, 0.20)) t = 'brute';
    q.push(t);
  }
  // 보스 종류는 데이터가 정한다 (TYPES 에 boss:true 인 것들)
  if(w % 5 === 0 && BOSS_KINDS.length){
    const n = 1 + (((w/5)|0)/2|0);
    for(let i=0;i<n;i++) q.push(BOSS_KINDS[i % BOSS_KINDS.length]!);
  }
  for(let i=q.length-1;i>0;i--){ const j = (rnd()*(i+1))|0; [q[i], q[j]] = [q[j]!, q[i]!]; }
  g.queue  = q;
  g.waveTotal = q.length;                          // HUD 진행바가 보스까지 세도록

  g.spawnT = 0.5;
  g.waveTxt = 2.2;
  sfxWave();
}
export function waveMul(){
  const w = g.wave;
  // 수량 증가는 유지하되 HP·속도 복리 압박을 낮춰 넓어진 조준 범위를 보상한다.
  return {hp: 1 + (w-1) * 0.16, spd: 1 + (w-1) * 0.024, gap: Math.max(0.05, 0.26 - w*0.016)};
}
export function spawn(type: ZombieKind){
  const T = TYPES[type], m = waveMul();
  g.zombies.push({
    type, d: D_SPAWN + rnd()*1.2,
    // 균등분포 대신 종모양 분포 — 통로 한가운데가 가장 빽빽하고 가장자리로 갈수록 성기다
    wx: ((rnd() + rnd() + rnd()) / 1.5 - 1) * FUNNEL,
    hp: T.hp * m.hp, max: T.hp * m.hp,
    spd: T.spd * m.spd * (0.9 + rnd()*0.2),
    sz: T.sz * (0.92 + rnd()*0.16),
    ph: rnd()*Math.PI*2,          // 걷기 애니 위상
    animT: rnd() * WALKER_VISUAL.cycleMs / 1000,
    animSpeed: 1 + (rnd()*2 - 1) * WALKER_VISUAL.speedVariance,
    hue: (rnd()*2 - 1) * 14,
    flash: 0, dead: false, sway: (rnd()*2-1) * 0.35,
    melee: false, hitT: 0, swing: 0,      // 참호 공격 상태
    stand: D_MELEE + rnd()*0.42,  // 참호 앞에 서는 위치(겹쳐도 층이 지게)
    jit: rnd()*0.34,              // 방어선 앞에서도 한 줄로 서지 않게
  });
}
