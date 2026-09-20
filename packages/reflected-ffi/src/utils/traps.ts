// reflect가 method 인자로 주고받는 연산 코드다. 값은 와이어 프로토콜의 일부이므로
// 순서를 바꾸거나 중간에 끼워 넣지 말고 끝에만 추가한다.
let i = 0;

// trap이 아닌 확장 명령(unref, EVALUATE/GATHER/QUERY 같은 편의 호출, ASSIGN).
export const UNREF = i++;
export const ASSIGN = i++;
export const EVALUATE = i++;
export const GATHER = i++;
export const QUERY = i++;

// Proxy handler가 가로채는 표준 트랩. 이름은 각 트랩에 대응하는 Reflect 메서드와 같다.
export const APPLY = i++;
export const CONSTRUCT = i++;
export const DEFINE_PROPERTY = i++;
export const DELETE_PROPERTY = i++;
export const GET = i++;
export const GET_OWN_PROPERTY_DESCRIPTOR = i++;
export const GET_PROTOTYPE_OF = i++;
export const HAS = i++;
export const IS_EXTENSIBLE = i++;
export const OWN_KEYS = i++;
export const PREVENT_EXTENSIONS = i++;
export const SET = i++;
export const SET_PROTOTYPE_OF = i++;
