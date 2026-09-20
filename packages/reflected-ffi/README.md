# @cp949/runo-reflected-ffi

[reflected-ffi](https://github.com/WebReflection/reflected-ffi)(Andrea
Giammarchi, MIT)를 TypeScript로 포팅한, `Proxy` 기반 원격 FFI(Foreign Function
Interface) 라이브러리.

- GitHub: <https://github.com/cp949/runo-reflected-ffi>
- npm: [`@cp949/runo-reflected-ffi`](https://www.npmjs.com/package/@cp949/runo-reflected-ffi)

최소 지원 브라우저: Chrome 84, Safari 14.1, Firefox 79, Edge 84.

아키텍처와 API는 원본 프로젝트의 README를 참고한다. 이 포트는 TypeScript 타입과
더 낮은 브라우저 호환성 빌드 타겟을 추가했고, 원본 런타임 동작과 다음과 같이
의도적으로 다르다.

- `LocalOptions.timeout`과 `RemoteOptions.buffer`를 제거했다(breaking). GET
  트랩 응답(`[shouldCache, [type, value]]`)과 VIEW/BUFFER 페이로드
  (`BufferDetails`)가 self-describing해져, 두 peer가 이 옵션을 다르게 설정해도
  wire 모양이 어긋나지 않는다. 원본은 두 peer가 같은 값을 넘긴다고 암묵적으로
  가정했고, 어긋나면 `globalThis.Math` 같은 전역 조회가 조용히 숫자로 깨졌다
  ([ADR-0007](https://github.com/cp949/runo-reflected-ffi/blob/main/docs/adr/0007-self-describing-wire-tags-for-cross-peer-options.md)).
- 와이어에서 읽은 클래스 이름(`decoder`, `fromView`)은 검증 없는
  `globalThis[name]` 조회 대신 고정 allowlist로 해석한다 — 그대로 두면
  신뢰할 수 없는 입력으로 임의 전역 생성자를 실행시킬 수 있다
  ([ADR-0003](https://github.com/cp949/runo-reflected-ffi/blob/main/docs/adr/0003-allowlist-for-wire-class-name-resolution.md)).
- growable이 아닌 `SharedArrayBuffer`가 용량을 초과하면 Chrome 111 미만
  브라우저에서 native `TypeError` 대신 원인이 드러나는 `RangeError`를 던진다
  ([ADR-0002](https://github.com/cp949/runo-reflected-ffi/blob/main/docs/adr/0002-fixed-size-buffer-for-growable-sharedarraybuffer-gap.md)).
- 존재하지 않는 파일을 가리키던 원본의 `exports` 항목 2개(`./evaluate`,
  `./utils/view`)는 제외했다
  ([ADR-0006](https://github.com/cp949/runo-reflected-ffi/blob/main/docs/adr/0006-public-export-surface-excludes-two-dead-upstream-exports.md)).

GET 이외의 트랩(APPLY/SET/DELETE/OWN_KEYS 등) 동작은 원본과 동일하다.
