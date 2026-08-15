import { REBUY } from '../data/upgrades';
import { inflation } from '../progress';
import { g } from '../state';
import type { ShopItem } from '../types';

export function costOf(it: ShopItem){
  if(!it) return 0;
  const n = g.bought[it.n] || 0;
  const rebuy = Math.pow(it.svc || it.wk ? 1.12 : REBUY, n);
  return Math.round((it.c ?? 0) * rebuy * inflation());
}
export function rerollCost(){ return Math.round((28 + g.wave*5) * Math.pow(1.06, Math.max(0, g.wave-1))); }
