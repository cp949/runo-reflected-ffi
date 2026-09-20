# runo-reflected-ffi

[reflected-ffi](https://github.com/WebReflection/reflected-ffi)(Andrea
Giammarchi, MIT)를 TypeScript로 포팅한 모노레포.

- GitHub: <https://github.com/cp949/runo-reflected-ffi>
- npm: [`@cp949/runo-reflected-ffi`](https://www.npmjs.com/package/@cp949/runo-reflected-ffi)

## 구성

- `packages/reflected-ffi` — `@cp949/runo-reflected-ffi`. TypeScript 포팅 본체.
  Vite 8 라이브러리 모드로 빌드, Vitest 5로 테스트. 최소 지원 브라우저: Chrome 84,
  Safari 14.1, Firefox 79, Edge 84.
- `apps/demo` — 메인 스레드 ↔ Worker 간 `local()`/`remote()` 연동을 실제
  브라우저에서 보여주는 Vite + vanilla TS 데모.
- `packages/eslint-config`, `packages/typescript-config` — 공유 lint/tsconfig 설정.

## 개발

```bash
pnpm install
pnpm build         # 전체 워크스페이스 빌드
pnpm test          # @cp949/runo-reflected-ffi 테스트
pnpm check-types   # 전체 워크스페이스 타입 체크
pnpm --filter demo dev   # 데모 앱 개발 서버
```

프로젝트 고유 용어는 `CONTEXT.md`, 아키텍처 결정과 이유는 `docs/adr/` 참고.
