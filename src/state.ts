import { store } from './store';
import type { Game, Phase } from './types';

/* ══════════════════════════════════════════════════════════
   가변 상태를 담는 유일한 곳.
   원본은 `let phase`, `let g` 를 파일 전역에 두고 아무 데서나 대입했다
   (대입 지점이 13곳이었다). ES 모듈은 import 한 바인딩에 대입할 수 없어서,
   읽기는 live binding 으로 그대로 쓰고 쓰기는 setter 로만 하도록 좁혔다.
   덕분에 "누가 상태를 바꾸는가"가 grep 한 번에 나온다.

   이 모듈은 어떤 것도 import 하지 않는다(store, types 제외).
   여기서 다른 모듈을 부르면 거의 모든 모듈이 phase 를 쓰므로 순환이 생긴다.
   그래서 판을 새로 차리는 절차(newGame)는 game.ts 가 맡는다.
   ══════════════════════════════════════════════════════════ */

/* 갓 시작한 한 판. 순수 함수라 여기서 아무것도 부르지 않는다. */
export function createGame(seed: number): Game {
  return {
    seed,
    hp: 120, maxHp: 120, score: 0, kills: 0, wave: 0,
    bar: 420, barMax: 420,                       // 참호 내구도
    gun: {
      // 넓어진 전장에서도 좌우 표적 전환 중 화력이 끊기지 않도록 기본 지속화력을 보강한다.
      dmg: 15, rate: 7.0, mag: 40, ammo: 40, reload: 1.1, pierce: 1,
      crit: 0.03, head: 2.2, fall: 0.82,
      boom: 0,                                   // 파열탄 주변 피해
      shots: 1,                                  // 동시 발사
    },
    reloadT: 0, cool: 0, recoil: 0,
    steal: 0, slow: 1, armor: 1, repair: 0, spikes: 0,
    gunUps: 0, trUps: 0, upFx: null,             // 강화 횟수 / 강화 피드백
    branch: null,                                // 총기 계열 — 5회 강화 시점에 갈린다
    combo: 0, comboT: 0,
    cash: 130, earned: 0, bought: {},            // 보유 금액 / 누적 수입 / 항목별 구매 횟수
    works: [], stock: [], pick: null,            // 설치한 방어선 / 상점 진열 / 설치 대기 중인 것
    zombies: [], corpseQ: [], corpseN: 0,
    parts: [], shells: [], nums: [], tracers: [], muzzleSmoke: [], booms: [],
    tallyN: null,                                // 지금 커지고 있는 누적 데미지 숫자
    queue: [], spawnT: 0, inter: 0, waveTxt: 0, waveTotal: 0,
    shake: 0, flash: 0, hurtFx: 0, barFx: 0, hitMark: 0,
    t: 0, cashFx: 0, deny: 0, pierceT: 0,
    newBest: false, tip: 7.0,                    // tip = 첫 웨이브 조작 안내가 남은 시간
  };
}

/* 항상 유효한 판이 하나 있다.
   원본은 g 가 null 로 시작해서 그리기 함수마다 `g ? ... : ...` 가 붙어 있었다.
   부팅 직후 바로 한 판을 만들어 두면 그 분기가 전부 사라진다.
   씨앗 1 은 자리만 채우는 값이다 — main.ts 가 곧 newGame() 으로 갈아치운다. */
export let g: Game = createGame(1);
export function setGame(next: Game): void { g = next; }

export let phase: Phase = 'menu';
export function setPhase(next: Phase): void { phase = next; }

export let best = +(store.get('trench_best') || 0);
export function setBest(next: number): void {
  best = next;
  store.set('trench_best', String(next));
}
