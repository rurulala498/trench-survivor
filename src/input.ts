import { audioInit } from './audio';
import { cv } from './canvas';
import { startGame } from './game';
import { mouse, toLocal } from './mouse';
import { BR_KEYS, BTN_GO, BTN_REROLL, brHover, cardHover, inBtn } from './render/layout';
import { boostAt, cancelPlace, nearestSlot, placeAt } from './shop/build';
import { buy, closeShop, openShop, pickBranch, reroll, shopItems } from './shop/shop';
import { fire, tryReload } from './sim/combat';
import { phase } from './state';

/* ══════════════════════════════════════════════════════════
   입력만 모은 곳.
   원본은 리스너가 파일 세 군데에 흩어져 있었고(마우스 이동/누름, 키보드,
   그리고 한참 아래의 상점 클릭), 화면 단계별 분기가 각각 안에 있었다.
   여기 모아두면 "이 키가 이 화면에서 무엇을 하는가"를 한 화면에서 볼 수 있다.
   ══════════════════════════════════════════════════════════ */

function onClick(): void {
  if (phase === 'menu' || phase === 'gameover') { startGame(); return; }
  if (phase === 'playing') fire();
}

export function bindInput(): void {
  cv.addEventListener('mousemove', toLocal);
  cv.addEventListener('mousedown', e => {
    toLocal(e);
    mouse.down = true;
    audioInit();          // 첫 클릭에서 오디오 컨텍스트를 깨운다
    onClick();
  });
  addEventListener('mouseup', () => { mouse.down = false; });

  /* 우클릭 — 기본 메뉴는 막고, 설치/보강 중이면 취소 출구로 쓴다 */
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (phase === 'place' || phase === 'boost') cancelPlace();
  });

  /* 상점·설치·계열 화면의 클릭 판정.
     판정 사각형은 render/layout 이 갖고 있어서 그리기와 절대 어긋나지 않는다. */
  cv.addEventListener('mousedown', () => {
    if (phase === 'place') { placeAt(nearestSlot(mouse.y, 'free')); return; }
    if (phase === 'boost') { boostAt(nearestSlot(mouse.y, 'used')); return; }
    if (phase === 'branch') {
      for (let i = 0; i < BR_KEYS.length; i++) {
        if (brHover(i)) { pickBranch(BR_KEYS[i]!); return; }
      }
      return;
    }
    if (phase !== 'shop') return;
    if (inBtn(BTN_GO)) { closeShop(); return; }
    if (inBtn(BTN_REROLL)) { reroll(); return; }
    const items = shopItems();
    for (let i = 0; i < items.length && i < 12; i++) {
      if (cardHover(i)) { buy(items[i]); return; }
    }
  });

  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();

    if (phase === 'branch') {          // 계열은 반드시 골라야 넘어간다
      if (k === '1') pickBranch('rate');
      if (k === '2') pickBranch('pierce');
      return;
    }
    if (phase === 'place' || phase === 'boost') {   // 자리 고르기가 전부
      if (k === 'escape' || k === 'b') cancelPlace();
      if (k === '1' || k === '2' || k === '3') {
        const i = +k - 1;
        if (phase === 'boost') boostAt(i); else placeAt(i);
      }
      return;
    }
    if (phase === 'shop') {
      if (k === 'escape' || k === 'enter' || k === 'b' || k === ' ') {
        e.preventDefault();
        closeShop();
      }
      if (k === 'r') reroll();
      if ('123456789'.includes(k) && k !== '0') buy(shopItems()[+k - 1]);
      return;
    }

    if (k === 'r') tryReload();
    if (k === 'b' && phase === 'playing') { openShop(); return; }
    if (k === ' ') { e.preventDefault(); onClick(); }
    if (phase !== 'playing' && (k === 'enter' || k === ' ')) onClick();
  });
}
