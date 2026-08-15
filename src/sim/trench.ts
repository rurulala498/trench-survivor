import { sfxHurt, sfxThud } from '../audio';
import { TYPES } from '../data/zombies';
import { best, g, setBest, setPhase } from '../state';
import { blood, hurtZombie } from './combat';
import { box } from './projection';
import type { Zombie } from '../types';

/* 참호가 먼저 깎이고, 참호가 무너진 뒤에야 내 체력이 깎인다 */
export function hitTrench(z: Zombie){
  const raw = TYPES[z.type].dmg;
  const b = box(z);
  g.barFx = 1; g.shake = Math.max(g.shake, 9);
  blood(b.cx, 640, 8, 1.2);

  if(g.bar > 0){
    g.bar = Math.max(0, g.bar - raw * g.armor);
    sfxThud();
    if(g.bar === 0){ g.hurtFx = 1; g.shake = 22; }
  }else{
    g.hp -= raw * 0.6;                              // 참호가 뚫린 뒤엔 직접 맞는다
    g.hurtFx = 1; g.shake = 20; sfxHurt();
    if(g.hp <= 0){
      g.hp = 0; setPhase('gameover');
      if(g.score > best){ setBest(g.score); g.newBest = true; }
    }
  }
  if(g.spikes > 0){                                 // 대못 방벽 반사 피해
    hurtZombie(z, Math.round(g.spikes), b.cx, b.fy - b.h*0.35, false, false);
  }
}
