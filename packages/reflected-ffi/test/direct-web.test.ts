import { describe, expect, it } from "vitest";
import { ImageData } from "../src/direct/web";

describe("direct/web", () => {
  it("ImageData는 항상 생성자 함수/클래스다 (Node에는 네이티브 ImageData가 없으므로 폴백)", () => {
    expect(typeof ImageData).toBe("function");
    expect(
      () => new (ImageData as unknown as new () => unknown)(),
    ).not.toThrow();
  });
});
