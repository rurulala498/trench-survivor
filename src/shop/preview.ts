import { rnd } from '../rng';
import { applyEffects } from '../data/effects';
import { g } from '../state';
import type { EffectTarget, ShopItem, Upgrade } from '../types';

/* ── 업그레이드 ────────────────────────────────────────── */
/* 가중치를 반영해 하나 뽑아 배열에서 제거 */
export function wpick(arr: Upgrade[]){
  let total = 0;
  for(const c of arr) total += c.w || 1;
  let r = rnd() * total;
  for(let i=0;i<arr.length;i++){
    r -= arr[i].w || 1;
    if(r <= 0) return arr.splice(i, 1)[0];
  }
  return arr.splice(arr.length - 1, 1)[0];
}
/* ── 카드 효과 미리보기 ────────────────────────────────────
   "데미지 +30%" 만 보여주면 14 가 18 이 되는 걸 플레이어가 암산해야 한다.
   카드마다 설명을 따로 적어두는 대신, 상태 사본에 f() 를 실제로 돌려보고
   달라진 값만 집어낸다 — 업그레이드를 추가해도 여기는 손댈 필요가 없다. */
const PV: Array<[string, (p: EffectTarget) => string]> = [
  ['데미지',    (p: EffectTarget) =>p.gun.dmg.toFixed(1)],
  ['연사',      (p: EffectTarget) =>p.gun.rate.toFixed(2) + '/s'],
  ['탄창',      (p: EffectTarget) =>p.gun.mag + '발'],
  ['재장전',    (p: EffectTarget) =>p.gun.reload.toFixed(2) + '초'],
  ['관통',      (p: EffectTarget) =>(1 + p.gun.pierce) + '명'],
  ['동시 발사', (p: EffectTarget) =>p.gun.shots + '발'],
  ['파열',      (p: EffectTarget) =>String(Math.round(p.gun.boom))],
  ['치명타',    (p: EffectTarget) =>Math.round(p.gun.crit*100) + '%'],
  ['헤드샷',    (p: EffectTarget) =>'x' + p.gun.head.toFixed(1)],
  ['관통 유지', (p: EffectTarget) =>Math.round(p.gun.fall*100) + '%'],
  ['내구도',    (p: EffectTarget) =>String(Math.round(p.barMax))],
  ['최대 체력', (p: EffectTarget) =>String(Math.round(p.maxHp))],
  ['적 속도',   (p: EffectTarget) =>Math.round(p.slow*100) + '%'],
  ['받는 피해', (p: EffectTarget) =>Math.round(p.armor*100) + '%'],
  ['자동 수리', (p: EffectTarget) =>Math.round((0.14 + p.repair)*100) + '%'],
  ['반사 피해', (p: EffectTarget) =>String(Math.round(p.spikes))],
];
/* 실제 g 를 건드리지 않고 효과 함수를 돌려보기 위한 사본.
   works 는 얕게 복사한다 — 효과가 배열 자체를 바꾸지는 않는다. */
function probe(): EffectTarget {
  return {gun: Object.assign({}, g.gun), barMax: g.barMax, bar: g.bar,
          maxHp: g.maxHp, hp: g.hp, slow: g.slow, armor: g.armor,
          repair: g.repair, spikes: g.spikes, steal: g.steal,
          works: g.works.slice()};
}
export interface PvRow { label: string; from: string; to: string }
export function previewOf(c: ShopItem): PvRow[] {
  if(!c.fx) return [];
  const a = probe(), b = probe();
  applyEffects(b, c.fx);
  const out: PvRow[] = [];
  PV.forEach(([label, fmt])=>{
    const from = fmt(a), to = fmt(b);
    if(from !== to) out.push({label, from, to});
  });
  return out.slice(0, 2);
}
