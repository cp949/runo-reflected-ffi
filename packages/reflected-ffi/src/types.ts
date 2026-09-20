// local()/remote()가 주고받는 `TypeValue`([type, value])의 `type` 태그 비트
// 플래그다. `REMOTE` 비트는 값이 로컬에 그대로 담을 수 없고 상대 peer의
// 참조(heap의 uid)로 다뤄야 함을 뜻하고, 나머지 비트는 값의 종류를 나타낸다.
// `direct/types.ts`의 동명 상수(ERROR, STRING, VIEW, BIGINT)는 direct 코덱
// 전용 별도 열거값으로, 이 파일과는 무관하다.

export const DIRECT = 0;
export const REMOTE = 1 << 0;
export const OBJECT = 1 << 1;
export const ARRAY = 1 << 2;
export const FUNCTION = 1 << 3;
export const SYMBOL = 1 << 4;
export const BIGINT = 1 << 5;
export const BUFFER = 1 << 6;
export const STRING = 1 << 7;
// (1 << 8) + ~REMOTE = 254(0b11111110): REMOTE를 제외한 나머지 값-종류
// 비트를 전부 켠 값이라, 위 단일/합성 태그 어느 것과도 겹치지 않는다.
export const ERROR = (1 << 8) + ~REMOTE;

// 버퍼 뷰(TypedArray/DataView)를 가리키는 합성 태그.
export const VIEW = BUFFER | ARRAY;
export const REMOTE_OBJECT = REMOTE | OBJECT;
export const REMOTE_ARRAY = REMOTE | ARRAY;
export const REMOTE_FUNCTION = REMOTE | FUNCTION;
