import type { Effect, EffectAct, EffectTarget, GunKey, StatPath, TopKey } from '../types';

/* ══════════════════════════════════════════════════════════
   효과를 코드가 아니라 데이터로 적는다.

   예전에는 항목마다 클로저였다:
       f: g => g.gun.dmg *= 1.30
   짧아서 좋았지만 함수 안에 갇혀 있어서 —
     · 들여다볼 수 없다 (무엇을 얼마나 바꾸는지 읽어낼 방법이 없다)
     · 순서를 정하거나 되돌릴 수 없다
     · JSON 으로 뺄 수 없다 → 서버에서 밸런스를 받아올 수 없다
     · "×1.30 인가 +12 인가" 가 각 클로저에 흩어져 중첩 규칙이 안 보인다

   지금은 이렇게 적는다:
       fx: [{ stat: 'gun.dmg', op: 'mul', v: 1.30 }]
   어휘를 일부러 작게 뒀다 — 실제로 필요한 건 곱하기·더하기·대입,
   그리고 상한 처리뿐이다. 스탯으로 표현이 안 되는 것(방어선 일괄 수리)만
   이름 붙인 동작(act)으로 남겼다.
   ══════════════════════════════════════════════════════════ */

function read(t: EffectTarget, p: StatPath): number {
  if(p.startsWith('gun.')) return t.gun[p.slice(4) as GunKey];
  return t[p as TopKey];
}
function write(t: EffectTarget, p: StatPath, v: number): void {
  if(p.startsWith('gun.')) t.gun[p.slice(4) as GunKey] = v;
  else t[p as TopKey] = v;
}

/* 스탯이 아닌 동작들 */
const ACTS: Record<EffectAct, (t: EffectTarget, amount: number) => void> = {
  /* 설치한 방어선을 비율만큼 수리한다 */
  repairWorks(t, amount){
    t.works.forEach(w => { w.hp = Math.min(w.max, w.hp + w.max * amount); });
  },
};

/* 효과를 적힌 순서대로 적용한다.
   순서가 의미를 갖는 경우가 있다 — 통나무 보강은 barMax 를 먼저 올리고
   그 다음 bar 를 barMax 로 채운다. 배열 순서가 그걸 그대로 표현한다. */
export function applyEffects(t: EffectTarget, fx: Effect[] | undefined): void {
  if(!fx) return;
  for(const e of fx){
    if(e.act){ ACTS[e.act](t, e.amount ?? 0); continue; }
    if(!e.stat || !e.op) continue;
    const cur = read(t, e.stat);
    const v = e.ofStat != null ? read(t, e.ofStat) : (e.v ?? 0);
    let next = e.op === 'mul' ? cur * v : e.op === 'add' ? cur + v : v;
    if(e.max != null) next = Math.min(e.max, next);
    if(e.maxOf != null) next = Math.min(read(t, e.maxOf), next);
    write(t, e.stat, next);
  }
}

/* 사람이 읽는 한 줄로 풀어준다 — 디버그·검증용.
   설명문(d)을 손으로 적는 대신 여기서 만들 수도 있지만, 지금 설명문은
   "관통 +1 · 겹친 좀비를 뚫는다" 처럼 맛을 담고 있어 그대로 둔다. */
export function describeEffect(e: Effect): string {
  if(e.act) return `${e.act}(${e.amount})`;
  if(!e.stat) return '?';
  const rhs = e.ofStat ?? String(e.v);
  const sign = e.op === 'mul' ? '×' : e.op === 'add' ? '+' : '=';
  const cap = e.max != null ? ` (최대 ${e.max})` : e.maxOf ? ` (최대 ${e.maxOf})` : '';
  return `${e.stat} ${sign}${rhs}${cap}`;
}

