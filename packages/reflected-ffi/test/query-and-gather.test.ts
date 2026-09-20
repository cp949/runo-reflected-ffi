import { describe, expect, it } from "vitest";
import query from "../src/utils/query";
import gather from "../src/utils/gather";

describe("utils/query", () => {
  it("점(.) 경로를 따라 값을 찾는다", () => {
    expect(query(Array, "isArray.length")).toBe(Array.isArray.length);
  });

  it("대괄호 표기법도 점 표기법과 동일하게 동작한다", () => {
    expect(query(Array, 'isArray["length"]')).toBe(
      query(Array, "isArray.length"),
    );
  });

  it("문자열 인덱싱도 지원한다", () => {
    expect(query(Object, "name[0]")).toBe("O");
  });
});

describe("utils/gather", () => {
  it("문자열 키는 query로, symbol 키는 직접 인덱싱으로 값을 모은다", () => {
    const target = { value: 1, [Symbol.for("gather")]: 2 };
    const result = gather(target, "value", Symbol.for("gather"));
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result.length).toBe(2);
  });
});
