import type { ZombieKind, ZombieType } from '../types';

/* ── 좀비 종류 ─────────────────────────────────────────── */
/* dmg = 참호를 한 번 후려칠 때 깎이는 내구도, hit = 공격 간격(초)
   cash = 처치 현상금, bar = 체력바 표시(한두 방에 터지는 놈은 막대가 소음이다)
   넓어진 전장에서 조준 이동 시간이 늘어난 만큼 이동속도와 근접 피해를 완화했다. */
export const TYPES: Record<ZombieKind, ZombieType> = {
  walker: {hp: 13,  spd: 0.76, sz: 1.00, body:[86,104,72],  head:[150,158,120],
           score: 10,  dmg: 3.0, hit: 1.10, cash: 3,   bar: false, barCol: '#d9483a'},
  runner: {hp: 9,   spd: 1.72, sz: 0.88, body:[126,68,58],  head:[176,120,96],
           score: 16,  dmg: 2.2, hit: 0.65, cash: 5,   bar: false, barCol: '#d9483a'},
  brute:  {hp: 80,  spd: 0.44, sz: 1.55, body:[70,84,88],   head:[128,138,132],
           score: 45,  dmg: 9,   hit: 1.60, cash: 15,  bar: true,  barCol: '#e0824a'},
  boss:   {hp: 480, spd: 0.37, sz: 2.30, body:[54,42,58],   head:[122,88,110],
           score: 250, dmg: 15,  hit: 1.90, cash: 100, bar: true,  barCol: '#c94ff0', boss: true},
};
/* 웨이브 보스로 쓸 종류 — 종류가 늘어도 waves.ts 를 고치지 않게 데이터에서 찾는다 */
export const BOSS_KINDS = (Object.keys(TYPES) as ZombieKind[]).filter(k => TYPES[k].boss);
