# peer별 timeout/buffer 옵션이 wire 모양을 결정하던 설계를 self-describing 태그로 바꾼다

원본(WebReflection/reflected-ffi)과 이 포트는 지금까지 `local()`의 `timeout`(→
내부 `memoize` 플래그)과 `buffer` 옵션, `remote()`의 `timeout`(→ `memoize`)과
`buffer` 옵션을 각 peer가 서로 독립적으로 해석해 GET 트랩 응답 모양과
VIEW/BUFFER 페이로드 모양을 결정했다. 두 peer가 이 옵션을 다르게 설정하면 wire
모양이 어긋나 조용히 데이터가 깨진다 — 재현: `remote({ timeout: 50 })`가
`local({ timeout: -1 })`과 통신하면, local은 GET 응답을 bare
`[type, value]`로 보내는데 remote는 memoize가 켜져 있어 이를
`[cache, value]`로 잘못 destructure한다. 그 결과 `globalThis.Math` 같은 전역
조회가 Proxy 대신 숫자로 깨진다. `buffer`/`direct` 조합도 같은 구조다 —
`utils/typed.ts`의 `toBuffer`/`fromBuffer`/`toView`/`fromView`가 encode 쪽과
decode 쪽에서 각자 독립적으로 `direct: boolean`을 유도해, 두 peer의 `buffer`
설정이 다르면 버퍼가 깨지거나 잘못된 타입이 조용히 반환된다.

upstream 테스트도, 이 포트의 기존 통합 테스트(`test/integration.test.ts`의
`bootstrap()`)도 항상 두 peer에 같은 값을 넘겨서 생성해왔다 — 이 불일치는 원본도
검증한 적 없는 암묵적 계약이었다. 포팅이 새로 만든 버그가 아니라 원본부터 있던
gap이다.

이 포트는 GET 응답과 VIEW/BUFFER 페이로드를 self-describing하게 바꾼다.
`local.ts`의 GET 케이스는 이제 자신의 설정과 무관하게 항상
`[shouldCache, [type, value]]` 2-tuple을 반환하고, `remote.ts`의
`Handler#get`은 memoize 여부와 무관하게 항상 그 튜플을 destructure한다(단,
memoize가 켜져 있고 캐시 hit이면 reflect 자체를 다시 호출하지 않는 lazy-fetch는
유지한다). `utils/typed.ts`의 `BufferDetails`는 `[value, maxByteLength]`에서
`[isDirect, value, maxByteLength]`로 바뀌어, `fromBuffer`/`fromView`가 더 이상
`direct` 파라미터를 받지 않고 페이로드 자체에서 인코딩 방식을 읽는다.

그 결과 `LocalOptions.timeout`과 `RemoteOptions.buffer`는 더 이상 아무 역할이
없어 제거했다(breaking). `local()`은 원래도 아무것도 캐싱하지 않았고(캐싱은
`remote()`의 `Memo`가 한다) `timeout`은 GET 응답을 감쌀지만 결정했을 뿐이다.
`remote()`의 `buffer`도 decode 방식을 이제 페이로드가 말해주므로 더 이상
필요 없다. deprecated stub은 남기지 않는다 — v0.1.0 단계라 breaking 비용이
낮고, "설정해도 안 먹히는" 필드를 남기면 새로운 함정이 생긴다.

## Consequences

- `LocalOptions`에는 이제 `timeout`이 없다 — 원격 값 캐싱 여부는 오직
  `remote()` 쪽 `timeout`이 결정한다.
- `RemoteOptions`에는 이제 `buffer`가 없다 — 버퍼/뷰 인코딩 방식은 오직
  `local()` 쪽 `buffer`가 결정하고, `remote()`는 페이로드를 보고 그대로
  따른다.
- 새로운 VIEW/BUFFER류 페이로드를 설계할 때 `BufferDetails`의 첫 필드
  (`isDirect`)를 생략하지 않는다 — decode는 파라미터가 아니라 이 필드로 모양을
  판단한다.
- GET 이외의 트랩(OWN_KEYS, GET_PROTOTYPE_OF 등)은 애초에 local이 memoize로
  분기하지 않으므로 이번 변경과 무관하다 — remote 쪽 캐싱 여부만 각자
  `timeout`으로 결정한다.
