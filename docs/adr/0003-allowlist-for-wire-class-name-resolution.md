# 와이어에서 읽은 클래스 이름은 allowlist로만 생성자로 해석한다 (CWE-502)

원본은 `utils/typed.js`의 `fromView`와 `direct/decoder.js`의 VIEW/ERROR 분기에서
바이트로 받은 클래스 이름 문자열을 그대로 `globalThis[name]`으로 조회해
`new Class(...)`를 실행한다(예: `const Class = globalThis[name];`). 이름이
`"Function"`/`"Worker"` 같은 전역이면 신뢰할 수 없는 입력만으로 임의 전역
생성자를 실행시킬 수 있다(CWE-502).

이 포트는 `utils/global.ts`의 `resolveViewClass`/`resolveErrorClass`로 이름 해석을
한 곳에 모으고, TypedArray/DataView 12+1종·내장 Error 서브클래스 8종의 고정
allowlist로 제한한다. VIEW는 목록 밖 이름이면 throw하고, ERROR는 원본과 동일하게
base `Error`로 폴백한다.

## Consequences

새 TypedArray 변형이나 Error 서브클래스를 지원하려면 이 allowlist
(`utils/global.ts`)를 먼저 넓혀야 한다 — decoder/typed 쪽에서 `globalThis` 조회를
직접 추가하지 않는다.
