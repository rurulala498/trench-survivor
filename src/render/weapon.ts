import { imageAsset } from '../assets/loader';
import { HMG_VISUAL } from '../assets/manifest';
import { ctx } from '../canvas';
import { gunAim } from '../sim/aim';
import { g } from '../state';
import { drawLegacyGun } from './gun';

function drawMuzzleSmoke(): void {
  ctx.save();
  g.muzzleSmoke.forEach(smoke=>{
    const t = Math.max(0, smoke.life / smoke.max);
    const gradient = ctx.createRadialGradient(
      smoke.x, smoke.y, 0,
      smoke.x, smoke.y, smoke.radius,
    );
    gradient.addColorStop(0, `rgba(205,202,194,${0.15*t*t})`);
    gradient.addColorStop(0.55, `rgba(177,177,172,${0.08*t})`);
    gradient.addColorStop(1, 'rgba(154,156,154,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

function drawMuzzleFx(x: number, y: number, angle: number): void {
  if(g.flash <= 0.04) return;
  const f = g.flash;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 30*f);
  glow.addColorStop(0, `rgba(255,249,220,${f*0.88})`);
  glow.addColorStop(0.34, `rgba(255,168,58,${f*0.42})`);
  glow.addColorStop(1, 'rgba(255,108,16,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 30*f, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(255,232,166,${f*0.90})`;
  ctx.beginPath();
  ctx.moveTo(0, -26*f); ctx.lineTo(7*f, 1); ctx.lineTo(0, 8*f);
  ctx.lineTo(-7*f, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,174,62,${f*0.62})`;
  ctx.beginPath();
  ctx.moveTo(-18*f, 1); ctx.lineTo(0, -7*f); ctx.lineTo(18*f, 1);
  ctx.lineTo(0, 6*f); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawGun(): void {
  const aim = gunAim();
  const sheets = aim.pose.side === 'left' ? HMG_VISUAL.leftSheets : HMG_VISUAL.rightSheets;
  const sheetIndex = Math.floor(aim.pose.frameIndex / HMG_VISUAL.framesPerSheet);
  const localFrame = aim.pose.frameIndex % HMG_VISUAL.framesPerSheet;
  const image = imageAsset(sheets[sheetIndex]);
  if(!image){
    drawLegacyGun();
    return;
  }

  const sx = (localFrame % HMG_VISUAL.columns) * HMG_VISUAL.frameWidth;
  const sy = Math.floor(localFrame / HMG_VISUAL.columns) * HMG_VISUAL.frameHeight;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(aim.ox, aim.oy);
  ctx.scale(HMG_VISUAL.scale, HMG_VISUAL.scale);
  ctx.drawImage(
    image,
    sx, sy, HMG_VISUAL.frameWidth, HMG_VISUAL.frameHeight,
    -HMG_VISUAL.sourcePivotX, -HMG_VISUAL.sourcePivotY,
    HMG_VISUAL.frameWidth, HMG_VISUAL.frameHeight,
  );
  ctx.restore();

  drawMuzzleSmoke();
  drawMuzzleFx(aim.mx, aim.my, aim.ang);
}
