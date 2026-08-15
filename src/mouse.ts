import { cv } from './canvas';
import { H, HORIZON, W } from './config';

/* ── 입력 ──────────────────────────────────────────────── */
export const mouse = {x: W/2, y: HORIZON + 60, down:false};
export function toLocal(e: MouseEvent){
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / (r.width  / W);
  mouse.y = (e.clientY - r.top ) / (r.height / H);
}
