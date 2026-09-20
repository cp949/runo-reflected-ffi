import { object } from "./index";

// 클래스 이름을 와이어로 내보내거나(toName/toTag), 반대로 와이어에서 읽은
// 이름을 생성자로 되돌리는(resolveViewClass/resolveErrorClass) 유틸리티다.
// 후자는 globalThis[name]을 무검증으로 조회하면 "Function"/"Worker" 같은
// 이름으로 임의 전역 생성자를 실행시킬 수 있어, 허용 목록만 거치도록
// 강제한다(ADR-0003).

const { getPrototypeOf } = Object;
const { construct } = Reflect;
const { toStringTag } = Symbol;
const { toString } = object as { toString(): string };

/**
 * `ref`의 생성자 이름 중 globalThis에 실제로 존재하는 것을 찾아 반환한다.
 * `Object.prototype.toString`이 주는 이름(`[object Foo]`의 Foo)에서 시작해,
 * globalThis에 없으면 프로토타입 체인을 따라 올라가며 다시 찾는다.
 */
export const toName = (
  ref: unknown,
  name: string = toString.call(ref).slice(8, -1),
): string =>
  name in globalThis ? name : toName(getPrototypeOf(ref) || object);

/**
 * `ref`의 `Symbol.toStringTag` 값 중 globalThis에 실제로 존재하는 것을 찾아
 * 반환한다. globalThis에 없으면 부모 생성자의 인스턴스를 만들어 그 태그로
 * 다시 찾는다(에러 서브클래스처럼 toStringTag가 상속되는 경우를 위함).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ref는 임의의 생성자/프로토타입 체인 노드라 구체 타입이 없다.
export const toTag = (ref: any, name: string = ref[toStringTag]): string =>
  name in globalThis
    ? name
    : toTag(construct(getPrototypeOf(ref.constructor), [0]));

// resolveViewClass가 허용하는 TypedArray/DataView 클래스 이름.
const VIEW_CLASSES = new Set([
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float16Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  "DataView",
]);

// resolveErrorClass가 허용하는 Error 서브클래스 이름.
const ERROR_CLASSES = new Set([
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "AggregateError",
]);

/** 허용 목록에 있는 이름으로만 TypedArray/DataView 생성자를 반환한다. 목록에 없으면 에러를 던진다. */
export const resolveViewClass = (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TypedArray/DataView 생성자마다 시그니처가 달라 공통 타입이 없다.
): new (...args: any[]) => ArrayBufferView => {
  if (!VIEW_CLASSES.has(name))
    throw new Error(`reflected-ffi: unsupported view class "${name}"`);
  return (
    globalThis as unknown as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 위와 동일한 이유.
      new (...args: any[]) => ArrayBufferView
    >
  )[name]!;
};

/** 허용 목록에 있는 이름이면 해당 Error 서브클래스를, 아니면 기본 `Error`를 반환한다. */
export const resolveErrorClass = (name: string): ErrorConstructor =>
  ERROR_CLASSES.has(name)
    ? (globalThis as unknown as Record<string, ErrorConstructor>)[name]!
    : Error;
