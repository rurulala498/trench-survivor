import { rnd } from '../rng';
import { FUNNEL, MAX_LIVE } from '../config';
import { WORKS } from '../data/works';
import { TYPES } from '../data/zombies';
import { mouse } from '../mouse';
import { openShop, restock } from '../shop/shop';
import { g, phase } from '../state';
import { fire, tryReload } from './combat';
import { hitTrench } from './trench';
import { spawn, waveMul } from './waves';
import { BEHAVIOR } from './workBehavior';
import { blockerFor, hitWork } from './works';
import { BOSS_VISUAL, BRUTE_VISUAL, WALKER_VISUAL } from '../assets/manifest';

/* ── 업데이트 ──────────────────────────────────────────── */
export function update(dt: number){
  if(!g) return;
  g.t += dt;
  g.shake   = Math.max(0, g.shake   - dt*26);
  g.flash   = Math.max(0, g.flash   - dt*9);
  g.hurtFx  = Math.max(0, g.hurtFx  - dt*1.6);
  g.hitMark = Math.max(0, g.hitMark - dt);
  g.recoil  = Math.max(0, g.recoil  - dt*7);
  g.waveTxt = Math.max(0, g.waveTxt - dt);
  g.barFx   = Math.max(0, g.barFx   - dt*2.4);
  g.cashFx  = Math.max(0, g.cashFx  - dt*2.2);
  g.deny    = Math.max(0, g.deny    - dt*0.9);
  if(phase === 'playing' && g.wave <= 1) g.tip = Math.max(0, g.tip - dt);
  if(g.comboT > 0 && (g.comboT -= dt) <= 0) g.combo = 0;
  if(g.upFx && (g.upFx.life -= dt) <= 0) g.upFx = null;

  // 파티클/이펙트는 어느 상태에서든 흐른다
  g.parts  = g.parts.filter(p=>{
    p.life -= dt; p.vy += 900*dt; p.x += p.vx*dt; p.y += p.vy*dt; return p.life > 0;
  });
  g.shells = g.shells.filter(s=>{
    s.life -= dt; s.vy += 1100*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.r += s.vr*dt; return s.life > 0;
  });
  g.nums   = g.nums.filter(n=>{
    n.life -= dt; n.y += n.v*dt; n.v += 60*dt;
    if(n.pop) n.pop = Math.max(0, n.pop - dt*5);
    return n.life > 0;
  });
  g.pierceT = Math.max(0, g.pierceT - dt);
  // 약 71ms만 남겨 기관총 연사도 지속 레이저처럼 이어지지 않게 한다.
  g.tracers = g.tracers.filter(t=>{ t.life -= dt*14; return t.life > 0; });
  g.muzzleSmoke = g.muzzleSmoke.filter(smoke=>{
    smoke.life -= dt;
    smoke.x += smoke.vx*dt;
    smoke.y += smoke.vy*dt;
    smoke.vx *= Math.max(0, 1 - dt*2.4);
    smoke.vy -= 10*dt;
    smoke.radius += 24*dt;
    return smoke.life > 0;
  });

  if(phase !== 'playing') return;

  if(g.cool > 0) g.cool -= dt;
  if(g.reloadT > 0){
    g.reloadT -= dt;
    if(g.reloadT <= 0){ g.reloadT = 0; g.gun.ammo = g.gun.mag; }
  }
  if(mouse.down) fire();
  if(g.gun.ammo <= 0 && g.reloadT <= 0) tryReload();

  /* 스폰 — 한 번에 여러 마리씩 쏟아내 밀도를 만든다.
     동시 생존은 MAX_LIVE 로 묶는다. 웨이브 총량(후반 1000마리 이상)은 그대로 두고
     화면에 동시에 서 있는 수만 제한한다 — 죽는 대로 다음 놈이 밀려들어오니
     체감은 끊기지 않으면서, 700마리가 참호에 겹쳐 쌓여 프레임이 무너지는 걸 막는다. */
  if(g.queue.length && g.zombies.length < MAX_LIVE){
    g.spawnT -= dt;
    if(g.spawnT <= 0){
      // 마리수를 크게 늘린 만큼 한 번에 쏟는 양도 웨이브에 비례해 키운다.
      // 안 그러면 700마리가 찔끔찔끔 나와서 웨이브 하나가 몇 분씩 걸린다.
      let burst = 2 + Math.floor(g.wave / 2.5) + (rnd() < 0.6 ? 1 : 0)
                    + (rnd() < 0.4 ? 1 : 0);
      while(burst-- > 0 && g.queue.length && g.zombies.length < MAX_LIVE) spawn(g.queue.shift()!);
      g.spawnT = waveMul().gap * (0.7 + rnd()*0.6);
    }
  }

  // 방어선 상태 갱신
  g.works.forEach(wk=>{ wk.fx = Math.max(0, wk.fx - dt*2.4); });
  g.booms = g.booms.filter(b=>{ b.life -= dt*2.6; return b.life > 0; });

  // 좀비 전진 / 방어선·참호 공격
  g.zombies.forEach(z=>{
    z.flash = Math.max(0, z.flash - dt*6);
    z.swing = Math.max(0, z.swing - dt*4);
    if(z.dead) return;

    // 자기보다 앞에 있는 저지물 중 가장 먼 것이 지금 상대다.
    // 그게 부서지면 자동으로 다음 것, 마지막엔 내 참호가 된다.
    const wk = blockerFor(z);
    const stop = wk ? wk.d + 0.06 + z.jit : z.stand;

    // 지대를 통과하는 대가 — 종류별 행동은 BEHAVIOR 표가 안다
    let mul = 1;
    g.works.forEach(w=>{
      if(w.hp <= 0 || WORKS[w.kind].blocks) return;
      const bh = BEHAVIOR[w.kind];
      if(!bh.pass) return;
      if(Math.abs(z.d - w.d) > (bh.band ?? 0.34)) return;
      mul *= bh.pass(w, z, dt);
    });

    if(z.d > stop){                                 // 아직 전진 중
      const prev = z.d;
      z.d  -= z.spd * g.slow * mul * dt;
      if(z.type === 'walker')
        z.animT = (z.animT + dt * z.animSpeed) % (WALKER_VISUAL.cycleMs / 1000);
      else if(z.type === 'brute')
        z.animT = (z.animT + dt * BRUTE_VISUAL.playbackRate) % (BRUTE_VISUAL.cycleMs / 1000);
      else if(z.type === 'boss')
        z.animT = (z.animT + dt * BOSS_VISUAL.playbackRate) % (BOSS_VISUAL.cycleMs / 1000);
      z.ph += dt * (2.4 + z.spd*1.6) * mul;
      z.wx += Math.sin(g.t*1.3 + z.ph) * z.sway * dt * 0.35;
      z.wx = Math.max(-FUNNEL, Math.min(FUNNEL, z.wx));   // 통로 밖으로는 못 나간다
      // 이번 프레임에 선을 넘었으면 그 종류의 cross 행동을 부른다
      g.works.forEach(w=>{
        if(w.hp <= 0) return;
        const cross = BEHAVIOR[w.kind].cross;
        if(cross && prev > w.d && z.d <= w.d) cross(w, z);
      });
      if(z.d <= stop){ z.d = stop; z.melee = true; z.hitT = 0.45; }
    }else{                                          // 눈앞의 것을 때린다
      z.melee = true;
      z.ph += dt * 3.2;
      z.hitT -= dt;
      if(z.hitT <= 0){
        z.hitT = TYPES[z.type].hit;
        z.swing = 1;
        if(wk) hitWork(z, wk); else hitTrench(z);
      }
    }
  });
  g.zombies = g.zombies.filter(z=>!z.dead);
  g.works   = g.works.filter(w=>w.hp > 0);          // 부서진 방어선은 사라진다

  // 웨이브 클리어 → 상점
  if(phase === 'playing' && !g.queue.length && !g.zombies.length){
    g.inter += dt;
    if(g.inter > 0.7){
      g.inter = 0;
      const bonus = 16 + g.wave*6;                  // 웨이브 수당
      g.cash += bonus; g.earned += bonus; g.cashFx = 1;
      restock(); openShop();
    }
  }
}
