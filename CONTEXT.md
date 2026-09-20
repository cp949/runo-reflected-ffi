# runo-reflected-ffi

[WebReflection/reflected-ffi](https://github.com/WebReflection/reflected-ffi)
(커밋 `3c44a80`, 2026-04-09)를 TypeScript로 포팅한 `Proxy` 기반 원격
FFI(Foreign Function Interface) 라이브러리. 이 문서는 `packages/reflected-ffi`
코드베이스 고유의 용어를 정의한다.

## Language

**local()**:
로컬 객체를 감싸 원격에서 오는 trap 호출을 수신·처리하는 리시버를 만드는 함수.
`src/local.ts`.
_Avoid_: 서버, 호스트

**remote()**:
반대편 `local()`이 감싼 객체를 로컬에서 `Proxy`로 그대로 다룰 수 있게 해주는
클라이언트를 만드는 함수. `src/remote.ts`.
_Avoid_: 클라이언트, 스텁

**reflect**:
`local()`/`remote()`가 서로 주고받는 단일 함수
`(method: number, uid, ...args) => result`. 전송 수단(postMessage 등)은 reflect
밖에서 앱이 구현한다 — reflect 자체는 전송 방식을 모른다.

**peer**:
reflect 채널로 연결된 상대방 하나. `local()`/`remote()` 인스턴스는 peer 하나당
하나씩만 만든다([ADR-0005](./docs/adr/0005-one-instance-per-peer.md)).
_Avoid_: 세션, 연결

**bridge 레이어**:
reflect를 호출하기 전, 전송 계층에서 method/uid를 와이어로부터 파싱하는 앱 측
코드. reflect 자체에는 인가 레이어가 없으므로 trap 필터링·인가는 여기서
한다([ADR-0004](./docs/adr/0004-no-authorization-layer-in-reflect.md)).

**trap**:
`Proxy` handler가 가로채는 연산의 종류를 나타내는 정수 상수(`GET`, `SET`,
`APPLY`, `EVALUATE` 등). `utils/traps.ts`에 정의.

**uid**:
`heap`이 참조 하나에 부여하는 int32 식별자. 0부터 증가하는 순차 카운터이고 peer
간에 공유되지 않는다.

**heap**:
참조(ref)와 `uid`를 양방향으로 매핑해 보관하는 저장소. `local()` 쪽에서 원격에
노출한 객체·함수를 추적하는 데 쓴다.

**direct 코덱**:
reflect 메시지를 이진 포맷으로 인코딩·디코딩하는 독립 계층(`direct/`). `Proxy`
트랩과 무관하게 단독으로도 쓸 수 있다.

**Memo**:
`remote()`가 `get`/`ownKeys`/`getPrototypeOf` 트랩 결과를 짧게 캐싱하는
read-through 캐시(`utils/memo.ts`). `memoize: false`로 끌 수 있다.
