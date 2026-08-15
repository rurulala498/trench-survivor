import type { ImageAssetKey, ImageAssetManifest } from './types';

export const IMAGE_ASSETS: ImageAssetManifest = {
  battlefield:  { path: 'assets/background/bg_battlefield.png', critical: true },
  foregroundCover: { path: 'assets/background/bg_foreground_cover.png', critical: true },
  walkerSheet0: { path: 'assets/zombies/walker_frames/walker_0.webp', critical: true },
  walkerSheet1: { path: 'assets/zombies/walker_frames/walker_1.webp', critical: true },
  walkerSheet2: { path: 'assets/zombies/walker_frames/walker_2.webp', critical: true },
  walkerSheet3: { path: 'assets/zombies/walker_frames/walker_3.webp', critical: true },
  walkerSheet4: { path: 'assets/zombies/walker_frames/walker_4.webp', critical: true },
  runnerSheet0: { path: 'assets/zombies/runner_frames/runner_0.webp', critical: true },
  runnerSheet1: { path: 'assets/zombies/runner_frames/runner_1.webp', critical: true },
  runnerSheet2: { path: 'assets/zombies/runner_frames/runner_2.webp', critical: true },
  runnerSheet3: { path: 'assets/zombies/runner_frames/runner_3.webp', critical: true },
  runnerSheet4: { path: 'assets/zombies/runner_frames/runner_4.webp', critical: true },
  bruteSheet0: { path: 'assets/zombies/brute_frames/brute_0.webp', critical: true },
  bruteSheet1: { path: 'assets/zombies/brute_frames/brute_1.webp', critical: true },
  bruteSheet2: { path: 'assets/zombies/brute_frames/brute_2.webp', critical: true },
  bruteSheet3: { path: 'assets/zombies/brute_frames/brute_3.webp', critical: true },
  bruteSheet4: { path: 'assets/zombies/brute_frames/brute_4.webp', critical: true },
  bossSheet0: { path: 'assets/zombies/boss_frames/boss_0.webp', critical: true },
  bossSheet1: { path: 'assets/zombies/boss_frames/boss_1.webp', critical: true },
  bossSheet2: { path: 'assets/zombies/boss_frames/boss_2.webp', critical: true },
  bossSheet3: { path: 'assets/zombies/boss_frames/boss_3.webp', critical: true },
  bossSheet4: { path: 'assets/zombies/boss_frames/boss_4.webp', critical: true },
  workTrench:   { path: 'assets/works/work_trench.png', critical: true },
  workWire:     { path: 'assets/works/work_wire.png', critical: true },
  hmgLeftSheet0:  { path: 'assets/weapons/hmg_aim_frames/left/hmg_left_0.webp', critical: true },
  hmgLeftSheet1:  { path: 'assets/weapons/hmg_aim_frames/left/hmg_left_1.webp', critical: true },
  hmgLeftSheet2:  { path: 'assets/weapons/hmg_aim_frames/left/hmg_left_2.webp', critical: true },
  hmgLeftSheet3:  { path: 'assets/weapons/hmg_aim_frames/left/hmg_left_3.webp', critical: true },
  hmgLeftSheet4:  { path: 'assets/weapons/hmg_aim_frames/left/hmg_left_4.webp', critical: true },
  hmgRightSheet0: { path: 'assets/weapons/hmg_aim_frames/right/hmg_right_0.webp', critical: true },
  hmgRightSheet1: { path: 'assets/weapons/hmg_aim_frames/right/hmg_right_1.webp', critical: true },
  hmgRightSheet2: { path: 'assets/weapons/hmg_aim_frames/right/hmg_right_2.webp', critical: true },
  hmgRightSheet3: { path: 'assets/weapons/hmg_aim_frames/right/hmg_right_3.webp', critical: true },
  hmgRightSheet4: { path: 'assets/weapons/hmg_aim_frames/right/hmg_right_4.webp', critical: true },
  hmg:          { path: 'assets/weapons/weapon_hmg_body.png', critical: true },
};

export const BACKGROUND_VISUAL = {
  asset: 'battlefield' as ImageAssetKey,
  fit: 'cover' as const,
};

export const FOREGROUND_VISUAL = {
  asset: 'foregroundCover' as ImageAssetKey,
  // 가장 가까운 설치선 하단이 실제 불투명 성벽 경계에 자연스럽게 묻히도록
  // 전경 전체를 위로 올린다. 설치물의 월드 거리·충돌 위치는 그대로 둔다.
  x: 0, y: -30, width: 1280, height: 720,
};

export const WALKER_VISUAL = {
  sheets: ['walkerSheet0', 'walkerSheet1', 'walkerSheet2', 'walkerSheet3', 'walkerSheet4'] as ImageAssetKey[],
  frameWidth: 160,
  frameHeight: 240,
  columns: 5,
  framesPerSheet: 25,
  frameCount: 125,
  frameDurationsMs: [
    40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,
    40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,
    50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,
    40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,
    40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,40,40,40,50,40,40,
  ] as readonly number[],
  cycleMs: 5210,
  scale: 1.00,
  anchorX: 0.50,
  anchorY: 0.965,
  swayPixels: 1.8,
  bobPixels: 1.1,
  speedVariance: 0.12,
  projection: {
    // 월드 거리와 전투 타이밍은 건드리지 않고, 원거리에서만 시각 거리를 더 준다.
    distanceBias: 1.40,
    distanceBiasNear: 1.0,
    distanceBiasFar: 7.2,
    horizonY: 250,
    groundDepth: 335,
    groundExponent: 1.35,
    visualNearDistance: 1.0,
    visualFarDistance: 9.8,
    scaleMinHeight: 11,
    scaleFactor: 179,
    scaleExponent: 1.45,
    centerX: 625,
    laneSpread: 1.42,
    // Spawn keeps the current visual half-width (~396px after laneSpread).
    // Once the horde advances, it converges to the marked base entrance
    // (~320px half-width) instead of continuing to fan out near the wall.
    laneHalfWidthFar: 279,
    laneHalfWidthNear: 225,
    laneConvergeStart: 0.15,
    laneDepthExponent: 0.85,
    laneDistributionExponent: 0.68,
  },
  hitboxes: {
    // 좌표는 발 중앙 anchor 기준. X/width는 sprite 폭, Y/height는 sprite 높이 비율.
    head: { centerX: -0.060, centerY: -0.850, width: 0.27, height: 0.19 },
    body: { centerX: -0.010, centerY: -0.420, width: 0.68, height: 0.62 },
  },
  // true 또는 URL의 ?debugWalkerHitboxes=1 로 판정선을 볼 수 있다.
  debugHitboxes: false,
  occlusion: {
    // foregroundCover를 y=-30에 그렸을 때 알파가 시작되는 실제 상단선.
    // 32px 간격과 좌우 16px 범위의 보수적인 최소값을 사용해, 머리 폭 안에
    // 솟은 잔해가 있어도 근거리 머리 노출량을 안정적으로 계산한다.
    wallTop: [
      {x: 0, y: 319}, {x: 32, y: 321}, {x: 64, y: 330},
      {x: 96, y: 319}, {x: 128, y: 304}, {x: 160, y: 341},
      {x: 192, y: 360}, {x: 224, y: 355}, {x: 256, y: 354},
      {x: 288, y: 355}, {x: 320, y: 364}, {x: 352, y: 379},
      {x: 384, y: 380}, {x: 416, y: 382}, {x: 448, y: 403},
      {x: 480, y: 409}, {x: 512, y: 413}, {x: 544, y: 414},
      {x: 576, y: 413}, {x: 608, y: 414}, {x: 640, y: 415},
      {x: 672, y: 402}, {x: 704, y: 401}, {x: 736, y: 404},
      {x: 768, y: 426}, {x: 800, y: 420}, {x: 832, y: 419},
      {x: 864, y: 420}, {x: 896, y: 416}, {x: 928, y: 400},
      {x: 960, y: 398}, {x: 992, y: 381}, {x: 1024, y: 360},
      {x: 1056, y: 353}, {x: 1088, y: 352}, {x: 1120, y: 353},
      {x: 1152, y: 314}, {x: 1184, y: 311}, {x: 1216, y: 296},
      {x: 1248, y: 290}, {x: 1280, y: 290},
    ] as readonly {x: number; y: number}[],
    // 방어선 직전에서만 발 기준점을 위로 보정한다. 월드 거리·이동·공격
    // 타이밍은 바꾸지 않고, 머리 높이의 최소 2/3가 전경 위에 남게 한다.
    headVisibleRatio: 2 / 3,
    nearLiftStartApproach: 0.82,
    nearLiftFullApproach: 0.94,
    // 전경을 올린 뒤에도 가장 높은 중앙 잔해에서 머리 2/3가 보이도록 한다.
    maxNearLift: 58,
  },
};

export const RUNNER_VISUAL = {
  sheets: ['runnerSheet0', 'runnerSheet1', 'runnerSheet2', 'runnerSheet3', 'runnerSheet4'] as ImageAssetKey[],
  frameWidth: 160,
  frameHeight: 240,
  columns: 5,
  framesPerSheet: 25,
  frameCount: 125,
  // 원본 GIF의 프레임 타이밍을 그대로 보존한다.
  frameDurationsMs: WALKER_VISUAL.frameDurationsMs,
  cycleMs: 5210,
  // 투명 프레임 안의 실제 머리~발 비율(약 92%)을 보정해 기존 92px 투영 키에 맞춘다.
  scale: 1.08,
  anchorX: 0.50,
  anchorY: 232 / 240,
};

export const BRUTE_VISUAL = {
  sheets: ['bruteSheet0', 'bruteSheet1', 'bruteSheet2', 'bruteSheet3', 'bruteSheet4'] as ImageAssetKey[],
  frameWidth: 160,
  frameHeight: 240,
  columns: 5,
  framesPerSheet: 25,
  frameCount: 125,
  // 원본 GIF의 40/50ms 프레임 순서와 5.21초 루프를 그대로 사용한다.
  frameDurationsMs: WALKER_VISUAL.frameDurationsMs,
  cycleMs: 5210,
  playbackRate: 1.0,
  // 프레임 안 실제 머리~발 높이를 기존 Brute의 92px 투영 높이에 맞춘다.
  scale: 1.08,
  anchorX: 0.50,
  anchorY: 232 / 240,
  renderStyle: {
    // 회백색 스튜디오 조명을 눌러 배경의 흙빛·검붉은 조명에 섞는다.
    colorFilter: 'brightness(0.72) contrast(1.14) saturate(0.82) sepia(0.16) hue-rotate(-6deg)',
  },
};

export const BOSS_VISUAL = {
  sheets: ['bossSheet0', 'bossSheet1', 'bossSheet2', 'bossSheet3', 'bossSheet4'] as ImageAssetKey[],
  frameWidth: 160,
  frameHeight: 240,
  columns: 5,
  framesPerSheet: 25,
  frameCount: 125,
  // 원본 GIF의 40/50ms 프레임 순서와 5.21초 루프를 그대로 사용한다.
  frameDurationsMs: WALKER_VISUAL.frameDurationsMs,
  cycleMs: 5210,
  playbackRate: 1.0,
  // 기존 Boss의 2.30 크기 투영 위에 이미지만 얹어 Brute보다 큰 실루엣을 유지한다.
  scale: 1.08,
  anchorX: 0.50,
  anchorY: 232 / 240,
  renderStyle: {
    // 바탕은 Brute보다 어둡게, 원본의 붉은 균열은 채도를 유지한다.
    colorFilter: 'brightness(0.68) contrast(1.20) saturate(1.24) sepia(0.06) hue-rotate(-4deg)',
    glow: {
      // 낮은 빈도의 미세한 열감 맥동. 전투 로직 시간과는 무관한 시각 효과다.
      colorCore: 'rgba(255,156,62,.92)',
      colorMid: 'rgba(255,52,22,.54)',
      colorOuter: 'rgba(126,8,3,0)',
      intensity: 0.56,
      pulsePeriodMs: 1700,
      pulseMin: 0.84,
      pulseMax: 1.08,
      // 프레임 캔버스 정규화 좌표: 눈, 흉부, 양어깨, 양전완, 복부 균열.
      spots: [
        {x: 0.50, y: 0.125, radius: 0.020, strength: 1.00},
        {x: 0.50, y: 0.245, radius: 0.060, strength: 0.92},
        {x: 0.31, y: 0.225, radius: 0.052, strength: 0.72},
        {x: 0.69, y: 0.225, radius: 0.052, strength: 0.72},
        {x: 0.17, y: 0.390, radius: 0.055, strength: 0.82},
        {x: 0.83, y: 0.390, radius: 0.055, strength: 0.82},
        {x: 0.48, y: 0.405, radius: 0.040, strength: 0.66},
      ] as readonly {x: number; y: number; radius: number; strength: number}[],
    },
  },
};

export const HMG_VISUAL = {
  leftSheets: [
    'hmgLeftSheet0', 'hmgLeftSheet1', 'hmgLeftSheet2', 'hmgLeftSheet3', 'hmgLeftSheet4',
  ] as ImageAssetKey[],
  rightSheets: [
    'hmgRightSheet0', 'hmgRightSheet1', 'hmgRightSheet2', 'hmgRightSheet3', 'hmgRightSheet4',
  ] as ImageAssetKey[],
  frameWidth: 640,
  frameHeight: 426,
  columns: 5,
  framesPerSheet: 25,
  frameCount: 125,
  // 두 GIF 모두 0번이 정면, 124번이 각 방향의 최대 회전 프레임이다.
  deadZonePixels: 44,
  smoothingResponse: 26,
  asset: 'hmg' as ImageAssetKey,
  // 2배 정제 시트의 중앙 하단을 고정 피벗으로 쓴다. 표시 크기는 기존보다
  // 약 11% 줄이고 아래로 12px 내려 근거리 중앙 시야를 확보한다.
  sourcePivotX: 320,
  sourcePivotY: 426,
  scale: 1.275,
  positionX: 732,
  positionY: 1008,
  muzzleAnchors: {
    left: [
      {frame: 0, x: 320, y: 0}, {frame: 31, x: 278, y: 16},
      {frame: 62, x: 204, y: 32}, {frame: 93, x: 128, y: 56},
      {frame: 124, x: 58, y: 40},
    ],
    right: [
      {frame: 0, x: 320, y: 0}, {frame: 31, x: 394, y: 14},
      {frame: 62, x: 528, y: 28}, {frame: 93, x: 638, y: 60},
      {frame: 124, x: 638, y: 88},
    ],
  },
  ejectAnchors: {
    left: [
      {frame: 0, x: 490, y: 232}, {frame: 62, x: 532, y: 218},
      {frame: 124, x: 580, y: 228},
    ],
    right: [
      {frame: 0, x: 490, y: 232}, {frame: 62, x: 316, y: 238},
      {frame: 124, x: 144, y: 256},
    ],
  },
  recoilPixels: 10,
  reloadDrop: 90,
};
