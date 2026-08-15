import { W } from '../config';
import { mouse } from '../mouse';
import type { BranchKey, Rect } from '../types';

/* 상점 칸의 사각형은 한 곳에서만 계산한다 —
   그리기와 클릭 판정이 어긋나면 호버는 켜지는데 클릭이 안 먹는 띠가 생긴다. */
/* 4열 3행 = 12칸. 진열 6 + 방어선 3 + 보급 2 를 한 화면에 다 올리려면
   3열로는 마지막 줄이 화면 밖으로 나간다. */
const CARD = {w: 286, h: 132, gx: 16, gy: 14, y: 196, cols: 4};
export function cardRect(i: number){
  const col = i % CARD.cols, rowi = (i / CARD.cols) | 0;
  const x0 = W/2 - (CARD.w*CARD.cols + CARD.gx*(CARD.cols-1))/2;
  return {x: x0 + col*(CARD.w + CARD.gx), y: CARD.y + rowi*(CARD.h + CARD.gy),
          w: CARD.w, h: CARD.h};
}
export function cardHover(i: number){
  const r = cardRect(i);
  return mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h;
}
export const BTN_GO     = {x: W/2 + 156, y: 636, w: 200, h: 42};
export const BTN_REROLL = {x: W/2 - 356, y: 636, w: 200, h: 42};
export const inBtn = (b: Rect) => mouse.x > b.x && mouse.x < b.x+b.w && mouse.y > b.y && mouse.y < b.y+b.h;


/* ── 계열 선택 ─────────────────────────────────────────────
   총기 5회 강화에 딱 한 번 열린다. 되돌릴 수 없으니 두 장을 크게 놓고
   무엇이 달라지는지(단계 보너스 · 진열 품목)를 카드에 적어둔다.
   ─────────────────────────────────────────────────────── */
export const BR_KEYS: BranchKey[] = ['rate', 'pierce'];
export function brRect(i: number){ return {x: W/2 - 452 + i*472, y: 250, w: 432, h: 268}; }
export function brHover(i: number){
  const r = brRect(i);
  return mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h;
}
