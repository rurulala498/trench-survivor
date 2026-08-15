import { BRANCH, gunTier } from './data/branches';
import { g } from './state';

/* 지금 총 이름 */
export function gunName(){
  const t = gunTier(g.gunUps);
  return g.branch ? BRANCH[g.branch].tiers[t] : BRANCH.rate.tiers[0];
}

/* 물가 — 웨이브가 올라가면 부품값도 같이 오른다.
   수입은 마리수 증가 때문에 더 빠르게 늘어나므로(1→20웨이브에 약 40배),
   물가를 17%씩 복리로 올려도(20웨이브에 약 17배) 후반이 점점 풍족해진다.
   그 격차가 곧 "총이 괴물이 되는" 구간이다. */
const INFL = 1.17;
export function inflation(){ return Math.pow(INFL, Math.max(0, g.wave - 1)); }
/* 방어선 내구도 배수 — 설치하는 웨이브 기준으로 굳는다 */
export function workHpMul(){ return 1 + g.wave * 0.34; }
