import { sfxHurt, sfxThud } from '../audio';
import { TYPES } from '../data/zombies';
import { best, g, setBest, setPhase } from '../state';
import { blood, hurtZombie } from './combat';
import { box } from './projection';
import type { Zombie } from '../types';

/* 피격 카메라 흔들림은 피해량과 별개의 시각 피드백이다.
   여러 좀비가 연속으로 참호를 때릴 때도 조준 대상을 읽을 수 있도록 진폭을 낮추고,
   방어선 붕괴만 일반 타격보다 조금 더 강하게 남긴다. */
const DAMAGE_SHAKE = {
  trenchHit: 4.5,
  trenchBreak: 9,
  healthHit: 10,
} as const;

/* 참호가 먼저 깎이고, 참호가 무너진 뒤에야 내 체력이 깎인다 */
export function hitTrench(z: Zombie){
  const raw = TYPES[z.type].dmg;
  const b = box(z);
  g.barFx = 1; g.shake = Math.max(g.shake, DAMAGE_SHAKE.trenchHit);
  blood(b.cx, 640, 8, 1.2);

  if(g.bar > 0){
    g.bar = Math.max(0, g.bar - raw * g.armor);
    sfxThud();
    if(g.bar === 0){ g.hurtFx = 1; g.shake = DAMAGE_SHAKE.trenchBreak; }
  }else{
    g.hp -= raw * 0.6;                              // 참호가 뚫린 뒤엔 직접 맞는다
    g.hurtFx = 1; g.shake = DAMAGE_SHAKE.healthHit; sfxHurt();
    if(g.hp <= 0){
      g.hp = 0; setPhase('gameover');
      if(g.score > best){ setBest(g.score); g.newBest = true; }
    }
  }
  if(g.spikes > 0){                                 // 대못 방벽 반사 피해
    hurtZombie(z, Math.round(g.spikes), b.cx, b.fy - b.h*0.35, false, false);
  }
}
