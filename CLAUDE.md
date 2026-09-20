# CLAUDE.md

이 저장소에서 작업하는 모든 에이전트가 따르는 실행 규칙이다.

## 작업 시작 순서

1. `CONTEXT.md` — 프로젝트 고유 용어(`local()`/`remote()`/reflect/trap/uid/heap 등).
2. 관련 GitHub Issue — 목표, 포함·제외 범위, 완료 기준.
3. `docs/adr/` — 작업 영역과 관련된 결정과 이유.

문서가 코드의 현재 동작과 다르면 코드·테스트를 사실로 취급하고 차이를 보고한다.

## 아키텍처 불변식

- 최소 지원 브라우저는 Chrome 84 / Safari 14.1 / Firefox 79 / Edge 84다
  ([ADR-0001](./docs/adr/0001-lower-browser-support-floor.md)).
- growable `SharedArrayBuffer`의 `.grow()`는 Chrome 84에 없다 — `direct/array.ts`는
  `"grow" in buffer` feature-detect로 진단 가능한 에러를 던지고, 워커 브리지는
  필요한 최대 크기를 고정 할당한다
  ([ADR-0002](./docs/adr/0002-fixed-size-buffer-for-growable-sharedarraybuffer-gap.md)).
- 와이어에서 읽은 클래스 이름으로 생성자를 해석할 때는 `utils/global.ts`의
  allowlist(`resolveViewClass`/`resolveErrorClass`)만 거친다. decoder/typed
  쪽에서 `globalThis` 조회를 직접 추가하지 않는다
  ([ADR-0003](./docs/adr/0003-allowlist-for-wire-class-name-resolution.md)).
- `reflect()`에는 인가 레이어가 없다 — trap 필터링은 앱의 브리지 레이어 책임이다
  ([ADR-0004](./docs/adr/0004-no-authorization-layer-in-reflect.md)).
- `local()`/`remote()`는 peer당 인스턴스를 하나만 만든다
  ([ADR-0005](./docs/adr/0005-one-instance-per-peer.md)).
- 공개 export는 17개 subpath로 고정돼 있다. 원본에 있던 `./evaluate`,
  `./utils/view`는 죽은 export였고 의도적으로 제외했다
  ([ADR-0006](./docs/adr/0006-public-export-surface-excludes-two-dead-upstream-exports.md)).
- GET 트랩 응답과 VIEW/BUFFER 페이로드는 self-describing이다 — local의
  GET은 항상 `[shouldCache, [type, value]]`를 반환하고, `BufferDetails`는
  `[isDirect, value, maxByteLength]`로 인코딩 방식을 스스로 담는다. peer별
  옵션(local의 `timeout`, remote의 `buffer`)으로 wire 모양을 추측하지 않는다
  ([ADR-0007](./docs/adr/0007-self-describing-wire-tags-for-cross-peer-options.md)).

## 검증

```bash
pnpm --filter @cp949/runo-reflected-ffi test
pnpm --filter @cp949/runo-reflected-ffi check-types
pnpm build
pnpm check-types
pnpm lint
```

문서만 변경한 경우 최소 `git diff --check`, `git status --short`를 실행한다.

## 문서 책임

- 프로젝트 고유 용어: `CONTEXT.md`
- 장기 아키텍처 결정과 이유: `docs/adr/`
- 실행 계획과 진행 상태: GitHub Issues (`docs/agents/issue-tracker.md`)
- 이슈 트래커 소비 규칙: `docs/agents/issue-tracker.md`
- 도메인 문서 소비 규칙: `docs/agents/domain.md`

같은 사실을 여러 문서에 원본처럼 복제하지 않는다.

## Git

기본 브랜치는 `main`이다. 사용자가 그 세션에서 명시적으로 지시하기 전까지 push,
force-push, `git reset --hard`를 실행하지 않는다. 기존 modified/untracked 파일은
사용자 작업으로 간주하고 보존한다.

## Agent skills

### 이슈 트래커

작업은 `cp949/runo-reflected-ffi` GitHub Issues에서 관리한다. 자세한 내용은
`docs/agents/issue-tracker.md`를 참조한다.

### Triage 라벨

다섯 가지 표준 triage 역할을 라벨 문자열로 그대로 매핑해 쓴다. 자세한 내용은
`docs/agents/triage-labels.md`를 참조한다.

### 도메인 문서

이 저장소는 single-context 도메인 문서 구조를 쓴다. 자세한 내용은
`docs/agents/domain.md`를 참조한다.
