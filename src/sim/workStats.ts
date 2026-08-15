import { WORKS } from '../data/works';
import { inflation, workHpMul } from '../progress';
import type { Work, WorkKind } from '../types';

/* 방어선 등급별 성능. 보강할 때마다 내구도(지뢰는 발수)와 효과가 같이 오른다. */
export function workMax(kind: WorkKind, lv: number){
  return Math.round(WORKS[kind].hp * workHpMul() * (1 + (lv - 1) * 0.85));
}
// slow / boom 이 없는 종류에도 안전하게 답한다 — 없으면 감속 없음(1) / 폭발 없음(0)
export function workSlow(w: Work){
  const s = WORKS[w.kind].slow;
  return s == null ? 1 : Math.max(0.16, s - ((w.lv||1) - 1) * 0.09);
}
export function workBoom(w: Work){
  return (WORKS[w.kind].boom || 0) * (1 + ((w.lv||1) - 1) * 0.5);
}
export function workArmor(w: Work){ return (WORKS[w.kind].armor || 1) * (1 - ((w.lv||1) - 1) * 0.14); }
export function boostCost(w: Work){
  return Math.round((70 + WORKS[w.kind].c * 0.55) * Math.pow(1.7, w.lv - 1) * inflation());
}
