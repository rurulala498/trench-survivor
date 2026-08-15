import { sfxHit, sfxHurt, sfxThud } from '../audio';
import { WORKS } from '../data/works';
import { TYPES } from '../data/zombies';
import { g } from '../state';
import { blood, hurtZombie, pushNum, setBoomLeft, tally } from './combat';
import { box, projS, projX, projY } from './projection';
import { workArmor, workBoom } from './workStats';
import type { Work, Zombie } from '../types';

/* 좀비가 앞에 둔 저지물 중 가장 먼 것 — 그게 지금 부숴야 하는 것이다 */
export function blockerFor(z: Zombie){
  let best = null;
  for(const wk of g.works){
    if(wk.hp <= 0 || !WORKS[wk.kind].blocks) continue;
    if(wk.d >= z.d - 0.02) continue;                // 이미 지나온 것
    if(!best || wk.d > best.d) best = wk;
  }
  return best;
}
/* 방어선을 때린다 — 참호와 달리 내 체력은 깎이지 않는다 */
export function hitWork(z: Zombie, wk: Work){
  const raw = TYPES[z.type].dmg * 1.15;
  wk.hp -= raw * workArmor(wk);
  wk.fx = 1;
  const b = box(z);
  blood(b.cx, projY(wk.d) - 8, 5, projS(wk.d));
  sfxThud();
  if(g.spikes > 0) hurtZombie(z, Math.round(g.spikes*0.6), b.cx, b.fy - b.h*0.35, false, false);
  if(wk.hp <= 0){                                   // 돌파 — 뒤에 남은 놈들이 다시 밀려온다
    g.shake = Math.max(g.shake, 12);
    sfxHurt();
    pushNum({x: projX(0, wk.d), y: projY(wk.d) - 30, v: -40, life: 1.4, pop: 0,
                 txt: WORKS[wk.kind].n + ' 돌파', c: '#ff8a6a'});
  }
}
/* 지뢰 — 밟은 놈과 주변을 함께 날린다 */
export function blowMine(wk: Work, z: Zombie){
  wk.hp -= 1; wk.fx = 1;
  setBoomLeft(2);                                   // 지뢰로 죽은 놈도 파열탄을 부를 수 있다
  const W2 = WORKS.mine;
  const x = projX(z.wx, wk.d), y = projY(wk.d);
  g.booms.push({x, y, s: projS(wk.d), life: 1});
  g.shake = Math.max(g.shake, 8);
  sfxThud(); sfxHit();
  let sum = 0;
  const power = workBoom(wk), reach = (W2.splash ?? 0.5) * (1 + ((wk.lv||1) - 1) * 0.3);
  g.zombies.forEach(o=>{
    if(o.dead) return;
    if(Math.abs(o.d - wk.d) > reach || Math.abs(o.wx - z.wx) > reach*1.6) return;
    const ob = box(o);
    const dmg = Math.round(power * (o === z ? 1 : 0.6));
    sum += dmg;
    hurtZombie(o, dmg, ob.cx, ob.cy, false, false);
  });
  if(sum > 0) tally(sum, x, y - 34, false, false);
  blood(x, y - 10, 14, projS(wk.d));
}

