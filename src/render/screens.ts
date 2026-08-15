import { ctx } from '../canvas';
import { FUNNEL, H, W } from '../config';
import { BRANCH } from '../data/branches';
import { SLOTS, WORKS, WORK_LV_MAX } from '../data/works';
import { mouse } from '../mouse';
import { inflation } from '../progress';
import { nearestSlot } from '../shop/build';
import { costOf, rerollCost } from '../shop/economy';
import { previewOf } from '../shop/preview';
import { boostPrice, boostable, shopItems } from '../shop/shop';
import { defenseGroundY, projS, projX, projY } from '../sim/projection';
import { boostCost, workMax } from '../sim/workStats';
import { best, g, phase } from '../state';
import { BR_KEYS, BTN_GO, BTN_REROLL, brHover, brRect, cardHover, cardRect, inBtn } from './layout';
import { C, font, keycap, plate } from './theme';
import { drawWork } from './works';
import type { Rect, WorkKind } from '../types';

/* ── 상점 화면 ─────────────────────────────────────────── */
export function drawShop(){
  const sc = ctx.createLinearGradient(0, 0, 0, H);
  sc.addColorStop(0, 'rgba(6,8,9,.92)');
  sc.addColorStop(0.62, 'rgba(6,8,9,.86)');
  sc.addColorStop(1, 'rgba(6,8,9,.95)');
  ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);

  const cleared = !g.queue.length && !g.zombies.length;
  ctx.textAlign = 'center';
  font(11, 600, 4.4); ctx.fillStyle = cleared ? C.hp : C.warn;
  ctx.fillText(cleared ? 'W A V E   ' + g.wave + '   C L E A R' : '전 투 중 · 보 급', W/2, 62);
  font(32, 800, 0.5); ctx.fillStyle = C.bone;
  ctx.fillText('보급창', W/2, 102);

  // 보유 금액 — 이 화면의 주인공이라 크게
  const cashW = 300;
  plate(W/2 - cashW/2, 122, cashW, 48, C.warn);
  font(11, 500, 1.2); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
  ctx.fillText('보유 자금', W/2 - cashW/2 + 18, 152);
  font(26, 800, 0); ctx.textAlign = 'right';
  ctx.fillStyle = g.cashFx > 0 ? '#ffe08a' : C.warn;
  ctx.fillText('₩' + g.cash, W/2 + cashW/2 - 18, 155);

  // 설치한 방어선 요약 — 무엇이 몇 겹 서 있는지
  ctx.textAlign = 'left';
  font(11, 500, 0.4); ctx.fillStyle = C.faint;
  ctx.fillText('전방 방어선  ' + g.works.length + ' / ' + SLOTS.length, W/2 - 356, 152);
  SLOTS.forEach((_sd, i)=>{
    const w = g.works.find(o=>o.slot === i);
    const bx = W/2 - 356 + i*54;
    ctx.beginPath(); ctx.roundRect(bx, 158, 48, 8, 2);
    ctx.fillStyle = w ? WORKS[w.kind].col[0] : 'rgba(198,184,142,.18)'; ctx.fill();
  });
  font(11, 500, 0.4); ctx.textAlign = 'right'; ctx.fillStyle = C.faint;
  ctx.fillText('누적 수입  ₩' + g.earned, W/2 + 356, 152);
  const infl = inflation();
  if(infl > 1.01){                                 // 물가가 올랐다는 걸 숨기지 않는다
    font(11, 700, 0.4); ctx.fillStyle = C.warn;
    ctx.fillText('물가  ×' + infl.toFixed(2), W/2 + 356, 132);
  }

  const items = shopItems();
  items.forEach((it, i)=>{
    if(i >= 12) return;
    const r = cardRect(i), hov = cardHover(i);
    const price = it.k === 'bo' ? boostPrice() : costOf(it);
    const own   = g.bought[it.n] || 0;
    const isGun = it.k === 'gun', isWk = it.k === 'wk', isSvc = !!it.svc, isBo = it.k === 'bo';
    const accent = isGun ? (it.br ? BRANCH[it.br].col : C.gun)
                 : isWk || isBo ? C.hp : isSvc ? C.warn : C.tr;
    const rgb    = isGun ? (it.br ? BRANCH[it.br].rgb : '224,130,74')
                 : isWk || isBo ? '111,192,138' : isSvc ? '224,179,63' : '95,159,201';
    const slotsFull = isWk && g.works.length >= SLOTS.length;
    const noBoost   = isBo && !boostable().length;
    const can = !it.sold && g.cash >= price && !slotsFull && !noBoost;

    ctx.save();
    ctx.translate(r.x, r.y - (hov && can ? 3 : 0));
    ctx.globalAlpha = it.sold ? 0.34 : (slotsFull || noBoost) ? 0.45 : 1;
    if(hov && can){ ctx.shadowColor = `rgba(${rgb},.4)`; ctx.shadowBlur = 20; }
    plate(0, 0, r.w, r.h, null,
          hov && can ? `rgba(${rgb.split(',').map(v=>Math.round(+v*0.22)).join(',')},.97)`
                     : 'rgba(13,15,17,.95)');
    ctx.shadowBlur = 0;
    if(hov && can){ ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.strokeRect(1,1,r.w-2,r.h-2); }
    ctx.fillStyle = accent; ctx.fillRect(9, 0, r.w - 9, 3);

    // 머리 — 분류 / 보유 수 / 단축키
    font(10, 700, 0.8); ctx.textAlign = 'left'; ctx.fillStyle = accent;
    // 계열 전용 품목은 분류를 계열 이름으로 보여준다 — 테크트리를 탔다는 표식
    ctx.fillText(it.br ? BRANCH[it.br].n : isGun ? '총기' : isWk ? '방어선'
                 : isBo ? '보강' : isSvc ? '보급' : '참호', 14, 21);
    if(own > 0){
      font(9, 500, 0.3); ctx.fillStyle = C.faint;
      ctx.fillText('보유 ' + own, it.br ? 74 : 58, 21);
    }
    keycap(r.w - 36, 7, String(i + 1), hov && can ? accent : C.faint, 22, 17);

    // 아이콘 + 이름
    if('filter' in ctx) ctx.filter = 'grayscale(.72) sepia(.32) saturate(1.25) brightness(1.05)';
    font(23, 400, 0); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(it.i, 14, 52);
    if('filter' in ctx) ctx.filter = 'none';
    font(16, 700, 0); ctx.fillStyle = C.bone;
    ctx.fillText(it.n, 46, 50);
    font(11, 400, 0.2); ctx.fillStyle = C.dust;
    wrapLeft(it.d, 14, 70, r.w - 28, 14);

    // 아래 한 줄에 가격과 수치 변화를 나란히 — 살까 말까를 여기서 판단한다
    ctx.fillStyle = 'rgba(198,184,142,.13)'; ctx.fillRect(14, 100, r.w - 28, 1);
    font(15, 800, 0); ctx.textAlign = 'left';
    ctx.fillStyle = it.sold ? C.faint : can ? C.warn : C.red;
    ctx.fillText(it.sold ? '품절' : slotsFull ? '자리 없음'
                 : noBoost ? '대상 없음' : '₩' + price, 14, 120);

    ctx.textAlign = 'right';
    if(isBo){
      font(10, 500, 0.3); ctx.fillStyle = C.faint;
      ctx.fillText(noBoost ? '설치한 방어선 없음'
                   : '보강 가능 ' + boostable().length + '곳', r.w - 14, 120);
    }else if(isWk){
      const kind = it.wk!;
      const W2 = WORKS[kind];
      const hp = workMax(kind, 1);
      font(10, 500, 0.3); ctx.fillStyle = C.faint;
      ctx.fillText(W2.hpName + ' ' + hp + W2.hpUnit
                   + (W2.blocks ? ' · 저지' : ' · 통과'), r.w - 14, 120);
    }else{
      const pv = previewOf(it);
      if(pv.length){
        const p = pv[0];
        font(13, 700, 0); ctx.fillStyle = accent;
        const wTo = ctx.measureText(p.to).width;
        ctx.fillText(p.to, r.w - 14, 120);
        font(10, 500, 0); ctx.fillStyle = 'rgba(167,157,132,.62)';
        ctx.fillText(p.label + '  ' + p.from + '  →', r.w - 18 - wTo, 120);
      }else{
        font(10, 500, 0.3); ctx.fillStyle = C.faint;
        ctx.fillText('즉시 적용', r.w - 14, 120);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  });

  // 버튼 둘
  shopBtn(BTN_REROLL, '진열 교체  ₩' + rerollCost(), g.cash >= rerollCost(), C.tr, 'R');
  shopBtn(BTN_GO, cleared ? '웨이브 ' + (g.wave+1) + ' 시작' : '전투 복귀', true, C.hp, 'Enter');

  font(11, 500, 0.8); ctx.textAlign = 'center'; ctx.fillStyle = C.faint;
  ctx.fillText('숫자키로 구매  ·  전투 중에도 B 로 이 화면을 연다  ·  돈은 다음 웨이브로 넘어간다', W/2, 706);

  if(g.deny > 0){                                  // 돈이 모자랄 때
    font(13, 700, 0.6); ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(217,72,58,${Math.min(1, g.deny)})`;
    ctx.fillText('자금 부족', W/2, 182);
  }
}
function shopBtn(b: Rect, label: string, on: boolean, col: string, hint: string){
  const hov = inBtn(b);
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4);
  ctx.fillStyle = on ? (hov ? `rgba(255,255,255,.10)` : 'rgba(255,255,255,.04)')
                     : 'rgba(255,255,255,.02)';
  ctx.fill();
  ctx.strokeStyle = on ? col : 'rgba(198,184,142,.18)'; ctx.lineWidth = hov && on ? 2 : 1;
  ctx.stroke();
  font(13, 700, 0.4); ctx.textAlign = 'center';
  ctx.fillStyle = on ? col : C.faint;
  ctx.fillText(label, b.x + b.w/2, b.y + 25);
  font(9, 500, 0.6); ctx.fillStyle = C.faint;
  ctx.fillText(hint, b.x + b.w/2, b.y + b.h + 12);
}
/* 좌측 정렬 줄바꿈 — 카드 설명이 두 줄까지 흐르게 */
function wrapLeft(txt: string, x: number, y: number, maxw: number, lh: number){
  const words = txt.split(' '); let line = '', yy = y;
  ctx.textAlign = 'left';
  words.forEach((w: string) =>{
    const test = line ? line + ' ' + w : w;
    if(ctx.measureText(test).width > maxw && line){ ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  });
  ctx.fillText(line, x, yy);
}


export function drawBranch(){
  const sc = ctx.createLinearGradient(0, 0, 0, H);
  sc.addColorStop(0, 'rgba(5,7,8,.93)');
  sc.addColorStop(1, 'rgba(5,7,8,.96)');
  ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  font(11, 600, 5); ctx.fillStyle = C.warn;
  ctx.fillText('총 기  1 단 계  도 달', W/2, 118);
  font(38, 800, 0.5); ctx.fillStyle = C.bone;
  ctx.fillText('계열을 고른다', W/2, 164);
  font(13, 500, 0.4); ctx.fillStyle = C.dust;
  ctx.fillText('한 번 고르면 되돌릴 수 없다 · 이후 강화 5회마다 이 계열의 다음 단계로 올라간다', W/2, 194);

  BR_KEYS.forEach((k, i)=>{
    const B = BRANCH[k], r = brRect(i), hov = brHover(i);
    ctx.save();
    ctx.translate(r.x, r.y - (hov ? 5 : 0));
    if(hov){ ctx.shadowColor = `rgba(${B.rgb},.5)`; ctx.shadowBlur = 30; }
    plate(0, 0, r.w, r.h, null,
          hov ? `rgba(${B.rgb.split(',').map((v: string) =>Math.round(+v*0.2)).join(',')},.97)`
              : 'rgba(13,15,17,.95)');
    ctx.shadowBlur = 0;
    if(hov){ ctx.strokeStyle = B.col; ctx.lineWidth = 2; ctx.strokeRect(1, 1, r.w-2, r.h-2); }
    ctx.fillStyle = B.col; ctx.fillRect(9, 0, r.w - 9, 3);

    if('filter' in ctx) ctx.filter = 'grayscale(.7) sepia(.3) saturate(1.3) brightness(1.05)';
    font(44, 400, 0); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(B.i, r.w/2, 84);
    if('filter' in ctx) ctx.filter = 'none';

    font(27, 800, 0.4); ctx.fillStyle = C.bone; ctx.fillText(B.n, r.w/2, 130);
    font(14, 500, 0.3); ctx.fillStyle = B.col;  ctx.fillText(B.d, r.w/2, 158);
    ctx.fillStyle = 'rgba(198,184,142,.14)'; ctx.fillRect(24, 178, r.w - 48, 1);
    font(12, 500, 0.2); ctx.fillStyle = C.dust;
    wrapLeft(B.sub, 24, 200, r.w - 48, 18);

    // 이 계열의 최종 형태까지 미리 보여준다
    font(10, 500, 0.4); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
    ctx.fillText(B.tiers.slice(1).join('  ›  '), 24, 246);
    keycap(r.w - 44, 16, String(i + 1), hov ? B.col : C.faint, 26, 20);
    ctx.restore();
  });

  font(12, 500, 1); ctx.textAlign = 'center'; ctx.fillStyle = C.faint;
  ctx.fillText('클릭 또는 1 / 2', W/2, 566);
}

/* ── 설치 화면 ─────────────────────────────────────────────
   상점을 살짝 덮고 실제 전장을 보여준다. 마우스 높이가 곧 거리라서
   화면 y 를 거리로 되돌려(yToD) 가까운 빈 자리를 집는다.
   ─────────────────────────────────────────────────────── */
export function drawPlace(){
  const it = g.pick; if(!it) return;
  const boost = phase === 'boost';
  // 설치 화면이면 pick 이 설치물 카드라 wk 가 반드시 있다
  const kind = it.wk as WorkKind;
  const W2 = boost ? null : WORKS[kind];
  ctx.fillStyle = 'rgba(6,8,9,.34)'; ctx.fillRect(0, 0, W, H);
  const sel = nearestSlot(mouse.y, boost ? 'used' : 'free');

  /* 띠를 먼저 다 깔고 미리보기를 그 위에 올린다.
     같은 루프에서 처리하면 앞 슬롯의 띠가 뒤 슬롯의 미리보기에 덮여 사라진다.
     라벨은 띠 왼쪽 끝에 붙인다 — 아래에 두면 원근 때문에 다음 띠와 겹친다. */
  SLOTS.forEach((sd, i)=>{
    const w = g.works.find(o=>o.slot === i);
    const ok = boost ? !!w && w.lv < WORK_LV_MAX : !w;
    const slotKind = boost ? w?.kind : kind;
    const y = slotKind === 'mine' ? projY(sd) : defenseGroundY(sd);
    const s = projS(sd);
    const xl = projX(-FUNNEL*1.05, sd), xr = projX(FUNNEL*1.05, sd);
    const on = ok && i === sel;
    ctx.fillStyle = !ok ? 'rgba(120,120,120,.10)'
                  : on  ? 'rgba(111,192,138,.26)' : 'rgba(111,192,138,.10)';
    ctx.beginPath();
    ctx.moveTo(xl, y - 4*s); ctx.lineTo(xr, y - 4*s);
    ctx.lineTo(xr + 8*s, y + 10*s); ctx.lineTo(xl - 8*s, y + 10*s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = !ok ? 'rgba(150,150,150,.3)'
                    : on ? '#6fc08a' : 'rgba(111,192,138,.4)';
    ctx.lineWidth = on ? 2 : 1; ctx.stroke();

    // 라벨 — 보강 화면에서는 지금 등급과 올라간 뒤를 같이 보여준다
    let label = (i+1) + ' · ' + sd.toFixed(1) + 'm';
    if(boost){
      label += w ? (w.lv >= WORK_LV_MAX ? '  최대 등급'
                    : '  ' + WORKS[w.kind].lvName[w.lv-1] + ' → ' + WORKS[w.kind].lvName[w.lv])
                 : '  비어 있음';
    }else if(w) label += '  사용 중';
    font(on ? 12 : 11, 700, 0.4); ctx.textAlign = 'right';
    ctx.fillStyle = !ok ? C.faint : on ? '#9fe8b8' : 'rgba(111,192,138,.78)';
    ctx.fillText(label, xl - 14*s - 6, y + 5);
  });
  if(sel >= 0 && !boost){                           // 고른 자리에만 반투명 미리보기
    const hp = workMax(kind, 1);
    drawWork({kind, slot: sel, d: SLOTS[sel]!, lv: 1, hp, max: hp, hit: 0, fx: 0}, 0.5);
  }

  // 안내
  const w = boost ? g.works.find(o=>o.slot === sel) : null;
  ctx.textAlign = 'center';
  font(11, 600, 4); ctx.fillStyle = C.hp;
  ctx.fillText(boost ? '보 강 대 상' : '설 치 위 치', W/2, 60);
  font(28, 800, 0.4); ctx.fillStyle = C.bone;
  ctx.fillText(boost ? (w ? WORKS[w.kind].n + '  ' + (w.lv+1) + '등급' : '방어선 보강') : W2!.n, W/2, 98);
  font(13, 500, 0.3); ctx.fillStyle = C.dust;
  ctx.fillText(boost
    ? (w ? '내구도 ' + Math.round(w.max) + ' → ' + workMax(w.kind, w.lv+1) + ' · 전량 수리' : it.d)
    : W2!.d, W/2, 124);
  font(12, 500, 0.8); ctx.fillStyle = C.faint;
  ctx.fillText('클릭 또는 1 / 2 / 3  ·  우클릭 · ESC 취소   ₩'
               + (boost ? (w ? boostCost(w) : boostPrice()) : costOf(it)), W/2, 152);
}


/* 스텐실 제목 — 어두운 사본을 아래로 깔고 그 위에 본색을 올려
   판에 찍어낸 것처럼 보이게 한다 */
function stencil(txt: string, cx: number, y: number, size: number, col: string, sp: number){
  font(size, 800, sp || 0); ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(txt, cx + 4, y + 5);
  ctx.fillStyle = 'rgba(20,10,8,.9)'; ctx.fillText(txt, cx + 1.5, y + 2);
  ctx.fillStyle = col;                 ctx.fillText(txt, cx, y);
}

export function drawMenu(){
  // 아래로 갈수록 옅게 — 참호가 뒤에서 살아있는 게 보이게
  const sc = ctx.createLinearGradient(0, 0, 0, H);
  sc.addColorStop(0,    'rgba(5,7,8,.88)');
  sc.addColorStop(0.72, 'rgba(5,7,8,.70)');
  sc.addColorStop(1,    'rgba(5,7,8,.86)');
  ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  stencil('참호 사수', W/2, 214, 84, C.red, 2);
  ctx.fillStyle = 'rgba(217,72,58,.45)';
  ctx.fillRect(W/2 - 170, 232, 340, 1);
  font(12, 600, 9); ctx.fillStyle = 'rgba(167,157,132,.85)';
  ctx.fillText('TRENCH SURVIVOR', W/2, 256);
  font(17, 500, 0.4); ctx.fillStyle = C.dust;
  ctx.fillText('참호로 몰려드는 좀비 떼를 쓸어버려라', W/2, 296);

  // 조작 — 키캡을 그려주면 글로만 적어둘 때보다 훨씬 빨리 읽힌다
  const px = W/2 - 300, py = 326;
  plate(px, py, 600, 96);
  const keys = [
    ['마우스', '조준',                0, 0],
    ['클릭',   '사격 (유지 시 연사)', 1, 0],
    ['R',      '재장전',              0, 1],
    ['B',      '보급창 열기',         1, 1],
  ];
  (keys as Array<[string, string, number, number]>).forEach(([k, label, col, rowi])=>{
    const kx = px + 28 + col*296, ky = py + 22 + rowi*38;
    const kw = k.length > 3 ? 62 : k.length > 1 ? 46 : 24;
    keycap(kx, ky, k, 'rgba(198,184,142,.5)', kw, 22);
    font(13, 500, 0.3); ctx.textAlign = 'left'; ctx.fillStyle = C.dust;
    ctx.fillText(label, kx + 74, ky + 16);      // 설명 시작점은 키 폭과 무관하게 고정
  });

  // 규칙 세 줄 — 이 게임의 유일한 의사결정을 미리 알려준다
  ctx.textAlign = 'center';
  font(13, 500, 0.2); ctx.fillStyle = 'rgba(111,104,87,.95)';
  [ '좀비는 좌우 철조망에 막혀 가운데 통로로만 몰려온다',
    '좀비 한 마리가 곧 현상금 — 모은 돈으로 보급창에서 원하는 만큼 산다',
    '참호 앞 세 자리에 참호 · 철조망 · 지뢰를 깔아 시간을 벌 수 있다',
    '내 참호가 무너지면 그때부터 내가 직접 맞는다' ]
    .forEach((t, i)=> ctx.fillText(t, W/2, 448 + i*21));

  if(best){                                        // 인식표에 새긴 최고 점수
    const bw = 200;
    plate(W/2 - bw/2, 528, bw, 30, C.warn);
    font(10, 500, 1.4); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
    ctx.fillText('최고 점수', W/2 - bw/2 + 18, 548);
    font(15, 700, 0); ctx.textAlign = 'right'; ctx.fillStyle = C.warn;
    ctx.fillText(String(best), W/2 + bw/2 - 18, 548);
  }

  const p = 0.5 + Math.sin(g ? g.t*3.2 : 0)*0.5;
  ctx.textAlign = 'center';
  font(22, 800, 2.6); ctx.fillStyle = `rgba(231,225,208,${0.45 + p*0.55})`;
  ctx.fillText('클릭해서 시작', W/2, 606);
  ctx.strokeStyle = `rgba(217,72,58,${0.3 + p*0.5})`; ctx.lineWidth = 2;
  [-1, 1].forEach(s=>{                             // 양쪽 꺾쇠
    const bx = W/2 + s*118;
    ctx.beginPath();
    ctx.moveTo(bx - s*8, 588); ctx.lineTo(bx, 588);
    ctx.lineTo(bx, 614); ctx.lineTo(bx - s*8, 614);
    ctx.stroke();
  });
}

export function drawOver(){
  const sc = ctx.createLinearGradient(0, 0, 0, H);
  sc.addColorStop(0,    'rgba(30,5,5,.86)');
  sc.addColorStop(0.7,  'rgba(22,5,5,.80)');
  sc.addColorStop(1,    'rgba(12,3,3,.90)');
  ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  font(11, 600, 6); ctx.fillStyle = 'rgba(217,72,58,.8)';
  ctx.fillText('P O S I T I O N   L O S T', W/2, 178);
  stencil('참호 함락', W/2, 254, 76, C.red, 2);
  font(17, 500, 0.4); ctx.fillStyle = C.dust;
  ctx.fillText('웨이브 ' + g.wave + ' 에서 전멸했다', W/2, 292);

  // 성적표 — 한 줄로 붙여 적으면 아무것도 안 읽힌다. 칸으로 나눈다.
  const cells = [
    ['도달 웨이브', String(g.wave),  C.bone],
    ['점수',        String(g.score), g.newBest ? C.warn : C.bone],
    ['처치',        String(g.kills), C.bone],
    ['최고',        String(best),    C.warn],
  ];
  const pw = 620, px = W/2 - pw/2, py = 322;
  plate(px, py, pw, 96, C.red);
  cells.forEach(([k, v, col], i)=>{
    const x = px + pw/8 + i*(pw/4);
    font(11, 500, 0.6); ctx.fillStyle = C.faint; ctx.fillText(k, x, py + 30);
    font(30, 800, 0);   ctx.fillStyle = col;     ctx.fillText(v, x, py + 70);
    if(i < 3){ ctx.fillStyle = 'rgba(198,184,142,.14)'; ctx.fillRect(px + pw/4*(i+1), py + 22, 1, 52); }
  });
  if(g.newBest){
    const pulse = 0.55 + Math.sin(g.t*5)*0.45;
    font(13, 700, 3); ctx.fillStyle = `rgba(224,179,63,${pulse})`;
    ctx.fillText('◆  신 기 록  ◆', W/2, 452);
  }

  const p = 0.5 + Math.sin(g.t*3.2)*0.5;
  font(20, 800, 2.4); ctx.fillStyle = `rgba(231,225,208,${0.45 + p*0.55})`;
  ctx.fillText('클릭해서 다시 시작', W/2, 520);
}
