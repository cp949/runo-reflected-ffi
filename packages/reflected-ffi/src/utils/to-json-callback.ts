// 출처: https://github.com/WebReflection/to-json-callback (별도 의존성을 두지
// 않기 위해 이 저장소에 직접 가져왔다.)

/**
 * 함수를 문자열로 직렬화하되, `foo(args) { ... }`처럼 `function` 키워드가
 * 빠진 축약(메서드) 표기는 `function foo(args) { ... }` 형태로 보정한다.
 * 원격 쪽에서 문자열을 다시 함수 선언으로 eval/재구성할 수 있게 하기 위함이다.
 * `this`로 콜백을 넘겨받아 `Function.prototype.toJSON`으로도 쓸 수 있다.
 */
export default function toJSONCallback(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Function.prototype.toJSON을 흉내내려면 클래스까지 포괄하는 네이티브 Function 타입이 필요하다.
  this: Function | void,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 위와 동일한 이유.
  callback: Function = this as Function,
): string {
  return String(callback).replace(
    /^(async\s*)?(\bfunction\b)?(.*?)\(/,
    (
      _match,
      isAsync: string | undefined,
      fn: string | undefined,
      name: string,
    ) => (name && !fn ? `${isAsync || ""}function ${name}(` : _match),
  );
}
