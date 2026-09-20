// direct 코덱이 값 하나하나 앞에 붙이는 타입 태그. 정의 순서 자체에는 의미가
// 없고, 각 상수 값이 곧 와이어 포맷상의 식별자다.
let i = 0;

export const FALSE = i++;
export const TRUE = i++;

export const UNDEFINED = i++;
export const NULL = i++;

// 자주 나오는 숫자값(0, -0, NaN, ±Infinity, 0~255 사이 정수)은 8바이트
// float64 인코딩 없이 태그 하나로만 표현해 크기를 줄인다.
export const NUMBER = i++;
export const UI8 = i++;
export const NAN = i++;
export const INFINITY = i++;
export const N_INFINITY = i++;
export const ZERO = i++;
export const N_ZERO = i++;

export const BIGINT = i++;
export const BIGUINT = i++;

export const STRING = i++;

export const SYMBOL = i++;

// 컨테이너/내장 객체 타입 — RECURSION의 백레퍼런스 대상이 되는 타입들이다.
export const ARRAY = i++;
export const BUFFER = i++;
export const DATE = i++;
export const ERROR = i++;
export const MAP = i++;
export const OBJECT = i++;
export const REGEXP = i++;
export const SET = i++;
export const VIEW = i++;

// 브라우저 전용 타입 — Node 등 해당 전역이 없는 환경에서는 web.ts의 대체
// 클래스(ImageData)를 거치거나, encoder 쪽에서 애초에 만들어질 일이 없다.
export const IMAGE_DATA = i++;
export const BLOB = i++;
export const FILE = i++;

// 이미 인코딩한 참조를 다시 가리키는 백레퍼런스 태그 — 순환 참조를 복원한다.
export const RECURSION = i;
