import { TYPES } from '../data/zombies';
import type { ZombieKind } from '../types';

/* ── 그리기 ────────────────────────────────────────────── */
export const mix = (a: number[],b: number[],t: number)=>`rgb(${a.map((v: number,i: number)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
export const FOG = [26, 32, 40];
export function fogT(d: number){ return Math.max(0, Math.min(0.72, (d - 1.6) / 8)); }

/* ── 색 캐시 ───────────────────────────────────────────────
   mix() 는 배열 map + join + 문자열 조립이라 한 번이 싸도 800마리 × 4색이면
   프레임마다 3천 번이다. 안개와 색조를 몇 단계로 뭉개서 만든 걸 재사용한다.
   눈으로는 구분이 안 가지만 할당이 사라진다. (4종 × 6색조 × 15안개 = 360개)
   ─────────────────────────────────────────────────────── */
type ZTone = { body: string; deep: string; head: string; dark: string };
type CTone = { body: string; head: string };
const ZCOL: Record<string, ZTone> = {};
const CCOL: Record<string, CTone> = {};
export function zColors(type: ZombieKind, hue: number, t: number){
  const hb = ((hue + 16) / 6) | 0, tb = (t * 14) | 0;
  const key = type + hb + '_' + tb;
  let c = ZCOL[key];
  if(!c){
    const T = TYPES[type], h = hb*6 - 16, tt = tb/14;
    c = ZCOL[key] = {
      body: mix(T.body.map((v: number) =>Math.max(0, v + h)), FOG, tt),
      deep: mix(T.body.map((v: number) =>Math.max(0, v*0.52 + h*0.5)), FOG, tt),
      head: mix(T.head.map((v: number) =>Math.max(0, v + h)), FOG, tt),
      dark: mix([14,16,14], FOG, tt*0.8),
    };
  }
  return c;
}
export function cColors(type: ZombieKind, hue: number, t: number){
  const hb = ((hue + 16) / 6) | 0, tb = (t * 14) | 0;
  const key = type + hb + '_' + tb;
  let c = CCOL[key];
  if(!c){
    const T = TYPES[type], h = hb*6 - 16, tt = tb/14;
    c = CCOL[key] = {
      body: mix(T.body.map((v: number) =>Math.max(0, v*0.66 + h - 14)), FOG, tt),
      head: mix(T.head.map((v: number) =>Math.max(0, v*0.66 + h - 14)), FOG, tt),
    };
  }
  return c;
}
