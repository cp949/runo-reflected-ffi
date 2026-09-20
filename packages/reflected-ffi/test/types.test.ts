import { describe, expect, it } from "vitest";
import {
  ARRAY,
  BIGINT,
  BUFFER,
  DIRECT,
  ERROR,
  FUNCTION,
  OBJECT,
  REMOTE,
  REMOTE_ARRAY,
  REMOTE_FUNCTION,
  REMOTE_OBJECT,
  STRING,
  SYMBOL,
  VIEW,
} from "../src/types";
import {
  APPLY,
  ASSIGN,
  CONSTRUCT,
  EVALUATE,
  GATHER,
  GET,
  OWN_KEYS,
  QUERY,
  SET,
  UNREF,
} from "../src/utils/traps";

describe("types.ts", () => {
  it("DIRECT는 0이고 REMOTE 계열은 서로 다른 비트를 사용한다", () => {
    expect(DIRECT).toBe(0);
    expect(REMOTE).toBe(1 << 0);
    expect(OBJECT).toBe(1 << 1);
    expect(ARRAY).toBe(1 << 2);
    expect(FUNCTION).toBe(1 << 3);
    expect(SYMBOL).toBe(1 << 4);
    expect(BIGINT).toBe(1 << 5);
    expect(BUFFER).toBe(1 << 6);
    expect(STRING).toBe(1 << 7);
    expect(ERROR).toBe((1 << 8) + ~REMOTE);
  });

  it("합성 플래그는 REMOTE와 각 타입 비트의 OR다", () => {
    expect(REMOTE_OBJECT).toBe(REMOTE | OBJECT);
    expect(REMOTE_ARRAY).toBe(REMOTE | ARRAY);
    expect(REMOTE_FUNCTION).toBe(REMOTE | FUNCTION);
    expect(VIEW).toBe(BUFFER | ARRAY);
  });
});

describe("utils/traps.ts", () => {
  it("trap 상수는 0부터 순차적으로 증가하고 서로 겹치지 않는다", () => {
    const traps = [
      UNREF,
      ASSIGN,
      EVALUATE,
      GATHER,
      QUERY,
      APPLY,
      CONSTRUCT,
      SET,
      GET,
      OWN_KEYS,
    ];
    expect(new Set(traps).size).toBe(traps.length);
    expect(UNREF).toBe(0);
    expect(ASSIGN).toBe(1);
    expect(EVALUATE).toBe(2);
    expect(GATHER).toBe(3);
    expect(QUERY).toBe(4);
    expect(APPLY).toBe(5);
  });
});
