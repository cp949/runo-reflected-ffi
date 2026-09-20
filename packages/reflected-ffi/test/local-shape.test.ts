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

  it('reflect(GET, null, [DIRECT, "Math"])는 항상 [shouldCache, [type, id]] 2-tuple을 돌려준다', () => {
    // GET 응답 모양은 local 쪽 설정에 좌우되지 않는다 — local()은 remote가
    // 무엇으로 붙을지 알 수 없으므로, peer 간 설정이 어긋나도 wire가 깨지지
    // 않도록 항상 같은 모양으로 응답한다(ADR-0007).
    const here = local();
    const result = here.reflect(GET, null, [DIRECT, "Math"]);
    expect(Array.isArray(result)).toBe(true);
    const [shouldCache, wirePair] = result as [boolean, [number, number]];
    expect(typeof shouldCache).toBe("boolean");
    const [type, id] = wirePair;
    expect(type).toBe(REMOTE_OBJECT);
    expect(typeof id).toBe("number");
  });
});
