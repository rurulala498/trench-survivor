import { H, W } from './config';
import type { Ctx2D } from './types';

export const cv = document.getElementById('cv') as HTMLCanvasElement;
export const ctx = cv.getContext('2d') as Ctx2D;

/* ── 화면 맞춤 ───────────────────────────────────────────
   캔버스 좌표 변환은 여기서 값을 들고 있지 않는다 — mouse.ts 의 toLocal() 이
   그때그때 getBoundingClientRect() 를 읽는다. 레터박스 위치를 캐시해 두면
   리사이즈와 어긋날 수 있어서, 한 곳에서만 재는 쪽으로 통일했다. */
export function resize(){
  // 창 크기를 아직 모르는 시점(임베드·헤드리스)에 0 이 오면 캔버스가 사라진 채
  // 리사이즈 이벤트를 영원히 못 받는다. 최소 스케일로 막아둔다.
  const s = Math.max(0.2, Math.min(innerWidth / W, innerHeight / H) || 1);
  cv.width = W; cv.height = H;
  cv.style.width  = (W * s) + 'px';
  cv.style.height = (H * s) + 'px';
}
/* 리스너 등록은 main.ts 가 부팅 순서에 맞춰 한다 */
