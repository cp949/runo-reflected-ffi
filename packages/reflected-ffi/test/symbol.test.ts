import { describe, expect, it } from "vitest";
import { fromSymbol, toSymbol } from "../src/utils/symbol";

describe("utils/symbol", () => {
  it("well-known symbol은 @<name>으로 인코딩된다", () => {
    expect(toSymbol(Symbol.iterator)).toBe("@iterator");
  });

  it("전역 registry symbol은 #<key>로 인코딩된다", () => {
    expect(toSymbol(Symbol.for("iterator"))).toBe("#iterator");
  });

  it("description이 있는 로컬 symbol은 !<description>으로 인코딩된다", () => {
    expect(toSymbol(Symbol("iterator"))).toBe("!iterator");
  });

  it("description이 없는 symbol은 ?로 인코딩된다", () => {
    expect(toSymbol(Symbol())).toBe("?");
  });

  it("fromSymbol(toSymbol(x))는 well-known symbol에 대해 동일한 참조를 복원한다", () => {
    expect(fromSymbol(toSymbol(Symbol.iterator))).toBe(Symbol.iterator);
    expect(fromSymbol(toSymbol(Symbol.for("iterator")))).toBe(
      Symbol.for("iterator"),
    );
  });

  it("fromSymbol(toSymbol(x))는 로컬 symbol에 대해 description만 보존한다", () => {
    expect(fromSymbol(toSymbol(Symbol("iterator"))).description).toBe(
      "iterator",
    );
    expect(fromSymbol(toSymbol(Symbol())).description).toBeUndefined();
  });
});
