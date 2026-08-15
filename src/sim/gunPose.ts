import { HMG_VISUAL } from '../assets/manifest';
import { W } from '../config';
import { mouse } from '../mouse';
import { g } from '../state';

export type GunPoseSide = 'left' | 'right';
export interface GunFramePose {
  side: GunPoseSide;
  amount: number;
  frameFloat: number;
  frameIndex: number;
}

let smoothed = 0;
let lastTime = -1;
let cached: GunFramePose = {side: 'right', amount: 0, frameFloat: 0, frameIndex: 0};

export function horizontalGunTarget(mouseX = mouse.x): number {
  const delta = mouseX - W / 2;
  const magnitude = Math.abs(delta);
  if(magnitude <= HMG_VISUAL.deadZonePixels) return 0;
  const range = W / 2 - HMG_VISUAL.deadZonePixels;
  const amount = Math.min(1, (magnitude - HMG_VISUAL.deadZonePixels) / range);
  return delta < 0 ? -amount : amount;
}

export function gunFramePose(): GunFramePose {
  const target = horizontalGunTarget();
  const now = g.t;
  if(lastTime < 0 || now < lastTime){
    smoothed = target;
  }else if(now > lastTime){
    const delta = Math.min(0.05, now - lastTime);
    const alpha = 1 - Math.exp(-HMG_VISUAL.smoothingResponse * delta);
    smoothed += (target - smoothed) * alpha;
    if(Math.abs(smoothed) < 0.0005) smoothed = 0;
  }
  lastTime = now;

  const amount = Math.min(1, Math.abs(smoothed));
  const frameFloat = amount * (HMG_VISUAL.frameCount - 1);
  cached = {
    side: smoothed < 0 ? 'left' : 'right',
    amount,
    frameFloat,
    frameIndex: Math.min(HMG_VISUAL.frameCount - 1, Math.round(frameFloat)),
  };
  return cached;
}

export interface FrameAnchor {frame: number; x: number; y: number}

export function interpolateFrameAnchor(
  anchors: readonly FrameAnchor[], frame: number,
): {x: number; y: number} {
  if(frame <= anchors[0].frame) return {x: anchors[0].x, y: anchors[0].y};
  for(let index = 1; index < anchors.length; index++){
    const next = anchors[index];
    if(frame > next.frame) continue;
    const previous = anchors[index - 1];
    const mix = (frame - previous.frame) / (next.frame - previous.frame);
    return {
      x: previous.x + (next.x - previous.x) * mix,
      y: previous.y + (next.y - previous.y) * mix,
    };
  }
  const last = anchors[anchors.length - 1];
  return {x: last.x, y: last.y};
}
