# reflect()에는 인가 레이어가 없다 — 필터링은 브리지 레이어 책임이다

`local.reflect`/`remote.reflect`는 도달하는 모든 trap(`EVALUATE` 포함)을 무조건
허용한다. 원본도 동일하다 — 이 포트가 새로 만든 제약이 아니라, 원본과 같은
아키텍처를 명시적으로 문서화한 것이다.

`local.ts`/`remote.ts`는 전송(postMessage 등)을 직접 다루지 않는다. 앱은 reflect를
호출하기 전에 이미 method/uid를 와이어에서 파싱하는 브리지 코드를 갖고 있으므로,
인가·필터링은 그 브리지 레이어에서 걸러야 한다. trap 상수(`GET`/`EVALUATE`/...)는
`./traps`로 공개돼 있어 브리지 코드가 추가 export 없이 바로 값을 검사할 수 있다.

## Consequences

reflected-ffi 자체를 신뢰 경계로 쓰지 않는다. `EVALUATE`처럼 위험한 trap을
제한하려는 앱은 반드시 브리지 코드에서 method 값을 검사해야 한다.
