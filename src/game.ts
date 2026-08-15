import { clearGore } from './render/gore';
import { restock } from './shop/shop';
import { nextWave } from './sim/waves';
import { makeSeed, setSeed } from './rng';
import { createGame, setGame, setPhase } from './state';

/* 판 하나를 새로 차린다.
   state.ts 가 이걸 못 갖는 이유는 순환 때문이다 — restock/nextWave/clearGore 가
   모두 g 를 읽으므로, phase 가 그들을 import 하면 고리가 닫힌다.
   그래서 "상태를 담는 곳"과 "상태를 세우는 절차"를 나눴다. */
export function newGame(seed?: number): void {
  /* 씨앗을 먼저 심어야 한다 — restock(진열 뽑기)과 nextWave(스폰 구성)가
     바로 난수를 쓰므로, 순서가 뒤바뀌면 같은 씨앗이 다른 판을 만든다. */
  const s = seed ?? urlSeed() ?? makeSeed();
  setSeed(s);
  setGame(createGame(s));
  clearGore();
  restock();
  nextWave();
}

/* ?seed=123 으로 판을 고정할 수 있다 — 버그 재현과 밸런스 비교에 쓴다 */
function urlSeed(): number | null {
  if(typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('seed');
  if(v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? (n | 0) : null;
}

/* 메뉴에서 시작 / 게임오버에서 재시작 */
export function startGame(): void {
  newGame();
  setPhase('playing');
}
