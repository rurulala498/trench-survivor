import { applyEffects } from '../data/effects';
import { sfxClick, sfxWave } from '../audio';
import { BRANCH, GUN_STEP, TR_STEP, TR_TIER, gunTier, trTier } from '../data/branches';
import { GUN_UP, SERVICES, TRENCH_UP } from '../data/upgrades';
import { SLOTS, WORKS, WORK_LV_MAX } from '../data/works';
import { gunName } from '../progress';
import { nextWave } from '../sim/waves';
import { boostCost } from '../sim/workStats';
import { g, phase, setPhase } from '../state';
import { costOf, rerollCost } from './economy';
import { wpick } from './preview';
import type { BranchKey, ShopItem, WorkKind } from '../types';

/* ── 상점 ──────────────────────────────────────────────────
   웨이브가 끝나면 열리고, 전투 중에도 B 로 열 수 있다.
   돈이 되는 만큼 몇 개든 산다 — 웨이브당 한 장만 고르던 제약이 없어졌으므로,
   비싼 걸 노려 아끼는 선택이 생긴다.
   ─────────────────────────────────────────────────────── */

/* 진열 — 총기 3 + 참호 3 을 가중치로 뽑고, 설치물과 서비스는 항상 판다.
   sold 는 원본 배열의 객체에 붙으므로 새로 채울 때 반드시 지운다. */
export function restock(){
  GUN_UP.forEach(it=>{ it.sold = false; });
  TRENCH_UP.forEach(it=>{ it.sold = false; });
  // 계열 전용 품목은 그 계열을 골라야 진열에 낀다
  const guns = GUN_UP.filter(it=>!it.br || it.br === g.branch);
  const trs = TRENCH_UP.slice();
  g.stock = [wpick(guns), wpick(guns), wpick(guns),
             wpick(trs),  wpick(trs),  wpick(trs)];
}
export const BOOST: ShopItem = {n:'방어선 보강', i:'🔨', k:'bo',
               d:'설치한 방어선 하나를 한 등급 올린다 · 전량 수리'};
export function shopItems(): ShopItem[] {
  const kinds = Object.keys(WORKS) as WorkKind[];
  const cards: ShopItem[] = kinds.map(k => ({...WORKS[k], k: 'wk', wk: k}));
  return (g.stock as ShopItem[]).concat(cards, [BOOST], SERVICES);
}
/* 보강할 수 있는 방어선이 남았는지 */
export function boostable(){ return g.works.filter(w=>(w.lv || 1) < WORK_LV_MAX); }
export function boostPrice(){
  const list = boostable();
  if(!list.length) return 0;
  return Math.min.apply(null, list.map(boostCost));
}
export function openShop(){
  g.pick = null;
  setPhase('shop');
  sfxClick(520, 0.06);
}
export function closeShop(){
  // 웨이브가 비었을 때 닫으면 다음 웨이브가 시작된다. 전투 중에 열었던 거면 그냥 복귀.
  // 탄창을 채워주는 것도 이때만 — 전투 중에 열어 채우면 무한 탄창이 된다.
  const cleared = !g.queue.length && !g.zombies.length;
  setPhase('playing');
  if(cleared){ g.gun.ammo = g.gun.mag; g.reloadT = 0; nextWave(); }
}

export function buy(it: ShopItem){
  if(!it || it.sold) return;

  if(it.k === 'bo'){                              // 방어선 보강 — 어느 걸 올릴지 찍는다
    const list = boostable();
    if(!list.length){ g.deny = 1; sfxClick(150, 0.07); return; }
    if(g.cash < boostPrice()){ g.deny = 1; sfxClick(150, 0.07); return; }
    g.pick = it; setPhase('boost'); sfxClick(700, 0.07);
    return;
  }
  const price = costOf(it);
  if(g.cash < price){ g.deny = 1; sfxClick(150, 0.07); return; }

  if(it.k === 'wk'){                              // 설치물은 자리를 찍어야 산 게 된다
    if(g.works.length >= SLOTS.length){ g.deny = 1; sfxClick(150, 0.07); return; }
    g.pick = it; setPhase('place'); sfxClick(700, 0.07);
    return;
  }
  g.cash -= price;
  g.bought[it.n] = (g.bought[it.n] || 0) + 1;
  applyEffects(g, it.fx);
  sfxClick(680, 0.09);

  if(it.svc) return;
  it.sold = true;                                 // 진열품은 하나씩만
  // 트랙별 강화 횟수 — 총기는 5회, 참호는 3회마다 단계가 오른다
  const isGun = it.k === 'gun';
  const step0 = isGun ? GUN_STEP : TR_STEP;
  const tf    = isGun ? gunTier : trTier;
  const n     = isGun ? ++g.gunUps : ++g.trUps;
  const step  = n % step0 || step0;
  const tier  = tf(n);
  const up    = tier > tf(n - 1);

  // 단계를 넘으면 계열 보너스가 붙는다 (연사 계열 연사↑ / 관통 계열 관통↑)
  if(up && isGun && g.branch) applyBranchTier(g.branch, tier);

  g.upFx = {
    life: up ? 2.8 : 1.4, k: it.k!, tierUp: up, step, total: step0,
    label: up ? (isGun ? gunName() : TR_TIER[tier]!) : it.n,
    sub:   up ? (isGun ? '총기 외형이 바뀌었다' : '참호 구조가 바뀌었다')
              : (isGun ? '총기' : '참호') + ' 강화  ' + step + ' / ' + step0,
  };
  if(up){ sfxWave(); g.shake = 14; }

  // 총기 1단계에 도달하면 계열을 고른다 — 되돌릴 수 없는 한 번의 갈림길
  if(isGun && !g.branch && g.gunUps >= GUN_STEP){ g.upFx = null; setPhase('branch'); }
}
/* 계열 단계 보너스 — 매 단계 공통(up) + 그 단계 전용(atTier) */
function applyBranchTier(k: BranchKey, tier: number): void {
  const B = BRANCH[k];
  applyEffects(g, B.up);
  applyEffects(g, B.atTier?.[tier]);
}
export function pickBranch(k: BranchKey){
  if(phase !== 'branch' || !BRANCH[k]) return;
  g.branch = k;
  const t = gunTier(g.gunUps);
  applyBranchTier(k, t);                          // 1단계 보너스를 지금 준다
  restock();                                      // 계열 전용 품목이 진열에 들어온다
  g.upFx = {life: 2.8, k: 'gun', tierUp: true, step: GUN_STEP, total: GUN_STEP,
            label: gunName(), sub: BRANCH[k].n + ' 로 갈라졌다'};
  sfxWave(); g.shake = 16;
  setPhase('shop');
}
export function reroll(){
  const price = rerollCost();
  if(g.cash < price){ g.deny = 1; sfxClick(150, 0.07); return; }
  g.cash -= price; restock(); sfxClick(600, 0.08);
}
