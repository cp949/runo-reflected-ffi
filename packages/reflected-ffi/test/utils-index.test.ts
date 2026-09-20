import { describe, expect, it } from "vitest";
import { fromKey, loopValues, push, toKey, tv } from "../src/utils/index";
import { DIRECT, SYMBOL } from "../src/types";

describe("utils/index", () => {
  it("tv는 [type, value] 튜플을 만든다", () => {
    expect(tv(DIRECT, "x")).toEqual([DIRECT, "x"]);
  });

  it("toKey/fromKey는 문자열 키를 왕복한다", () => {
    const pair = toKey("hello");
    expect(pair).toEqual([DIRECT, "hello"]);
    expect(fromKey(pair)).toBe("hello");
  });

  it("toKey/fromKey는 symbol 키를 왕복한다", () => {
    const pair = toKey(Symbol.iterator);
    expect(pair[0]).toBe(SYMBOL);
    expect(fromKey(pair)).toBe(Symbol.iterator);
  });

  it("loopValues는 배열을 in-place로 변환한다", () => {
    const double = loopValues((n: number) => n * 2);
    const arr = [1, 2, 3];
    const result = double(arr);
    expect(result).toBe(arr);
    expect(arr).toEqual([2, 4, 6]);
  });

  it("push는 0x7FFF 청크로 나눠서 배열에 밀어넣는다", () => {
    const output: number[] = [];
    const value = new Uint8Array(0x7fff + 10).fill(7);
    push(output, value);
    expect(output.length).toBe(value.length);
    expect(output.every((v) => v === 7)).toBe(true);
  });
});
