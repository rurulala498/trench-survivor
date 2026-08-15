import { sfxClick, sfxWave } from '../audio';
import { SLOTS, WORKS, WORK_LV_MAX } from '../data/works';
import { defenseGroundY, projY } from '../sim/projection';
import { boostCost, workMax } from '../sim/workStats';
import { g, setPhase } from '../state';
import { costOf } from './economy';
import { BOOST } from './shop';
import type { WorkKind } from '../types';

/* ── 방어선 설치 ───────────────────────────────────────── */
function slotFree(i: number){ return !g.works.some(w=>w.slot === i); }

/* want='free' 면 빈 자리, 'used' 면 보강 가능한 자리를 고른다 */
export function nearestSlot(y: number, want: 'free' | 'used'){
  let bi = -1, bd = 1e9;
  SLOTS.forEach((sd, i)=>{
    let kind: WorkKind | undefined;
    if(want === 'used'){
      const w = g.works.find(o=>o.slot === i);
      if(!w || w.lv >= WORK_LV_MAX) return;
      kind = w.kind;
    }else if(!slotFree(i)) return;
    else kind = g.pick?.wk as WorkKind | undefined;
    const screenY = kind === 'mine' ? projY(sd) : defenseGroundY(sd);
    const dist = Math.abs(screenY - y);
    if(dist < bd){ bd = dist; bi = i; }
  });
  return bi;
}
export function placeAt(i: number){
  if(!g.pick || i < 0 || !slotFree(i)) return;
  const price = costOf(g.pick);
  if(g.cash < price){ g.deny = 1; return; }
  g.cash -= price;
  g.bought[g.pick.n] = (g.bought[g.pick.n] || 0) + 1;
  /* 내구도가 고정이면 1000마리가 몰려오는 후반엔 세우자마자 부서져서
     방어선이 초반 전용 장비가 돼버린다. 값이 오르는 만큼 튼튼해져야 한다. */
  const kind = g.pick.wk as WorkKind;
  const hp = workMax(kind, 1);
  g.works.push({kind, slot: i, d: SLOTS[i]!, lv: 1,
                hp, max: hp, hit: 0, fx: 0});
  g.works.sort((a,b)=>b.d - a.d);                 // 먼 것부터 — 좀비가 만나는 순서
  g.pick = null; setPhase('shop');
  sfxWave();
}
/* 방어선 보강 — 등급이 오르고 전량 수리된다 */
export function boostAt(i: number){
  if(i < 0) return;
  const w = g.works.find(o=>o.slot === i);
  if(!w || w.lv >= WORK_LV_MAX) return;
  const price = boostCost(w);
  if(g.cash < price){ g.deny = 1; sfxClick(150, 0.07); return; }
  g.cash -= price;
  g.bought[BOOST.n] = (g.bought[BOOST.n] || 0) + 1;
  w.lv++;
  w.max = workMax(w.kind, w.lv);
  w.hp = w.max;
  w.fx = 1;
  g.upFx = {life: 2.0, k: 'tr', tierUp: false, step: w.lv, total: WORK_LV_MAX,
            label: WORKS[w.kind].n + '  ' + WORKS[w.kind].lvName[w.lv - 1],
            sub: SLOTS[i].toFixed(1) + 'm 방어선 보강  ' + w.lv + ' / ' + WORK_LV_MAX};
  g.pick = null; setPhase('shop');
  sfxWave();
}
export function cancelPlace(){ g.pick = null; setPhase('shop'); sfxClick(220, 0.05); }
