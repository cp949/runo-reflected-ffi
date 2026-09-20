# 공개 export는 원본의 죽은 export 2개를 제외한 17개로 확정한다

원본 `package.json`의 `exports` 맵에는 19개 subpath가 있지만, 그중 2개는 존재하지
않는 파일을 가리킨다.

- `./evaluate` → `src/utils/evaluate.js`: 파일 자체가 없다. `evaluate` 기능은
  `local()`/`remote()`가 반환하는 객체의 인라인 메서드로 존재하므로 기능 손실이
  아니다.
- `./utils/view` → `src/utils/view.js`: 파일 자체가 없다. view(TypedArray) 변환
  기능(`fromView`/`toView`)은 `utils/typed.ts`에 내부 전용으로 존재하고, 원본에도
  이를 가리키는 공개 export가 없다.

이 포트는 이 2개를 제외한 17개 subpath만 노출하고 `build.lib.entry`/
`package.json`의 `exports` 맵에 1:1 대응시킨다. 그대로 이식하면 Vite 빌드가
존재하지 않는 엔트리를 참조해 실패한다.

## Consequences

원본과 export 표면을 비교할 때 이 2개 차이는 의도된 것이다 — 새로 발견한 누락으로
착각해 재도입하지 않는다.
