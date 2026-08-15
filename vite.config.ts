import { defineConfig } from 'vite';

export default defineConfig({
  // 로컬 루트와 GitHub Pages의 /trench-survivor/ 하위 경로에서 모두
  // 동일한 빌드 산출물을 사용할 수 있도록 정적 리소스를 상대 경로로 낸다.
  base: './',
  // 사용자가 요청한 포트. strictPort 로 두면 이미 쓰는 중일 때 조용히
  // 다른 포트로 옮겨가지 않고 실패해서, 어디에 떠 있는지 헷갈리지 않는다.
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', assetsDir: 'assets' },
});
