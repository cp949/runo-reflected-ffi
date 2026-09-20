import { describe, expect, it } from "vitest";
import local from "../src/local";
import { GET } from "../src/utils/traps";
import { DIRECT, REMOTE_OBJECT } from "../src/types";

describe("local() 반환 API 표면", () => {
  it("assign/gather/query/direct/evaluate/reflect/terminate를 모두 노출한다", () => {
    const here = local();
    expect(here.assign).toBe(Object.assign);
    expect(typeof here.gather).toBe("function");
    expect(typeof here.query).toBe("function");
    expect(typeof here.direct).toBe("function");
    expect(typeof here.evaluate).toBe("function");
    expect(typeof here.reflect).toBe("function");
    expect(typeof here.terminate).toBe("function");
  });

  it("direct(value)는 값을 그대로 돌려준다 (표시만 한다)", () => {
    const here = local();
    const obj = {};
    expect(here.direct(obj)).toBe(obj);
  });

  it("evaluate는 콜백을 즉시 로컬에서 호출한다", () => {
    const here = local();
    expect(here.evaluate((a: number, b: number) => a + b, 1, 2)).toBe(3);
  });

  it("terminate는 예외 없이 완료된다", () => {
    const here = local();
    expect(() => here.terminate()).not.toThrow();
  });

  it('reflect(GET, null, [DIRECT, "Math"])는 globalThis.Math를 REMOTE_OBJECT wire pair로 감싸 돌려준다', () => {
    const here = local();
    // memoize(timeout 기본값 -1)가 꺼져 있으므로 결과가 [cache, value] 쌍이 아니라 값(wire pair) 자체다.
    const result = here.reflect(GET, null, [DIRECT, "Math"]);
    expect(Array.isArray(result)).toBe(true);
    const [type, id] = result as [number, number];
    expect(type).toBe(REMOTE_OBJECT);
    expect(typeof id).toBe("number");
  });
});
