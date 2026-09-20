# 최소 지원 브라우저를 Chrome 84 / Safari 14.1 / Firefox 79 / Edge 84로 낮춘다

원본은 `tsc --target esnext`만 지정하고 별도 브라우저 지원 범위를 명시하지 않는다.
이 포트는 빌드 타겟을 `['chrome84', 'safari14.1', 'firefox79', 'edge84']`로
명시한다.

Safari는 14.0이 아닌 14.1을 기준으로 삼는다 — 14.0(2020-09)은 `WeakRef`/
`FinalizationRegistry`를 지원하지 않고, 14.1(2021-04)부터 지원되기 때문이다.
`Proxy`/`Reflect`/`WeakRef`/`FinalizationRegistry`는 이 라이브러리가 폴리필 없이
요구하는 네이티브 API이고, 이 네 브라우저 모두 별도 폴리필 없이 지원한다. `Proxy`를
지원하지 않는 환경(예: IE11)은 폴리필이 불가능하므로 지원 대상에서 제외한다.

## Consequences

이 floor보다 낮은 런타임 API 격차(예: growable `SharedArrayBuffer`)가 발견되면
[ADR-0002](./0002-fixed-size-buffer-for-growable-sharedarraybuffer-gap.md)처럼
개별적으로 대응한다 — floor 자체를 다시 올리는 것은 최후 수단이다.
