import { FUNNEL, HORIZON, PROJ_K, PROJ_S, PROJ_X, PROJ_Y, W } from '../config';
import type { Zombie } from '../types';
import { WALKER_VISUAL } from '../assets/manifest';

/* ── 투영 헬퍼 ─────────────────────────────────────────── */
const projP = (d: number) => 1 / (d + PROJ_K);
export const projY = (d: number) => HORIZON + PROJ_Y * projP(d);
export const projX = (wx: number,d: number) => W/2 + wx * PROJ_X * projP(d);
export const projS = (d: number) => PROJ_S * projP(d);

export interface HitEllipse {
  cx: number; cy: number; rx: number; ry: number;
  rotation: number;
}

export interface WalkerPose {
  cx: number; fy: number;
  width: number; height: number;
  left: number; top: number;
  scale: number; rotation: number;
}

function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t*t*(3 - 2*t);
}

function walkerDepth(d: number): {visualD: number; approach: number} {
  const P = WALKER_VISUAL.projection;
  const biasT = smoothstep(P.distanceBiasNear, P.distanceBiasFar, d);
  const visualD = d + P.distanceBias * biasT;
  const approach = Math.max(0, Math.min(1,
    (P.visualFarDistance - visualD) / (P.visualFarDistance - P.visualNearDistance)));
  return {visualD, approach};
}

/* Walker/Runner가 실제로 밟는 새 전장 평면의 Y. bob은 제외해 고정 구조물과
   설치 가이드가 같은 지면 기준을 공유할 수 있게 한다. */
export function hordeGroundY(d: number): number {
  const P = WALKER_VISUAL.projection;
  const {approach} = walkerDepth(d);
  return P.horizonY + P.groundDepth * Math.pow(approach, P.groundExponent);
}

/* 방어선은 원래 배경 원근을 완전히 버리면 전경 성벽에 지나치게 묻힌다.
   새 적 지면 쪽으로 충분히 내려 발 노출을 막되, 상단 실루엣은 남긴다. */
export function defenseGroundY(d: number): number {
  const oldY = projY(d);
  return oldY + (hordeGroundY(d) - oldY) * 0.72;
}

/* Walker 전용 시각 투영.
   z.d 자체는 그대로 유지해서 이동 속도·방어선 도달·공격 타이밍은 바꾸지 않는다. */
export function walkerPose(z: Zombie): WalkerPose {
  const P = WALKER_VISUAL.projection;
  const {approach} = walkerDepth(z.d);
  // 발 위치와 표시 크기가 동일한 approach를 사용하므로 작은 Walker는 항상 먼 지면에 있다.
  const groundT = Math.pow(approach, P.groundExponent);
  const scaleT = Math.pow(approach, P.scaleExponent);
  const height = (P.scaleMinHeight + P.scaleFactor * scaleT)
               * WALKER_VISUAL.scale * z.sz;
  const width = height * WALKER_VISUAL.frameWidth / WALKER_VISUAL.frameHeight;
  const baseScale = height / 92;
  // Keep the existing spawn formation, then funnel it only as it approaches
  // the base. This is visual projection only; z.wx and movement stay intact.
  const laneApproach = smoothstep(P.laneConvergeStart, 1, approach);
  const laneHalfWidth = (P.laneHalfWidthFar
                       + (P.laneHalfWidthNear - P.laneHalfWidthFar)
                         * Math.pow(laneApproach, P.laneDepthExponent)) * P.laneSpread;
  const laneN = Math.max(-1, Math.min(1, z.wx / FUNNEL));
  const spreadN = Math.sign(laneN) * Math.pow(Math.abs(laneN), P.laneDistributionExponent);
  const cx = P.centerX + spreadN * laneHalfWidth
           + Math.sin(z.ph * 0.5) * WALKER_VISUAL.swayPixels * baseScale;
  const rawFy = P.horizonY + P.groundDepth * groundT
              + Math.sin(z.ph) * WALKER_VISUAL.bobPixels * baseScale;
  const O = WALKER_VISUAL.occlusion;
  const headHeight = WALKER_VISUAL.hitboxes.head.height * height;
  const headTop = rawFy
                + (WALKER_VISUAL.hitboxes.head.centerY
                   - WALKER_VISUAL.hitboxes.head.height * 0.5) * height;
  const requiredVisibleBottom = headTop + headHeight * O.headVisibleRatio;
  const requiredLift = Math.max(0, requiredVisibleBottom - walkerWallTopY(cx));
  const nearLiftT = smoothstep(O.nearLiftStartApproach, O.nearLiftFullApproach, approach);
  const fy = rawFy - Math.min(O.maxNearLift, requiredLift) * nearLiftT;
  return {
    cx, fy, width, height,
    left: cx - width * WALKER_VISUAL.anchorX,
    top: fy - height * WALKER_VISUAL.anchorY,
    scale: baseScale,
    rotation: z.swing > 0.05 ? z.swing * 0.055 : 0,
  };
}

export function walkerHitboxes(z: Zombie, pose = walkerPose(z)) {
  const make = (h: typeof WALKER_VISUAL.hitboxes.head): HitEllipse => {
    const lx = h.centerX * pose.width;
    const ly = h.centerY * pose.height;
    const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
    return {
      cx: pose.cx + lx*c - ly*s,
      cy: pose.fy + lx*s + ly*c,
      rx: h.width * pose.width * 0.5,
      ry: h.height * pose.height * 0.5,
      rotation: pose.rotation,
    };
  };
  return {head: make(WALKER_VISUAL.hitboxes.head), body: make(WALKER_VISUAL.hitboxes.body), pose};
}

export function pointInEllipse(x: number, y: number, e: HitEllipse): boolean {
  const dx = x - e.cx, dy = y - e.cy;
  const c = Math.cos(e.rotation), s = Math.sin(e.rotation);
  const nx = (dx*c + dy*s) / e.rx;
  const ny = (-dx*s + dy*c) / e.ry;
  return nx*nx + ny*ny <= 1;
}

export function walkerWallTopY(x: number): number {
  const pts = WALKER_VISUAL.occlusion.wallTop;
  if(x <= pts[0]!.x) return pts[0]!.y;
  for(let i=1;i<pts.length;i++){
    const a = pts[i-1]!, b = pts[i]!;
    if(x <= b.x){
      const t = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return pts[pts.length - 1]!.y;
}

/* 이 Y 아래는 성벽 뒤에 있으므로 렌더와 Body 판정에서 함께 제외한다. */
export function walkerOcclusionClipY(z: Zombie, pose: WalkerPose, x: number): number {
  void z; void pose;
  return walkerWallTopY(x);
}

export function box(z: Zombie){                              // 좀비 화면 사각형
  if(z.type === 'walker'){
    const p = walkerPose(z);
    const hh = WALKER_VISUAL.hitboxes.head.height * p.height;
    return {x: p.left, y: p.top, w: p.width, h: p.height,
            cx: p.cx, cy: p.top + p.height/2, fy: p.fy, s: p.scale, hh};
  }
  if(z.type === 'runner'){
    // Runner도 Walker와 동일한 전장 평면·거리 곡선·좌우 수렴을 사용한다.
    // 판정 비율(40×92, 상단 26% 헤드)은 기존 Runner 값을 그대로 유지한다.
    const p = walkerPose(z);
    const h = p.height, w = h * 40 / 92;
    return {x: p.cx - w/2, y: p.fy - h, w, h,
            cx: p.cx, cy: p.fy - h/2, fy: p.fy, s: h/92, hh: h*0.26};
  }
  const s = projS(z.d) * z.sz;
  const h = 92 * s, w = 40 * s;
  const fy = projY(z.d), x = projX(z.wx, z.d);
  return {x: x - w/2, y: fy - h, w, h, cx: x, cy: fy - h/2, fy, s, hh: h*0.26};
}

/* 화면 y → 거리. projY 의 역함수라 마우스로 자리를 찍을 수 있다. */
export function yToD(y: number){ return PROJ_Y / Math.max(1, y - HORIZON) - PROJ_K; }
