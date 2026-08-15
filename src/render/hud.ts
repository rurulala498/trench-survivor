import { ctx } from '../canvas';
import { H, W } from '../config';
import { BRANCH, GUN_STEP, TR_STEP, TR_TIER, trTier } from '../data/branches';
import { WORKS } from '../data/works';
import { mouse } from '../mouse';
import { gunName } from '../progress';
import { best, g, phase } from '../state';
import { C, font, gauge, keycap, pips, plate, row } from './theme';

/* 조준점.
   전투 중엔 반동만큼 벌어지는 십자선 + 재장전 링을,
   메뉴/강화 화면에선 UI 를 가리키는 포인터를 그린다. */
export function drawCross(){
  const x = mouse.x, y = mouse.y;

  if(phase !== 'playing'){                          // UI 포인터
    ctx.strokeStyle = 'rgba(231,225,208,.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 9); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 6, y);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(231,225,208,.95)';
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill();
    return;
  }

  const reloading = g && g.reloadT > 0;
  const lowA = g && g.gun.ammo <= g.gun.mag*0.25;
  const sp   = 7 + (g ? g.recoil*10 : 0);           // 반동만큼 벌어진다
  const col  = g && g.hitMark > 0 ? '255,96,74'
             : reloading ? '224,179,63'
             : lowA ? '224,140,90' : '230,238,250';

  // 재장전 링 — 시선을 우하단으로 옮기지 않아도 진행이 보인다
  if(reloading){
    const p = 1 - g.reloadT / g.gun.reload;
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 25, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(224,179,63,.28)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 25, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(224,179,63,.95)'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(x, y, 25, -Math.PI/2, -Math.PI/2 + p*Math.PI*2); ctx.stroke();
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3.6;   // 밝은 배경에서도 보이게 외곽선
  for(let pass=0; pass<2; pass++){
    if(pass){ ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 1.6; }
    ctx.beginPath();
    ctx.moveTo(x - sp - 11, y); ctx.lineTo(x - sp, y);
    ctx.moveTo(x + sp, y);      ctx.lineTo(x + sp + 11, y);
    ctx.moveTo(x, y - sp - 11); ctx.lineTo(x, y - sp);
    ctx.moveTo(x, y + sp);      ctx.lineTo(x, y + sp + 11);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${col},.95)`;
  ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill();

  if(g && g.hitMark > 0){                           // 명중 표식
    const a = g.hitMark / 0.18, r1 = 5 + (1-a)*4, r2 = 14 + (1-a)*7;
    ctx.strokeStyle = `rgba(255,96,74,${a})`; ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x-r2,y-r2); ctx.lineTo(x-r1,y-r1); ctx.moveTo(x+r2,y-r2); ctx.lineTo(x+r1,y-r1);
    ctx.moveTo(x-r2,y+r2); ctx.lineTo(x-r1,y+r1); ctx.moveTo(x+r2,y+r2); ctx.lineTo(x+r1,y+r1);
    ctx.stroke();
  }
}

export function drawHUD(){
  ctx.textBaseline = 'alphabetic';
  const barR = g.bar / g.barMax, hpR = g.hp / g.maxHp;

  /* ① 좌상단 — 진지 상태.
     예전엔 참호 붕괴 경고를 이 판 안에 그려서 게이지 라벨과 3px 차이로 겹쳤다.
     가장 급한 정보가 가장 뭉개지던 자리라 아래로 따로 뺐다. */
  plate(28, 24, 312, 108, barR <= 0 ? C.red : C.warn);
  row(46, 324, 52, '참호 내구도', Math.ceil(g.bar) + ' / ' + Math.round(g.barMax),
      C.dust, barR > 0.25 ? C.bone : C.red, 12);
  gauge(46, 58, 278, 13, barR,
        barR > 0.5 ? '#c9a34b' : barR > 0.25 ? '#d4762e' : C.red, g.barFx);
  row(46, 324, 96, '체력', Math.ceil(g.hp) + ' / ' + Math.round(g.maxHp),
      C.dust, hpR > 0.25 ? C.bone : C.red, 12);
  gauge(46, 102, 278, 13, hpR,
        hpR > 0.5 ? C.hp : hpR > 0.25 ? C.warn : C.red, g.hurtFx);

  if(barR <= 0){                                   // 참호가 무너진 상태 — 독립 배너
    const pulse = 0.5 + Math.sin(g.t*7)*0.5;
    plate(28, 140, 312, 28, C.red, `rgba(58,10,8,${0.62 + pulse*0.24})`);
    font(12, 700, 0.4); ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,150,138,${0.62 + pulse*0.38})`;
    ctx.fillText('참호 붕괴 — 직접 피해를 받는 중', 46, 159);
  }

  /* ② 상단 중앙 — 웨이브. 게임의 시계라서 가장 큰 활자를 준다. */
  plate(W/2 - 156, 24, 312, 62);
  ctx.textAlign = 'center';
  font(11, 600, 3.2); ctx.fillStyle = C.faint; ctx.fillText('W A V E', W/2, 45);
  font(30, 800, 1);   ctx.fillStyle = C.bone;  ctx.fillText(String(g.wave), W/2, 74);
  font(11, 500, 0.2); ctx.fillStyle = C.faint;
  ctx.textAlign = 'left';  ctx.fillText('점수 ' + g.score, W/2 - 140, 74);
  ctx.textAlign = 'right'; ctx.fillText('처치 ' + g.kills, W/2 + 140, 74);
  font(10, 500, 0.2); ctx.textAlign = 'right';
  ctx.fillStyle = g.score > best ? C.warn : 'rgba(111,104,87,.75)';
  ctx.fillText(g.score > best ? '신기록' : '최고 ' + best, W/2 + 140, 45);

  /* ②-b 자금 — 좀비가 곧 돈이라 전투 중에도 계속 보여야 한다 */
  const cw = 176, cx0 = W/2 - cw/2;
  plate(cx0, 92, cw, 34, C.warn);
  font(10, 500, 1); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
  ctx.fillText('자금', cx0 + 14, 114);
  font(17, 800, 0); ctx.textAlign = 'right';
  ctx.fillStyle = g.cashFx > 0 ? `rgb(255,${224 - (30*(1-g.cashFx))|0},138)` : C.warn;
  ctx.fillText('₩' + g.cash, cx0 + cw - 14, 115);
  keycap(cx0 + cw + 10, 100, 'B', C.faint, 20, 18);
  font(9, 500, 0.4); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
  ctx.fillText('상점', cx0 + cw + 34, 114);

  /* ②-c 전방 방어선 — 몇 겹이 남았는지, 각 겹이 얼마나 버티는지 */
  if(g.works.length){
    const bx = cx0 - 128;
    font(9, 500, 0.6); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
    ctx.fillText('전방 방어선', bx, 102);
    g.works.forEach((wk, i)=>{
      const y = 108 + i*13, r = Math.max(0, wk.hp / wk.max);
      ctx.fillStyle = WORKS[wk.kind].col[0];
      ctx.fillRect(bx, y, 3, 8);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx + 6, y + 2, 70, 4);
      ctx.fillStyle = wk.fx > 0.1 ? '#ffd0a0' : r > 0.4 ? '#c9a34b' : C.red;
      ctx.fillRect(bx + 6, y + 2, 70 * r, 4);
      font(8, 700, 0.2); ctx.fillStyle = (wk.lv||1) > 1 ? C.hp : C.faint;
      ctx.fillText('★'.repeat(wk.lv || 1), bx + 80, y + 7);   // 등급
      font(8, 500, 0.2); ctx.fillStyle = C.faint;
      ctx.fillText(wk.d.toFixed(1) + 'm', bx + 100, y + 7);
    });
  }

  /* ③ 우상단 — 남은 좀비. 진행바는 다 죽일수록 비어간다. */
  const left  = g.queue.length + g.zombies.length;
  const total = Math.max(1, g.waveTotal || left);
  plate(W - 340, 24, 312, 62, C.red);
  font(11, 500, 0.3); ctx.textAlign = 'left';  ctx.fillStyle = C.dust;
  ctx.fillText('남은 좀비', W - 322, 48);
  font(26, 800, 0);   ctx.textAlign = 'right'; ctx.fillStyle = '#e0685a';
  ctx.fillText(String(left), W - 46, 52);
  gauge(W - 322, 62, 276, 8, Math.min(1, left/total), '#8a4038', 0);
  if(g.queue.length === 0 && left > 0){            // 더 안 나온다 = 마무리 국면
    font(10, 600, 0.6); ctx.textAlign = 'right'; ctx.fillStyle = C.warn;
    ctx.fillText('마지막 무리', W - 46, 78);
  }

  /* ④ 연속 처치 — 붕괴 배너와 겹치지 않는 우측에 */
  if(g.combo >= 3){
    const a = Math.min(1, g.comboT / 0.6);
    const pop = 1 + Math.max(0, (g.comboT - 2.0)) * 0.5;
    ctx.textAlign = 'right';
    font(Math.round(42*pop), 800, 0); ctx.fillStyle = `rgba(224,168,74,${a})`;
    ctx.fillText(String(g.combo), W - 46, 148);
    font(11, 600, 1.6); ctx.fillStyle = `rgba(167,157,132,${a*0.9})`;
    ctx.fillText('연속 처치', W - 46, 168);
  }

  /* ⑤ 좌하단 — 총기 스펙 + 두 트랙의 단계 */
  const SY = H - 146;
  plate(28, SY, 312, 112);
  // 계열이 갈리면 봐야 할 수치가 달라진다 — 연사 계열은 동시 발사, 관통 계열은 파열
  const stats = [
    ['데미지',  g.gun.dmg.toFixed(0)],
    ['연사',    g.gun.rate.toFixed(1)],
    ['관통',    String(1 + g.gun.pierce)],
    g.gun.shots > 1 ? ['동시', g.gun.shots + '발']
      : g.gun.boom > 0 ? ['파열', String(Math.round(g.gun.boom))]
      : ['치명타', Math.round(g.gun.crit*100) + '%'],
    ['치명타',  Math.round(g.gun.crit*100) + '%'],
  ];
  if(g.gun.shots <= 1 && g.gun.boom <= 0) stats.pop();   // 중복 제거
  ctx.textAlign = 'center';
  stats.forEach(([k, v], i)=>{
    const x = 46 + 28 + i*(stats.length > 4 ? 56 : 70);
    font(10, 500, 0.4);  ctx.fillStyle = C.faint; ctx.fillText(k, x, SY + 20);
    font(stats.length > 4 ? 15 : 17, 700, 0); ctx.fillStyle = C.bone; ctx.fillText(v, x, SY + 42);
    if(i < stats.length - 1){
      ctx.fillStyle = 'rgba(198,184,142,.13)';
      ctx.fillRect(x + (stats.length > 4 ? 28 : 35), SY + 12, 1, 32);
    }
  });
  ctx.fillStyle = 'rgba(198,184,142,.13)'; ctx.fillRect(46, SY + 56, 278, 1);
  const gcol = g.branch ? BRANCH[g.branch].col : C.gun;
  /* [강화횟수, 이름, 색, y, 단계당횟수, 칸너비, 칸간격] */
  const tracks: Array<[number, string, string, number, number, number, number]> = [
    [g.gunUps, gunName(), gcol, SY + 78, GUN_STEP, 10, 5],
    [g.trUps, TR_TIER[trTier(g.trUps)]!, C.tr, SY + 100, TR_STEP, 18, 6],
  ];
  tracks.forEach(([n, label, col, y, st, pw, gp])=>{
    ctx.fillStyle = col;                           // 트랙 표식
    ctx.beginPath(); ctx.roundRect(46, y - 8, 3, 9, 1.5); ctx.fill();
    font(12, 700, 0.2); ctx.textAlign = 'left'; ctx.fillStyle = col;
    ctx.fillText(label, 56, y);
    pips(258 - (st === 5 ? 16 : 0), y - 8, n % st, col, pw, 7, gp, st);
  });

  /* ⑥ 우하단 — 탄약. 남은 발이 탄창 스트립으로도 보인다. */
  const AY = H - 112, AX = W - 340;
  plate(AX, AY, 312, 78, g.gun.ammo <= g.gun.mag*0.25 && g.reloadT <= 0 ? C.red : null);
  if(g.reloadT > 0){
    const p = 1 - g.reloadT / g.gun.reload;
    font(11, 600, 0.6); ctx.textAlign = 'left'; ctx.fillStyle = C.warn;
    ctx.fillText('재장전', AX + 18, AY + 26);
    font(30, 800, 0); ctx.textAlign = 'right'; ctx.fillStyle = C.warn;
    ctx.fillText(Math.round(p*100) + '%', AX + 294, AY + 46);
    gauge(AX + 18, AY + 56, 276, 10, p, C.warn, 0);
  }else{
    const lowA = g.gun.ammo <= g.gun.mag*0.25;
    keycap(AX + 18, AY + 14, 'R', C.faint);
    font(11, 500, 0.3); ctx.textAlign = 'left'; ctx.fillStyle = C.faint;
    ctx.fillText('재장전', AX + 46, AY + 28);
    font(38, 800, 0); ctx.textAlign = 'right';
    ctx.fillStyle = lowA ? C.red : C.bone;
    ctx.fillText(String(g.gun.ammo), AX + 244, AY + 46);
    font(17, 500, 0); ctx.fillStyle = C.faint;
    ctx.fillText('/ ' + g.gun.mag, AX + 294, AY + 46);
    // 탄창 스트립 — 20발 이하면 한 칸이 한 발
    const sx = AX + 18, sw = 276;
    ctx.fillStyle = C.well; ctx.fillRect(sx, AY + 56, sw, 10);
    if(g.gun.mag <= 20){
      const cw2 = sw / g.gun.mag;
      for(let i=0;i<g.gun.ammo;i++){
        ctx.fillStyle = lowA ? C.red : '#c9a34b';
        ctx.fillRect(sx + i*cw2 + 1, AY + 58, cw2 - 2, 6);
      }
    }else{
      gauge(sx, AY + 56, sw, 10, g.gun.ammo / g.gun.mag, lowA ? C.red : '#c9a34b', 0);
    }
  }

  /* ⑦ 웨이브 배너 — 활자만 크게 띄우지 않고 띠로 받쳐서 읽히게.
     강화 피드백(drawUpFx)이 196~312 를 쓰므로, 그게 떠 있는 동안은 아래로 비킨다.
     예전 위치(158)는 연속 처치 숫자와 참호 붕괴 경고를 정면으로 덮었다. */
  if(g.waveTxt > 0){
    const a  = Math.min(1, g.waveTxt / 0.6);
    const bs = g.wave % 5 === 0;
    const BY = g.upFx ? 336 : 196;
    // 아래에서 올라와 자리를 잡는다. 위로 슬라이드하면 연속 처치 숫자를 덮는다.
    const slide = (1 - Math.min(1, (2.2 - g.waveTxt) / 0.35)) * 26;
    ctx.save();
    ctx.translate(0, slide);
    ctx.fillStyle = `rgba(8,9,7,${a*0.62})`; ctx.fillRect(0, BY, W, 96);
    ctx.fillStyle = bs ? `rgba(201,79,240,${a})` : `rgba(217,72,58,${a})`;
    ctx.fillRect(0, BY, W, 2); ctx.fillRect(0, BY + 94, W, 2);
    ctx.textAlign = 'center';
    font(56, 800, 6); ctx.fillStyle = `rgba(${bs ? '221,150,246' : '232,110,96'},${a})`;
    ctx.fillText('WAVE ' + g.wave, W/2, BY + 56);
    font(14, 500, 3.4); ctx.fillStyle = `rgba(167,157,132,${a*0.95})`;
    ctx.fillText(bs ? '보스가 온다' : '놈들이 온다', W/2, BY + 82);
    ctx.restore();
  }

  /* ⑧ 첫 웨이브에만 조작 안내 — HTML 로 띄우면 캔버스 밖에서 어긋난다 */
  if(g.tip > 0 && g.wave <= 1){
    const a = Math.min(1, g.tip / 1.6) * 0.8;
    ctx.textAlign = 'center'; font(12, 500, 1.4);
    ctx.fillStyle = `rgba(167,157,132,${a})`;
    ctx.fillText('마우스 조준  ·  클릭 유지로 연사  ·  R 재장전  ·  B 보급창', W/2, 300);
  }
}

/* 강화를 고른 직후 뜨는 피드백 — 단계가 오르면 훨씬 크게 */
export function drawUpFx(){
  if(!g || !g.upFx) return;
  const f = g.upFx;
  const a = Math.min(1, f.life / (f.tierUp ? 0.9 : 0.5));
  const rgb = f.k === 'gun' ? '224,130,74' : '95,159,201';
  ctx.textAlign = 'center';

  if(f.tierUp){
    ctx.fillStyle = `rgba(${rgb},${a*0.11})`; ctx.fillRect(0, 0, W, H);
    // 위아래 띠
    ctx.fillStyle = `rgba(8,9,7,${a*0.76})`; ctx.fillRect(0, 196, W, 118);
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillRect(0, 196, W, 2); ctx.fillRect(0, 312, W, 2);
    font(12, 700, 4); ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillText(f.k === 'gun' ? '총기 단계 상승' : '참호 단계 상승', W/2, 230);
    font(42, 800, 1); ctx.fillStyle = `rgba(231,225,208,${a})`;
    ctx.fillText(f.label, W/2, 278);
    font(13, 500, 0.6); ctx.fillStyle = `rgba(167,157,132,${a})`;
    ctx.fillText(f.sub, W/2, 302);
  }else{
    font(25, 700, 0.4); ctx.fillStyle = `rgba(231,225,208,${a})`;
    ctx.fillText(f.label, W/2, 250);
    font(12, 600, 0.8); ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillText(f.sub, W/2, 274);
    const tot = f.total || 3;                      // 진행 칸 (총기 5 / 참호 3)
    for(let i=0;i<tot;i++){
      const x = W/2 - (tot*22 - 6)/2 + i*22;
      ctx.fillStyle = i < f.step ? `rgba(${rgb},${a})` : `rgba(198,184,142,${a*0.22})`;
      ctx.beginPath(); ctx.roundRect(x, 286, 16, 6, 2); ctx.fill();
    }
  }
}
