/* ══════════════════════════════════════════════════════════
   시드 난수.

   Math.random() 은 씨앗을 못 정해서 같은 판을 두 번 만들 수 없다.
   그래서 지금까지 밸런스를 볼 때 편차를 걸러내려고 같은 설정을 3번씩
   돌려야 했다(연사 27/32/41웨이브처럼). 씨앗을 고정하면 "이 수치를
   바꿨더니 정확히 이만큼 달라졌다"를 볼 수 있다.

   ── 흐름을 둘로 나눈 이유 ──────────────────────────────
   sim  : 판의 결과를 바꾸는 것 (치명타 판정, 스폰 위치·속도, 진열 뽑기)
   fx   : 보이기만 하는 것 (피 튀는 방향, 탄피, 화면 흔들림)

   하나로 합치면 화면을 안 그리는 실행(테스트·서버 검증)이 그리는 실행과
   난수를 다르게 소모해서 결과가 갈린다. 흐름을 나눠두면 sim 쪽은
   그리든 안 그리든 정확히 같은 판이 된다.

   같은 씨앗 + 같은 입력 = 같은 판. 이게 리플레이·데일리 챌린지·
   재현 가능한 테스트의 전제다.
   ══════════════════════════════════════════════════════════ */

/* mulberry32 — 32비트 상태 하나로 도는 작고 빠른 난수기.
   품질이 암호용은 아니지만 게임 판정용으로는 충분하고, 상태가 정수
   하나라서 저장·복원이 간단하다. */
let simA = 1;
let fxA = 1;

function step(a: number): number {
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0);
}

/* 판의 결과를 바꾸는 난수 */
export function rnd(): number {
  simA = (simA + 0x6D2B79F5) | 0;
  let t = Math.imul(simA ^ (simA >>> 15), 1 | simA);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* 보이기만 하는 난수 — sim 흐름을 건드리지 않는다 */
export function fxRnd(): number {
  fxA = (fxA + 0x6D2B79F5) | 0;
  let t = Math.imul(fxA ^ (fxA >>> 15), 1 | fxA);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* 새 판을 시작할 때 두 흐름을 함께 초기화한다 */
export function setSeed(seed: number): void {
  simA = seed | 0;
  fxA = step(seed | 0);        // 같은 씨앗에서 갈라지되 서로 다른 수열
}

/* 씨앗을 안 주면 하나 만들어 돌려준다 — 판을 식별하는 값이라 기록해 둔다 */
export function makeSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) | 0 || 1;
}

/* 지금 흐름의 위치. 결정성이 깨졌는지 확인할 때 쓴다
   (같은 씨앗으로 같은 판을 돌렸으면 이 값도 같아야 한다) */
export function rngMark(): { sim: number; fx: number } {
  return { sim: simA, fx: fxA };
}
