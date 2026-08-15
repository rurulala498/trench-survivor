/* ══════════════════════════════════════════════════════════
   게임 전체가 공유하는 타입.
   원본은 한 스코프에 모든 게 있어서 타입이 필요 없었지만, 모듈로 쪼개면
   경계마다 계약이 필요하다. 여기가 그 계약이다.
   ══════════════════════════════════════════════════════════ */

/* 화면 단계. 원본의 문자열 phase 를 그대로 유니온으로 옮겼다. */
export type Phase = 'menu' | 'playing' | 'shop' | 'branch' | 'place' | 'boost' | 'gameover';

export type ZombieKind = 'walker' | 'runner' | 'brute' | 'boss';
export type WorkKind = 'trench' | 'wire' | 'mine';
export type BranchKey = 'rate' | 'pierce';
/* 상점 항목 분류: 총기 / 참호 / 설치물 / 보강 */
export type ItemKind = 'gun' | 'tr' | 'wk' | 'bo';

/* 좀비 한 종류의 모든 것.
   종류가 늘어날 때 코드를 고치지 않으려면, "종류마다 다른 값"이 전부
   여기 있어야 한다. 현상금(cash)과 체력바 표시(bar/barCol)가 예전에는
   다른 파일에 흩어져 있어서 새 종류를 넣을 때 빠뜨리기 쉬웠다. */
export interface ZombieType {
  hp: number; spd: number; sz: number;
  body: number[]; head: number[];
  score: number; dmg: number; hit: number;
  cash: number;            // 처치 현상금
  bar: boolean;            // 체력바를 띄울 만큼 오래 사는 놈인가
  barCol: string;          // 체력바 색
  boss?: boolean;          // 웨이브 보스로 등장하는 종류
}

export interface Zombie {
  type: ZombieKind;
  d: number; wx: number;
  hp: number; max: number;
  spd: number; sz: number;
  ph: number; hue: number;
  animT: number; animSpeed: number;
  flash: number; dead: boolean; sway: number;
  melee: boolean; hitT: number; swing: number;
  stand: number; jit: number;
}

/* 설치한 방어선 한 채 */
export interface Work {
  kind: WorkKind;
  slot: number;
  d: number;
  lv: number;
  hp: number; max: number;
  hit: number; fx: number;
}

export interface WorkType {
  n: string; i: string; c: number; hp: number;
  blocks: boolean;
  d: string;
  col: string[];
  lvName: string[];
  /* hp 를 화면에 뭐라고 부를지. 지뢰는 "내구도" 가 아니라 "발" 이다 —
     이게 데이터에 없으면 상점 카드에서 종류로 분기해야 한다. */
  hpName: string;
  hpUnit: string;
  armor?: number;
  slow?: number;
  dps?: number;
  boom?: number;
  splash?: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; life: number; max: number;
}
export interface Shell {
  x: number; y: number; vx: number; vy: number;
  r: number; vr: number; life: number;
}
/* 떠오르는 글자 — 데미지 누적, 현상금, 관통 표시 */
export interface FloatNum {
  x: number; y: number; v: number; life: number;
  txt: string; c: string;
  pop: number;
  val?: number;
}
export interface Tracer {
  x1: number; y1: number; x2: number; y2: number;
  life: number; pierce: number;
}
export interface MuzzleSmoke {
  x: number; y: number; vx: number; vy: number;
  radius: number; life: number; max: number;
}
export interface Boom { x: number; y: number; s: number; life: number; }

/* 좀비를 화면 사각형으로 투영한 결과 */
export interface Box {
  x: number; y: number; w: number; h: number;
  cx: number; cy: number; fy: number;
  s: number; hh: number;
}

/* UI 판정용 사각형 (버튼·카드) */
export interface Rect { x: number; y: number; w: number; h: number; }

/* 시체 층에 한 번 찍히고 잊히는 값. 배열로 들고 있지 않는다. */
export interface Corpse {
  x: number; y: number; s: number;
  hue: number; type: ZombieKind;
  d: number; rot: number; pool: number;
}

/* 강화를 고른 직후 뜨는 피드백 */
export interface UpFx {
  life: number;
  k: ItemKind | 'tr' | 'gun';
  tierUp: boolean;
  step: number;
  total: number;
  label: string;
  sub: string;
}

export interface Gun {
  dmg: number; rate: number; mag: number; ammo: number; reload: number;
  pierce: number; crit: number; head: number; fall: number;
  boom: number;   // 파열탄 주변 피해
  shots: number;  // 동시 발사
}

/* 효과 함수가 받는 대상. 실제 g 이거나, 미리보기용 사본이다. */
export interface EffectTarget {
  gun: Gun;
  bar: number; barMax: number;
  hp: number; maxHp: number;
  slow: number; armor: number; repair: number; spikes: number; steal: number;
  works: Work[];
}

/* 상점에 진열되는 것 하나.
   총기/참호 강화, 설치물, 보강, 보급 서비스가 한 배열에 섞여 진열되고
   그리기 코드가 .wk / .svc / .br 을 조건 없이 읽는다. 유니온으로 쪼개면
   좁히기 캐스팅이 수십 군데 필요해서, 있을 수도 없을 수도 있는 필드를
   옵셔널로 둔 하나의 계약으로 맞췄다. 분류는 k 가 들고 있다. */
export interface ShopItem {
  n: string;              // 이름
  i: string;              // 아이콘(이모지)
  d: string;              // 설명
  k?: ItemKind;           // 'gun' | 'tr' | 'wk' | 'bo'
  c?: number;             // 기본 가격 (보강 카드는 대상마다 달라 없음)
  w?: number;             // 진열 가중치
  br?: BranchKey;         // 이 계열을 골라야 진열된다
  wk?: WorkKind;          // 설치물 종류
  svc?: boolean;          // 즉시 적용되는 보급
  sold?: boolean;         // 이번 진열에서 이미 팔림
  hp?: number;            // 설치물 기본 내구도
  blocks?: boolean;
  /* 효과. 클로저가 아니라 데이터다 — data/effects.ts 의 applyEffects 가 적용한다 */
  fx?: Effect[];
}
/* 강화 항목은 효과 함수가 반드시 있다 */
export interface Upgrade extends ShopItem {
  k: 'gun' | 'tr';
  c: number;
  fx: Effect[];
}
export interface Service extends ShopItem {
  c: number;
  svc: true;
  fx: Effect[];
}

/* 계열(테크트리) 정의.
   up 은 단계를 넘을 때마다, atTier 는 특정 단계에서만 추가로 적용된다.
   예전에는 `up(gg, t){ ...; if(t >= 2) ... }` 함수였는데, 단계별로 무엇이
   붙는지 밖에서 읽을 수 없었다. */
export interface Branch {
  n: string; i: string; col: string; rgb: string;
  d: string; sub: string;
  tiers: string[];
  up: Effect[];
  atTier?: Record<number, Effect[]>;
}

/* 한 판의 전체 상태 */
export interface Game {
  hp: number; maxHp: number;
  score: number; kills: number; wave: number;
  bar: number; barMax: number;
  gun: Gun;
  reloadT: number; cool: number; recoil: number;
  steal: number; slow: number; armor: number; repair: number; spikes: number;
  gunUps: number; trUps: number;
  upFx: UpFx | null;
  branch: BranchKey | null;
  combo: number; comboT: number;
  cash: number; earned: number;
  bought: Record<string, number>;
  works: Work[];
  stock: Upgrade[];
  pick: ShopItem | null;
  zombies: Zombie[];
  /* 이번 프레임에 새로 눕은 시체. sim 이 쌓고 render 가 비운다 —
     이 큐가 있어서 sim 이 render 를 import 하지 않는다. */
  corpseQ: Corpse[];
  corpseN: number;
  parts: Particle[]; shells: Shell[]; nums: FloatNum[];
  tracers: Tracer[]; muzzleSmoke: MuzzleSmoke[]; booms: Boom[];
  tallyN: FloatNum | null;
  queue: ZombieKind[];
  spawnT: number; inter: number;
  waveTxt: number; waveTotal: number;
  shake: number; flash: number; hurtFx: number; barFx: number; hitMark: number;
  t: number; cashFx: number; deny: number; pierceT: number;
  newBest: boolean; tip: number;
  /* 이 판의 씨앗. 같은 씨앗 + 같은 입력 = 같은 판 */
  seed: number;
}

/* letterSpacing 은 아직 표준 DOM 타입에 없는 브라우저가 있어서 확장해 둔다.
   할당이 무시되는 브라우저에서는 자간만 빠지고 나머지는 그대로 그려진다. */
export type Ctx2D = CanvasRenderingContext2D & { letterSpacing?: string };

/* ══════════════════════════════════════════════════════════
   효과 데이터 — data/effects.ts 의 applyEffects 가 해석한다
   ══════════════════════════════════════════════════════════ */
/* 손댈 수 있는 스탯의 전체 목록. 여기 없는 건 효과로 바꿀 수 없다 —
   오타가 런타임 버그가 아니라 컴파일 오류가 된다. */
const GUN_KEYS = ['dmg', 'rate', 'mag', 'reload', 'pierce',
                  'crit', 'head', 'fall', 'boom', 'shots'] as const;
export type GunKey = typeof GUN_KEYS[number];
export type TopKey = 'barMax' | 'bar' | 'maxHp' | 'hp'
            | 'slow' | 'armor' | 'repair' | 'spikes' | 'steal';
export type StatPath = `gun.${GunKey}` | TopKey;

/* 스탯으로 못 적는 것들. 늘어나면 여기에 이름을 더한다. */
export type EffectAct = 'repairWorks';

export interface Effect {
  stat?: StatPath;
  op?: 'mul' | 'add' | 'set';
  v?: number;
  /* v 대신 다른 스탯의 현재 값을 쓴다 (예: bar = barMax — 전량 수리) */
  ofStat?: StatPath;
  /* 상한. 관통 유지는 1.0 을 못 넘고, 체력은 maxHp 를 못 넘는다 */
  max?: number;
  maxOf?: StatPath;
  /* 스탯이 아닌 동작 */
  act?: EffectAct;
  /* act 에 넘기는 값 (repairWorks 면 회복 비율) */
  amount?: number;
}
