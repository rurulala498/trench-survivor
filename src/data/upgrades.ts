import type { Service, Upgrade } from '../types';

/* ── 업그레이드: 총기 트랙 / 참호 트랙 ─────────────────── */
/* 웨이브마다 카드 1장을 고르는 방식이 아니라, 좀비를 잡아 모은 돈으로 사는 방식이다.
   w = 진열 가중치(기본 1), c = 기본 가격. 같은 항목을 다시 사면 가격이 REBUY 배씩 오른다.
   fx = 효과. 클로저가 아니라 데이터라서 들여다보고 JSON 으로 뺄 수 있다 (data/effects.ts).
   효과 수치는 자동 플레이로 맞춰둔 값이라 그대로 둔다. */
export const REBUY = 1.55;

export const GUN_UP: Upgrade[] = [
  {n:'강화 탄약',    d:'데미지 +30%',              i:'🔥', k:'gun', c:120,
   fx:[{stat:'gun.dmg', op:'mul', v:1.30}]},
  {n:'경량 노리쇠',  d:'연사속도 +22%',            i:'⚡', k:'gun', c:110,
   fx:[{stat:'gun.rate', op:'mul', v:1.22}]},
  {n:'확장 탄창',    d:'탄창 +12발',               i:'📦', k:'gun', c:70,
   fx:[{stat:'gun.mag', op:'add', v:12}]},
  {n:'속사 훈련',    d:'재장전 시간 -30%',         i:'🔄', k:'gun', c:95,  w:2.0,
   fx:[{stat:'gun.reload', op:'mul', v:0.70}]},
  {n:'탄창 파우치',  d:'재장전 -15% · 탄창 +10발', i:'🎒', k:'gun', c:100, w:1.6,
   fx:[{stat:'gun.reload', op:'mul', v:0.85}, {stat:'gun.mag', op:'add', v:10}]},
  {n:'철갑탄',       d:'관통 +1 · 겹친 좀비를 뚫는다', i:'🎯', k:'gun', c:150,
   fx:[{stat:'gun.pierce', op:'add', v:1}]},
  {n:'텅스텐 탄심',  d:'관통 +2 · 데미지 -10%',    i:'🪨', k:'gun', c:190,
   fx:[{stat:'gun.pierce', op:'add', v:2}, {stat:'gun.dmg', op:'mul', v:0.9}]},
  {n:'탄자 안정화',  d:'관통 시 위력 감소 완화',   i:'🧲', k:'gun', c:110,
   fx:[{stat:'gun.fall', op:'add', v:0.10, max:1}]},
  {n:'정밀 조준경',  d:'치명타 확률 +12%',         i:'💥', k:'gun', c:120,
   fx:[{stat:'gun.crit', op:'add', v:0.12}]},
  {n:'헤드샷 특화',  d:'헤드샷 데미지 +70%',       i:'💀', k:'gun', c:130,
   fx:[{stat:'gun.head', op:'add', v:0.7}]},
  {n:'총열 교체',    d:'데미지 +18% · 연사 +10%',  i:'🔧', k:'gun', c:150,
   fx:[{stat:'gun.dmg', op:'mul', v:1.18}, {stat:'gun.rate', op:'mul', v:1.10}]},

  /* br 이 붙은 건 그 계열을 골라야 진열된다 — 이게 테크트리의 실체다 */
  {n:'벨트 급탄',    d:'탄창 +40 · 재장전 -20%',   i:'⛓️', k:'gun', c:185, br:'rate', w:2.2,
   fx:[{stat:'gun.mag', op:'add', v:40}, {stat:'gun.reload', op:'mul', v:0.80}]},
  {n:'총열 다발',    d:'동시 발사 +1발',           i:'🌀', k:'gun', c:245, br:'rate', w:2.2,
   fx:[{stat:'gun.shots', op:'add', v:1}]},
  {n:'냉각 재킷',    d:'연사 +18% · 데미지 +10%',  i:'❄️', k:'gun', c:200, br:'rate', w:2.2,
   fx:[{stat:'gun.rate', op:'mul', v:1.18}, {stat:'gun.dmg', op:'mul', v:1.10}]},

  {n:'철갑 관통자',  d:'관통 +3',                  i:'🗡️', k:'gun', c:240, br:'pierce', w:2.2,
   fx:[{stat:'gun.pierce', op:'add', v:3}]},
  {n:'파열탄',       d:'처치할 때 주변까지 터진다', i:'💥', k:'gun', c:235, br:'pierce', w:2.2,
   fx:[{stat:'gun.boom', op:'add', v:16}]},
  {n:'구경 확장',    d:'데미지 +45% · 연사 -12%',  i:'⚙️', k:'gun', c:210, br:'pierce', w:2.2,
   fx:[{stat:'gun.dmg', op:'mul', v:1.45}, {stat:'gun.rate', op:'mul', v:0.88}]},
];

export const TRENCH_UP: Upgrade[] = [
  /* 순서가 의미를 갖는다 — barMax 를 먼저 올리고 그 값으로 bar 를 채운다 */
  {n:'통나무 보강',  d:'참호 내구도 +70 · 전량 수리', i:'🪵', k:'tr', c:100,
   fx:[{stat:'barMax', op:'add', v:70}, {stat:'bar', op:'set', ofStat:'barMax'}]},
  {n:'수리 키트',    d:'웨이브마다 내구도 35% 자동 수리', i:'🧰', k:'tr', c:130,
   fx:[{stat:'repair', op:'add', v:0.35}]},
  {n:'철조망 증설',  d:'좀비 이동속도 -18%',       i:'🚧', k:'tr', c:140,
   fx:[{stat:'slow', op:'mul', v:0.82}]},
  {n:'강철 방벽',    d:'참호가 받는 피해 -22%',    i:'🛡️', k:'tr', c:150,
   fx:[{stat:'armor', op:'mul', v:0.78}]},
  {n:'대못 방벽',    d:'참호를 때린 좀비가 반사 피해', i:'🪝', k:'tr', c:110,
   fx:[{stat:'spikes', op:'add', v:14}]},
  {n:'참호 확장',    d:'내구도 +40 · 최대체력 +25', i:'⛏️', k:'tr', c:120,
   fx:[{stat:'barMax', op:'add', v:40}, {stat:'bar', op:'add', v:40},
       {stat:'maxHp', op:'add', v:25}, {stat:'hp', op:'add', v:25}]},
];

/* 상점에 항상 떠 있는 서비스 */
export const SERVICES: Service[] = [
  {n:'긴급 보수', i:'🧱', c:70, d:'참호 전량 수리 · 방어선 40% 수리', svc:true,
   fx:[{stat:'bar', op:'set', ofStat:'barMax'}, {act:'repairWorks', amount:0.4}]},
  {n:'위생병',    i:'💉', c:90, d:'체력 45 회복', svc:true,
   fx:[{stat:'hp', op:'add', v:45, maxOf:'maxHp'}]},
];
