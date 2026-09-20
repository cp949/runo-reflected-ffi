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

## 원본과 다른 점

- 소스: 원본(`reflected-ffi` 0.7.2)은 JSDoc 주석 + `tsc --allowJs --checkJs`로
  `.d.ts`만 별도 생성하는 순수 JS다. 이 포트는 `packages/reflected-ffi/src/`를
  실제 TypeScript로 재작성했다.
- 테스트: 원본은 `c8 node --expose-gc test/index.js` 커스텀 러너를 쓴다. 이
  포트는 Vitest로 옮기고 테스트를 트랩/모듈 단위 파일로 재구성했다
  (`packages/reflected-ffi/test/*.test.ts`).
- Python 바인딩(원본의 `python/`, PyPI 패키지 `reflected_ffi`)은 포함하지
  않는다 — 이 포트는 JS/TS 전용이다.
- 런타임 동작 차이(보안 수정, breaking wire 포맷 변경 등)는
  [`packages/reflected-ffi/README.md`](./packages/reflected-ffi/README.md)와
  `docs/adr/`에 정리돼 있다.

## 개발

```bash
pnpm install
pnpm build         # 전체 워크스페이스 빌드
pnpm test          # @cp949/runo-reflected-ffi 테스트
pnpm check-types   # 전체 워크스페이스 타입 체크
pnpm demo          # 데모 앱 개발 서버
```

프로젝트 고유 용어는 `CONTEXT.md`, 아키텍처 결정과 이유는 `docs/adr/` 참고.
