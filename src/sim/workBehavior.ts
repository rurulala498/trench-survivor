import { WORKS } from '../data/works';
import { workSlow } from './workStats';
import { blowMine } from './works';
import type { Work, WorkKind, Zombie } from '../types';

/* ══════════════════════════════════════════════════════════
   방어선 종류별 "행동" 표.
   예전에는 update() 안에 `if(WORKS[w.kind].slow)` 와
   `if(w.kind !== 'mine') return;` 이 박혀 있어서, 새 종류를 넣으면
   update 를 뜯어야 했고 어디를 고쳐야 하는지 알 방법이 없었다.

   pass : 지대 안을 지나가는 동안 매 프레임. 반환값은 속도 배수.
   cross: 이번 프레임에 방어선을 넘어섰을 때 한 번.
   둘 다 없는 종류(전방 참호)는 blocks=true 로 앞에서 멈추므로 빈 칸이다.

   Record<WorkKind, …> 라서 WorkKind 에 종류를 추가하면 tsc 가 여기를 지목한다.
   ══════════════════════════════════════════════════════════ */
export interface WorkBehavior {
  /* 지대 폭(거리 단위). pass 를 쓰는 종류만 의미가 있다. */
  band?: number;
  pass?: (w: Work, z: Zombie, dt: number) => number;
  cross?: (w: Work, z: Zombie) => void;
}

export const BEHAVIOR: Record<WorkKind, WorkBehavior> = {
  /* 전방 참호 — 앞에서 멈춰 세우는 게 전부라 통과 행동이 없다 */
  trench: {},

  /* 철조망 — 지나가는 동안 붙잡고, 밟힌 만큼 갈린다 */
  wire: {
    band: 0.34,
    pass(w, _z, dt){
      w.hp -= (WORKS[w.kind].dps ?? 0) * dt;
      w.fx = Math.max(w.fx, 0.35);
      return workSlow(w);
    },
  },

  /* 지뢰밭 — 선을 넘는 순간 터진다 */
  mine: {
    cross(w, z){ blowMine(w, z); },
  },
};
