import type { Branch, BranchKey } from '../types';

/* ── 강화 단계 이름 (3회 강화마다 외관이 바뀐다) ───────── */
/* 총기는 5회마다, 참호는 3회마다 한 단계 올라간다.
   총기는 1단계(5회)에서 계열이 갈리고, 그 뒤로는 고른 계열의 이름과 외형을 쓴다. */
export const GUN_STEP = 5, TR_STEP = 3;
export const gunTier = (n: number) => Math.min(4, Math.floor(n / GUN_STEP));
export const trTier  = (n: number) => Math.min(3, Math.floor(n / TR_STEP));
export const TR_TIER = ['흙 참호', '판자 보강 참호', '철판 방벽 참호', '요새화 참호'];

/* ── 총기 계열 (테크트리) ──────────────────────────────────
   5회 강화 시점에 한 번 갈라지고 되돌릴 수 없다.
   계열은 이름·외형뿐 아니라 단계 통과 보너스와 상점 진열까지 바꾼다.
   ─────────────────────────────────────────────────────── */
export const BRANCH: Record<BranchKey, Branch> = {
  rate: {
    n:'연사 계열', i:'⚡', col:'#e0a24a', rgb:'224,162,74',
    d:'총열을 늘려 한 번에 여러 발을 뿌린다',
    sub:'2단계부터 동시 발사 +1발 · 단계마다 연사 +12%',
    tiers:['제식 소총', '속사형 개조', '분대지원화기', '기관 포탑', '회전 다연장'],
    /* 연사만 올리면 통로에서 관통 계열을 절대 못 따라간다(자동플레이 16 vs 37웨이브).
       관통이 "한 줄을 꿰뚫어" 표적 수를 곱하듯, 연사는 "여러 줄에 동시에 뿌려서"
       표적 수를 곱해야 대칭이 된다. 그려둔 곁 총열이 실제로 일하게 만든다. */
    up: [{stat:'gun.rate', op:'mul', v:1.12}],
    atTier: {
      2: [{stat:'gun.shots', op:'add', v:1}],
      3: [{stat:'gun.shots', op:'add', v:1}],
      4: [{stat:'gun.shots', op:'add', v:1}, {stat:'gun.mag', op:'add', v:30}],
    },
  },
  pierce: {
    n:'관통 계열', i:'🎯', col:'#c96a4a', rgb:'201,106,74',
    d:'한 발로 줄줄이 꿰뚫는다',
    sub:'단계마다 관통 +1 · 관통·파열 품목이 진열된다',
    tiers:['제식 소총', '관통형 개조', '대물 소총', '열선 관통포', '파열 관통포'],
    up: [{stat:'gun.pierce', op:'add', v:1}],
    atTier: { 4: [{stat:'gun.boom', op:'add', v:20}] },
  },
};
