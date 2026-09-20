# local()/remote()는 peer당 인스턴스를 하나만 생성한다

`heap`의 uid는 0부터 증가하는 순차 카운터이고, `reflect()`는 발급 대상 peer를
확인하지 않는다. 원본도 동일한 구조다 — 이 포트가 바꾼 것이 아니라 원본과 같은
제약을 명시적으로 문서화한 것이다.

같은 인스턴스의 reflect를 여러 peer가 공유하면 한 peer에게 준 uid를 다른 peer가
추측해 재사용할 수 있고, `local.ts`의 weakRefs(remote 함수 uid → 로컬 wrapper
캐시)도 uid로만 키가 잡혀 있어 서로 다른 peer의 함수가 같은 wrapper로 섞이는
정합성 문제까지 겹친다. 따라서 peer 하나당 `local()`/`remote()`를 하나씩 만드는
것이 계약이다 — 데모·테스트 전부 이 패턴을 따른다.

## Consequences

여러 peer를 동시에 다루는 기능을 추가하려면 peer별로 독립된 `local()`/`remote()`
인스턴스(별도 heap)를 만들어야 한다. 하나의 인스턴스를 여러 peer가 공유하면 안
된다.
