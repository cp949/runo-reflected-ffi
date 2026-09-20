import query from "./query";

// GATHER 트랩에서 여러 키를 한 번에 조회할 때 쓰는 유틸리티.

/** `target`에서 `keys`로 지정한 각 경로/속성에 해당하는 값을 순서대로 모아 반환한다. */
export default (target: unknown, ...keys: (string | symbol)[]): unknown[] =>
  keys.map(asResult, target);

// `keys.map`의 두 번째 인자로 `target`을 넘겨 `this`로 받는다(클로저 생성을 피하기 위함).
function asResult(this: unknown, key: string | symbol): unknown {
  return typeof key === "string"
    ? query(this, key)
    : (this as Record<symbol, unknown>)[key as symbol];
}
