# growable SharedArrayBuffer 격차는 feature-detect와 고정 크기 사전 할당으로 흡수한다

원본 `direct/array.js`의 `Stack._`는 `buffer.grow(byteLength)`를 조건 없이 호출한다.
`.grow()`는 Chrome 111(2023-03)부터 존재하는 메서드라 [ADR-0001](./0001-lower-browser-support-floor.md)의
floor인 Chrome 84에는 없다 — 호출 시점에 `TypeError: buffer.grow is not a function`.

이 포트의 `direct/array.ts`는 `"grow" in buffer` feature-detect를 추가한다.
growable이 아닌 버퍼가 용량을 초과하면 native `TypeError` 대신 원인이 드러나는
`RangeError`를 던진다. `Stack._`는 공개 API라 모던 브라우저의 실제 growable
`SharedArrayBuffer` 지원 자체는 그대로 유지한다 — `.grow()` 호출을 제거하지 않는다.

`apps/demo/src/worker-bridge.ts`(원본에 대응 파일 없음, 이 포트의 데모 전용 코드)는
필요한 최대 용량(1MiB)을 처음부터 고정 할당해 `.grow()`가 필요한 상황 자체를
없앤다 — growable `SharedArrayBuffer`는 "이미 전달된 참조가 grow() 이후에도
재전송 없이 같은 메모리를 보는" 성질이 핵심이라, 새 고정 버퍼를 할당해 복사하는
방식으로는 재현할 수 없기 때문이다.

## Consequences

새 워커 브리지를 추가할 때 growable SAB로 동적 확장하는 패턴을 쓰지 않는다 —
필요한 최대 크기를 먼저 정하고 고정 할당한다.
