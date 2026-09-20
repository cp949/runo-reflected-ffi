import { describe, expect, it } from "vitest";
import {
  resolveErrorClass,
  resolveViewClass,
  toName,
  toTag,
} from "../src/utils/global";

class Extend extends Uint8Array {
  // @ts-expect-error — Uint8Array의 Symbol.toStringTag는 리터럴 "Uint8Array"로 고정되어 있지만, 테스트 목적의 오버라이드일 뿐 런타임 동작에는 영향 없음.
  get [Symbol.toStringTag]() {
    return "Extend";
  }
}

describe("utils/global", () => {
  it("toName은 globalThis에 존재하는 가장 가까운 생성자 이름을 찾는다", () => {
    expect(toName(Symbol.iterator)).toBe("Symbol");
    expect(toName(Object.create(null))).toBe("Object");
    expect(toName(new Extend([]))).toBe("Object");
    expect(toName({})).toBe("Object");
  });

  it("toName은 가짜 Symbol.toStringTag를 무시하고 prototype 체인을 타고 올라간다", () => {
    expect(
      toName(Object.create(null, { [Symbol.toStringTag]: { value: "Fake" } })),
    ).toBe("Object");
  });

  it("toTag는 Symbol.toStringTag 기반으로 globalThis에 존재하는 이름을 찾는다", () => {
    expect(toTag(new Extend([]))).toBe("Uint8Array");
  });

  it("resolveViewClass는 허용된 TypedArray/DataView 이름만 생성자로 돌려준다", () => {
    expect(resolveViewClass("Uint8Array")).toBe(Uint8Array);
    expect(resolveViewClass("Int32Array")).toBe(Int32Array);
    expect(resolveViewClass("DataView")).toBe(DataView);
  });

  it("resolveViewClass는 allowlist 밖 이름에 대해 throw한다 (임의 전역 생성자 실행 차단)", () => {
    expect(() => resolveViewClass("Function")).toThrow();
    expect(() => resolveViewClass("Worker")).toThrow();
    expect(() => resolveViewClass("XMLHttpRequest")).toThrow();
  });

  it("resolveErrorClass는 허용된 내장 Error 서브클래스만 생성자로 돌려준다", () => {
    expect(resolveErrorClass("TypeError")).toBe(TypeError);
    expect(resolveErrorClass("RangeError")).toBe(RangeError);
  });

  it("resolveErrorClass는 allowlist 밖 이름에 대해 base Error로 폴백한다 (throw하지 않음)", () => {
    expect(resolveErrorClass("Unknown")).toBe(Error);
    expect(resolveErrorClass("Function")).toBe(Error);
  });
});
