import { ctx } from '../canvas';

/* ══════════════════════════════════════════════════════════
   디자인 시스템
   월드가 흙·모래주머니의 warm 톤이라 UI도 뼈색/카키로 맞춘다.
   차가운 청회색을 쓰면 참호 위에 웹 대시보드가 떠 있는 꼴이 된다.
   채도가 있는 색은 "상태"에만 — 총기(주황) / 참호(파랑) / 위험(적) / 체력(녹).
   ══════════════════════════════════════════════════════════ */
export const C = {
  ink:   'rgba(9,10,8,.84)',        // 패널 바닥
  edge:  'rgba(198,184,142,.20)',   // 패널 테두리
  lip:   'rgba(255,242,206,.06)',   // 상단 1px 하이라이트
  well:  'rgba(0,0,0,.55)',         // 게이지 홈
  bone:  '#e7e1d0',                 // 1차 텍스트
  dust:  '#a79d84',                 // 2차 텍스트
  faint: '#6f6857',                 // 3차 텍스트
  gun:   '#e0824a',                 // 총기 트랙
  tr:    '#5f9fc9',                 // 참호 트랙
  hp:    '#6fc08a',
  warn:  '#e0b33f',
  red:   '#d9483a',
};

const FONT = '"Pretendard","Malgun Gothic","Segoe UI",sans-serif';
/* 폰트와 자간을 항상 같이 세팅 — 자간이 다음 텍스트로 새지 않게 */
export function font(size: number, weight: number, spacing: number){
  ctx.font = (weight || 400) + ' ' + size + 'px ' + FONT;
  if('letterSpacing' in ctx) ctx.letterSpacing = (spacing || 0) + 'px';
}

/* 모서리를 깎은 금속판 — 둥근 사각형보다 군용 느낌이 난다 */
export function plate(x: number, y: number, w: number, h: number, accent?: string | null, fill?: string){
  const k = 9;
  ctx.beginPath();
  ctx.moveTo(x + k, y);   ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - k); ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x, y + h);   ctx.lineTo(x, y + k);
  ctx.closePath();
  ctx.fillStyle = fill || C.ink; ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = C.lip; ctx.fillRect(x + k, y, w - k, 1);
  if(accent){                                  // 좌측 액센트 띠
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + k, 2, h - k*2);
  }
}

/* 눈금이 새겨진 계기식 게이지.
   ghost 를 넣으면 최근에 깎인 만큼이 흰 잔상으로 남아 "맞았다"가 읽힌다. */
export function gauge(x: number, y: number, w: number, h: number, v: number, col: string, ghost: number){
  v = Math.max(0, Math.min(1, v));
  ctx.fillStyle = C.well; ctx.fillRect(x, y, w, h);
  if(ghost > 0){
    ctx.fillStyle = `rgba(255,236,214,${ghost*0.5})`;
    ctx.fillRect(x, y, w * Math.min(1, v + ghost*0.06), h);
  }
  const gr = ctx.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, 'rgba(255,255,255,.26)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(0,0,0,.30)');
  ctx.fillStyle = col;  ctx.fillRect(x, y, w * v, h);
  ctx.fillStyle = gr;   ctx.fillRect(x, y, w * v, h);
  ctx.fillStyle = 'rgba(0,0,0,.32)';           // 10칸 눈금
  for(let i=1;i<10;i++) ctx.fillRect(x + (w/10)*i, y, 1, h);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/* 키캡 — 어떤 키를 누르라는 건지 글자만 적어두면 눈에 안 들어온다 */
export function keycap(x: number, y: number, label: string, col?: string, w?: number, h?: number){
  w = w || 22; h = h || 20;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4);
  ctx.fillStyle = 'rgba(232,226,208,.10)'; ctx.fill();
  ctx.strokeStyle = col || 'rgba(198,184,142,.42)'; ctx.lineWidth = 1; ctx.stroke();
  font(11, 700, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = col || C.dust;
  ctx.fillText(label, x + w/2, y + h/2 + 0.5);
  ctx.textBaseline = 'alphabetic';
  return x + w;
}

/* 진행 칸(3칸) — 다음 단계까지 몇 번 남았는지 */
export function pips(x: number, y: number, n: number, col: string, pw?: number, ph?: number, gap?: number, total?: number){
  pw = pw || 16; ph = ph || 6; gap = gap || 6; total = total || 3;
  for(let i=0;i<total;i++){
    ctx.fillStyle = i < n ? col : 'rgba(198,184,142,.20)';
    ctx.beginPath(); ctx.roundRect(x + i*(pw+gap), y, pw, ph, 2); ctx.fill();
  }
  return x + total*(pw+gap) - gap;
}

/* 라벨 → 값 한 줄. HUD 전체가 같은 리듬을 갖게 하는 최소 단위 */
export function row(lx: number, rx: number, y: number, label: string, value: string, lcol?: string, vcol?: string, vsize?: number){
  font(11, 500, 0.3); ctx.textAlign = 'left';
  ctx.fillStyle = lcol || C.faint; ctx.fillText(label, lx, y);
  font(vsize || 12, 700, 0); ctx.textAlign = 'right';
  ctx.fillStyle = vcol || C.bone;  ctx.fillText(value, rx, y);
}

