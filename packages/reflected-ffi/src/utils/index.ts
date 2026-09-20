import { DIRECT, SYMBOL } from "../types";
import { fromSymbol, toSymbol } from "./symbol";

// 여러 모듈이 공유하는 작은 유틸리티 함수/상수 모음이다.

export const defineProperty = Object.defineProperty;

export const assign = Object.assign;

export const fromArray = Array.from;

export const isArray = Array.isArray;

export const isView = ArrayBuffer.isView;

/** 타입 태그(DIRECT/SYMBOL)와 실제 값을 함께 담는 튜플. */
export type TypeValue = [number, unknown];

/** 타입/값 쌍을 만든다. */
export const tv = (type: number, value: unknown): TypeValue => [type, value];

export const identity = <T>(value: T): T => value;

// 재사용하는 빈 배열/객체 상수 (매번 새로 만들지 않기 위함).
export const array: unknown[] = [];
export const object: object = {};

// 콜백이 필요한 자리를 채우는 기본 no-op 함수.
/* c8 ignore start */
export const callback = function () {};
/* c8 ignore stop */

/**
 * 배열의 각 값에 변환 함수를 적용하는 loop 함수를 만든다.
 * `In`과 `Out`을 분리한 이유: `fromValue`(unknown→unknown)처럼 같은 타입을 오가는
 * 변환기뿐 아니라, `fromKey`(TypeValue→string|symbol)·`toKey`(string|symbol→TypeValue)처럼
 * 입력과 출력 타입이 다른 변환기도 `loopValues`로 감싸서 쓰기 때문이다.
 * 배열은 원본처럼 in-place로 덮어쓴다 — 새 배열을 만들지 않는다.
 */
export const loopValues =
  <In, Out = In>(asValue: (value: In, cache?: Map<unknown, unknown>) => Out) =>
  (arr: In[], cache: Map<unknown, unknown> = new Map()): Out[] => {
    const out = arr as unknown as Out[];
    for (let i = 0, length = arr.length; i < length; i++)
      out[i] = asValue(arr[i]!, cache);
    return out;
  };

/** 타입/값 쌍에서 실제 키(문자열 또는 심볼)를 복원한다. */
export const fromKey = ([type, value]: TypeValue): string | symbol =>
  type === DIRECT ? (value as string) : fromSymbol(value as string);

/** 키(문자열 또는 심볼)를 와이어로 보낼 타입/값 쌍으로 변환한다. */
export const toKey = (value: string | symbol): TypeValue =>
  typeof value === "string" ? tv(DIRECT, value) : tv(SYMBOL, toSymbol(value));

const MAX_ARGS = 0x7fff;

/**
 * `value`의 바이트를 `output`에 이어 붙인다. `Array.prototype.push`는
 * 한 번에 넘길 수 있는 인자 개수에 한계가 있어(MAX_ARGS), 큰 버퍼는
 * MAX_ARGS 단위로 잘라서 나눠 push한다.
 */
export const push = (output: number[], value: Uint8Array): void => {
  for (
    let $ = output.push, i = 0, length = value.length;
    i < length;
    i += MAX_ARGS
  )
    $.apply(output, Array.from(value.subarray(i, i + MAX_ARGS)) as number[]);
};
