import { fxRnd, rnd } from '../rng';
import { sfxClick, sfxDeath, sfxHit, sfxShot } from '../audio';
import { TUNE } from '../data/economy';
import { TYPES } from '../data/zombies';
import { mouse } from '../mouse';
import { g, phase } from '../state';
import { gunAim } from './aim';
import { box, pointInEllipse, projS, walkerHitboxes, walkerOcclusionClipY } from './projection';
import type { FloatNum, Zombie } from '../types';

export function tryReload(){
  if(phase !== 'playing' || g.reloadT > 0 || g.gun.ammo >= g.gun.mag) return;
  g.reloadT = g.gun.reload;
  sfxClick(240, 0.05);
  setTimeout(()=>sfxClick(180, 0.05), g.gun.reload*600);
}
export function fire(){
  if(phase !== 'playing' || g.cool > 0 || g.reloadT > 0) return;
  if(g.gun.ammo <= 0){ tryReload(); return; }

  /* 동시 발사는 탄을 더 먹는다. 1발 값으로 5줄을 훑게 두면 연사 계열이
     관통 계열을 크게 앞질러버린다(자동플레이 52 vs 37웨이브). */
  const sN = Math.max(1, g.gun.shots|0);
  g.gun.ammo = Math.max(0, g.gun.ammo - (1 + ((sN - 1) >> 1)));
  g.cool   = 1 / g.gun.rate;
  g.recoil = 1;
  // 발마다 5씩 흔들면 연사 중엔 화면이 계속 떨려서 좀비를 눈으로 따라갈 수 없다.
  // 총 흔들림은 최소로 두고, 큰 흔들림은 참호가 맞을 때만 쓴다.
  g.shake  = Math.max(g.shake, 2.2);
  g.flash  = 1;
  sfxShot(Math.min(g.gun.dmg / 40, 1));

  const aim = gunAim();
  // 탄피는 리시버 근처(총열 중간쯤)에서 튄다
  g.shells.push({x: aim.ex, y: aim.ey,
                 vx: 140 + fxRnd()*90, vy: -220 - fxRnd()*90,
                 r: fxRnd()*6, vr: 14, life: 1.4});
  // 총구 연기는 발사 순간의 실제 프레임별 muzzle anchor에서 태어난다.
  // 한 발당 하나만 두고 짧게 소멸시켜 연사 중에도 근거리 시야를 가리지 않는다.
  const smokeLife = 0.26 + fxRnd()*0.10;
  if(g.muzzleSmoke.length >= 18) g.muzzleSmoke.shift();
  g.muzzleSmoke.push({
    x: aim.mx, y: aim.my,
    vx: Math.sin(aim.ang) * (16 + fxRnd()*12) + (fxRnd() - 0.5)*8,
    vy: -Math.cos(aim.ang) * (14 + fxRnd()*10) - 18 - fxRnd()*10,
    radius: 5 + fxRnd()*3, life: smokeLife, max: smokeLife,
  });

  /* 후보를 한 번만 박스로 만들어 두고 발마다 재사용한다.
     동시 발사 4발이면 판정을 네 번 하는데, 550마리를 매번 다시 훑을 이유가 없다. */
  const cand: Array<{z: Zombie; b: ReturnType<typeof box>; walkerHit: ReturnType<typeof walkerHitboxes> | null}> = [];
  for(let i=0;i<g.zombies.length;i++){
    const z = g.zombies[i];
    if(!z.dead) cand.push({z, b: box(z), walkerHit: z.type === 'walker' ? walkerHitboxes(z) : null});
  }

  const shots = Math.max(1, g.gun.shots|0);
  // 동시 발사는 좌우로 퍼진다 — 여러 줄을 동시에 훑는 게 이 계열의 정체성
  const SPREAD = [[0], [-20, 20], [-30, 0, 30], [-42, -14, 14, 42], [-52, -26, 0, 26, 52]];
  const offs = SPREAD[Math.min(shots, 5) - 1];

  let total = 0, anyHead = false, anyCrit = false, best = 0;
  boomLeft = 3;                               // 방아쇠 한 번이 일으킬 폭발 상한
  for(let s=0;s<offs.length;s++){
    const mx = mouse.x + offs[s] * (shots > 1 ? 1 : 0);
    const my = mouse.y + (s % 2 ? 6 : -4) * (shots > 1 ? 1 : 0);

    const hits = cand
      .map(target => {
        const {z, b, walkerHit} = target;
        let zone: 'head' | 'body' | null = null;
        if(!z.dead && walkerHit){
          if(pointInEllipse(mx, my, walkerHit.head)) zone = 'head';
          else if(pointInEllipse(mx, my, walkerHit.body)
                  && my <= walkerOcclusionClipY(z, walkerHit.pose, mx)) zone = 'body';
        }else if(!z.dead && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          zone = my < b.y + b.hh ? 'head' : 'body';
        }
        return {...target, zone};
      })
      .filter(target => target.zone !== null)
      .sort((a, b) => a.z.d - b.z.d)
      .slice(0, 1 + g.gun.pierce);

    // 실제 판정 좌표가 곧 탄착점이다. 예전의 강제 최소 130px 길이를 없애
    // 근거리 명중 시 적 뒤까지 선이 뻗지 않게 한다. 빗나가도 현재 조준점에서
    // 끝나므로 별도의 가짜 최대 사거리나 전투 판정을 만들지 않는다.
    g.tracers.push({x1: aim.mx, y1: aim.my,
                    x2: mx, y2: my,
                    life: 1, pierce: hits.length});
    if(!hits.length) continue;
    if(hits.length > best) best = hits.length;

    hits.forEach(({z, zone}, idx)=>{
      const head = zone === 'head';
      const crit = rnd() < g.gun.crit;
      // 뒤로 갈수록 위력이 조금씩 줄지만, 탄자 안정화를 올리면 거의 그대로 뚫는다
      // 곁 총열은 주 총열보다 약하다 — 동시 발사가 순수 이득이 되지 않게
      const dmg = Math.round(g.gun.dmg * (s === 0 ? 1 : 0.65)
                             * (head ? g.gun.head : 1) * (crit ? 2.2 : 1)
                             * Math.pow(g.gun.fall, idx));
      total += dmg;
      if(head) anyHead = true;
      if(crit) anyCrit = true;
      // 혈흔만 맞은 자리마다 흩는다. 숫자는 아래에서 한 번에 합친다.
      hurtZombie(z, dmg, mx + (idx ? (idx%2?1:-1)*(12+idx*7) : 0), my - idx*8, head, crit);
    });
  }

  if(!total) return;
  g.hitMark = 0.18;
  tally(total, mouse.x, mouse.y - 30, anyHead, anyCrit);

  // 관통 표시는 3명 이상일 때만, 그리고 0.6초에 한 번만.
  // 매 발 띄우면 연사 중에 "관통 x4" 가 초당 스무 개씩 쌓인다.
  if(best >= 3 && g.pierceT <= 0){
    g.pierceT = 0.6;
    // 누적 데미지 숫자가 네 자리까지 커지므로 충분히 떨어뜨린다
    pushNum({x: mouse.x + 96, y: mouse.y - 46, v: -34, life: 0.7, pop: 0,
                 txt: '관통 ' + best, c: '#7fd4ff'});
  }
}
export function hurtZombie(z: Zombie, dmg: number, px: number, py: number, head: boolean, _crit: boolean){
  z.hp -= dmg; z.flash = 1;
  blood(px, py, head ? 6 : 3, projS(z.d));      // 명중 혈흔은 조금만 — 처치할 때 크게 튄다
  sfxHit();
  if(z.hp <= 0 && !z.dead) killZombie(z, head);
}
/* 데미지 숫자는 "맞은 놈마다" 가 아니라 "쏘는 동안 하나" 다.
   좀비마다 합치는 것만으로는 부족했다 — 관통 9면 한 발이 서로 다른 9마리를
   때리니 숫자 아홉 개가 동시에 뜨고, 연사 중엔 상한 22개가 조준점 주위에
   그대로 쌓여 좀비가 안 보였다.
   지금은 방아쇠를 당기고 있는 동안 숫자 하나가 커지기만 한다. 누적 피해가
   보이니 관통이 얼마나 먹는지도 오히려 더 잘 읽힌다. */
const NUM_MAX = 22;
export function tally(dmg: number, px: number, py: number, head: boolean, crit: boolean){
  const n = g.tallyN;
  if(n && n.life > 0.3 && g.nums.indexOf(n) >= 0){
    n.val = (n.val ?? 0) + dmg; n.txt = String(n.val); n.life = 0.7; n.pop = 1;
    if(crit) n.c = '#ffd24a';
    else if(head && n.c === '#f2ece0') n.c = '#ff7a68';
    return;
  }
  const fresh = {val: dmg, txt: String(dmg), pop: 1, x: px, y: py, v: -54, life: 0.7,
                 c: crit ? '#ffd24a' : head ? '#ff7a68' : '#f2ece0'};
  pushNum(fresh);
  g.tallyN = fresh;
}
/* 떠오르는 글자는 전부 이 문을 통과한다 — 상한을 한 곳에서만 지킨다 */
export function pushNum(n: FloatNum){
  while(g.nums.length >= NUM_MAX) g.nums.shift();
  g.nums.push(n);
}
function killZombie(z: Zombie, head: boolean){
  z.dead = true;
  const b = box(z);
  blood(b.cx, b.cy, head ? 26 : 18, b.s);       // 처치 순간이 제일 크게 튀어야 한다
  /* 시체는 그리기 쪽 관심사(오프스크린 층)라 여기서 직접 찍지 않고 큐에 넣는다.
     덕분에 sim 은 render 를 전혀 모르고, 로직만 따로 돌릴 수 있다. */
  g.corpseQ.push({
    x: b.cx, y: b.fy, s: b.s * z.sz, hue: z.hue, type: z.type,
    d: z.d, rot: (fxRnd()*2 - 1) * 0.5, pool: 22 + fxRnd()*18,
  });
  g.corpseN++;
  g.kills++;
  g.combo++; g.comboT = 2.2;
  g.score += Math.round(TYPES[z.type].score * (1 + g.wave*0.1) * (1 + Math.min(g.combo, 30)*0.02));
  g.hp = Math.min(g.maxHp, g.hp + g.steal);

  /* 현상금. 웨이브 배수를 0.05 로 두면 마리수가 제곱으로 늘어나는 것과 겹쳐
     이중으로 불어난다(1→25웨이브에 수입 80배 vs 물가 43배). 그래서 후반에
     총이 감당 못 할 만큼 강해지고 참호가 긁히지도 않았다.
     마리수 증가 자체가 이미 수입 증가라, 마리당 값은 거의 고정으로 둔다. */
  const pay = Math.max(1, Math.round(TYPES[z.type].cash * (1 + g.wave*TUNE.cashW)));
  g.cash += pay; g.earned += pay; g.cashFx = 1;
  // 금액은 브루트·보스급만 띄운다. 잡졸까지 띄우면 후반에 초당 수십 개가 뜬다.
  if(pay >= 30){
    pushNum({x: b.cx, y: b.cy - 12, v: -48, life: 1.0, pop: 0, txt: '+' + pay, c: '#e8c04a'});
  }
  sfxDeath();

  /* 파열탄 — 관통 계열의 "한 방에 여럿".
     연쇄는 inBoom 으로 한 겹에서 끊고, 한 발당 터지는 횟수도 boomLeft 로 묶는다.
     관통 18 이면 한 발이 18마리를 죽이고 폭발도 18번 나서, 방아쇠 한 번에
     화면이 비어버렸다(자동플레이 51웨이브 · 자금 42만 잉여). */
  if(g.gun.boom > 0 && !inBoom && boomLeft > 0){
    inBoom = true; boomLeft--;
    if(g.booms.length < 26) g.booms.push({x: b.cx, y: b.fy, s: b.s*0.55, life: 1});
    let sum = 0;
    for(let i=0;i<g.zombies.length;i++){
      const o = g.zombies[i];
      if(o.dead || o === z) continue;
      if(Math.abs(o.d - z.d) > 0.3 || Math.abs(o.wx - z.wx) > 0.46) continue;
      const ob = box(o);
      const dmg = Math.round(g.gun.boom);
      sum += dmg;
      hurtZombie(o, dmg, ob.cx, ob.cy, false, false);
    }
    if(sum > 0) tally(sum, b.cx, b.cy - 26, false, false);
    inBoom = false;
  }
}
let inBoom = false;
let boomLeft = 0;
export function setBoomLeft(n: number): void { boomLeft = n; }                               // 한 발이 일으킬 수 있는 폭발 횟수

const PART_MAX = 720;                            // 입자 상한 — 학살 규모가 커지면 여기서 막힌다
export const BLOOD = [0,1,2,3,4,5].map(i=>{             // 알파 6단계 미리 만들어 둔 혈흔색
  const a = (i + 0.5) / 6;
  return `rgba(${(150 + a*60)|0},26,21,${a.toFixed(2)})`;
});
export function blood(x: number, y: number, n: number, s: number){
  if(g.parts.length > PART_MAX) return;
  for(let i=0;i<n;i++){
    const a = fxRnd()*Math.PI*2, v = 40 + fxRnd()*260*Math.min(s,2);
    g.parts.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 60,
                  r: (1 + fxRnd()*3) * Math.min(Math.max(s,.4),2.2),
                  life: 0.4 + fxRnd()*0.6, max: 1});
  }
}
