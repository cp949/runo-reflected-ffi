# 도메인 문서

에이전트 스킬이 이 저장소의 도메인 문서를 어떻게 소비해야 하는지 정의한다.

## 탐색 전에 읽는다

- 루트 **`CONTEXT.md`** — 프로젝트 고유 용어(`local()`/`remote()`/reflect/trap/uid/
  heap 등)와 피해야 할 표현.
- **`docs/adr/`** — 작업 영역과 관련된 ADR. 특히 브라우저 호환성, export 표면,
  reflect의 인가 경계, allowlist, peer-per-instance 불변식은 코드만 보고는 이유를
  알 수 없다.

파일이 없으면 조용히 넘어간다. 없다고 지적하거나 미리 만들자고 제안하지 않는다.

## 구조

이 저장소는 single-context 구조를 쓴다.

```
/
├── CONTEXT.md
└── docs/adr/
    ├── 0001-lower-browser-support-floor.md
    ├── 0002-fixed-size-buffer-for-growable-sharedarraybuffer-gap.md
    ├── ...
```

`packages/reflected-ffi`가 사실상 유일한 도메인이므로(`apps/demo`는 시연용,
`packages/eslint-config`/`packages/typescript-config`는 설정 공유용) 패키지별로
문서를 나누지 않는다.

## 용어 사용

출력(이슈 제목, 리팩토링 제안, 테스트 이름)에서 도메인 개념을 가리킬 때는
`CONTEXT.md`가 정의한 용어를 쓴다. 글로서리가 피하라고 명시한 동의어로 흐르지
않는다.

필요한 개념이 글로서리에 없으면, 그건 신호다 — 프로젝트가 쓰지 않는 말을
만들어내고 있거나(재고할 것), 진짜 빈틈이 있는 것이다(다음 도메인 정리 때
채운다).

## ADR 충돌 표시

출력이 기존 ADR과 모순되면 조용히 덮어쓰지 않고 명시적으로 드러낸다.

> ADR-0005(reflect에 인가 레이어 없음)와 모순됨 — 그래도 재검토할 가치가 있다면
> 이유는...
