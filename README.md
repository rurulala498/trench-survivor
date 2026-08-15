# 참호 사수 — TRENCH SURVIVOR

[![Deploy GitHub Pages](https://github.com/rurulala498/trench-survivor/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/rurulala498/trench-survivor/actions/workflows/deploy-pages.yml)

높은 방어진지에서 전장을 내려다보며 거치형 중기관총으로 좀비 웨이브를 막아내는 PC 웹 2.5D 디펜스 게임입니다.

## 바로 플레이

**[GitHub Pages에서 게임 실행하기](https://rurulala498.github.io/trench-survivor/)**

데스크톱 브라우저와 16:9 화면을 권장합니다. 첫 클릭 시 브라우저 오디오가 활성화됩니다.

## 게임 소개

폐허가 된 전장에 Walker, Runner, Brute, Boss가 거리 원근에 맞춰 몰려옵니다. 플레이어는 참호 위의 HMG를 운용하고, 웨이브 사이 보급창에서 무기와 방어선을 강화해 생존해야 합니다.

### 핵심 특징

- 거리 기반 투영과 크기 변화가 적용된 2.5D 전장
- Walker, Runner, Brute, Boss의 서로 다른 실루엣과 이동 특성
- 마우스 X축에 연동되는 프레임 기반 HMG 좌우 조준 표현
- 렌더 크기에 맞춰 변하는 머리·몸통 피격 판정과 헤드샷
- 실제 명중 지점까지 이어지는 예광탄, 총구 화염과 연기
- 3개 전방 지점에 설치하는 참호·철조망·지뢰 방어선
- 웨이브 사이 보급창, 무기 계열 선택, 업그레이드와 수리
- 전경 구조물 가림을 활용한 높은 방어진지 시점

## 조작법

| 입력 | 기능 |
| --- | --- |
| 마우스 이동 | 조준 |
| 마우스 왼쪽 버튼 | 발사 / 누르고 있으면 연사 |
| `R` | 재장전 |
| `B` | 보급창 열기·닫기 |
| `1`–`9` | 보급창 상품 선택 |
| `1` / `2` / `3` | 방어선 설치 위치 선택 |
| `Enter` 또는 `Space` | 게임 시작 / 다음 웨이브 / 전투 복귀 |
| `Esc` 또는 마우스 오른쪽 버튼 | 설치·보강 취소 |

## 로컬에서 실행

### 요구 환경

- Node.js 20 이상 권장
- npm

```bash
git clone https://github.com/rurulala498/trench-survivor.git
cd trench-survivor
npm ci
npm run dev
```

개발 서버가 시작되면 터미널에 표시되는 주소(기본값 `http://localhost:5173`)로 접속합니다.

## 주요 명령

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run build` | 타입 검사 후 프로덕션 빌드 생성 |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run balance:report` | 현재 게임 밸런스 리포트 생성 |

## 프로젝트 구조

```text
trench-survivor/
├─ src/
│  ├─ assets/        # 에셋 매니페스트와 로더
│  ├─ data/          # 적, 무기, 업그레이드, 방어선 데이터
│  ├─ render/        # 전장, 적, 총기, HUD 및 화면 렌더링
│  ├─ shop/          # 보급창과 방어선 설치 시스템
│  └─ sim/           # 투영, 조준, 전투, 웨이브 시뮬레이션
├─ public/assets/    # 게임에서 사용하는 이미지·애니메이션 에셋
├─ tools/            # 밸런스 검증 도구
└─ .github/workflows/# GitHub Pages 자동 배포
```

## 배포

`main` 브랜치에 변경 사항을 푸시하면 GitHub Actions가 타입 검사와 프로덕션 빌드를 수행한 뒤 GitHub Pages에 자동으로 배포합니다.

- 배포 주소: <https://rurulala498.github.io/trench-survivor/>
- 배포 상태: [GitHub Actions](https://github.com/rurulala498/trench-survivor/actions)

## 에셋 및 라이선스

이 저장소에는 게임용으로 제작·가공된 그래픽과 애니메이션 에셋이 포함되어 있습니다. 별도의 `LICENSE` 파일이 없으므로 소스 코드나 에셋을 재사용·재배포하기 전 저장소 소유자에게 사용 범위를 확인해 주세요.
