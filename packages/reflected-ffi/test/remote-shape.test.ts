import { describe, expect, it } from "vitest";
import remote from "../src/remote";
import { DIRECT } from "../src/types";

describe("remote() 반환 API 표면", () => {
  it("get 트랩은 GET 응답을 memoize 없이도(timeout=-1) 항상 [cache, value] 2-tuple로 destructure한다", () => {
    // local의 GET은 이제 자신의 timeout과 무관하게 항상 [shouldCache, wireValue]를
    // 돌려준다(ADR-0007) — remote도 자기 timeout과 무관하게 항상 그 모양을
    // destructure해야 한다. memoize를 꺼도(timeout=-1) 예외는 아니다.
    const there = remote({
      timeout: -1,
      reflect: () => [true, [DIRECT, 123]],
    });
    expect((there.global as Record<string, unknown>).answer).toBe(123);
  });

  it("get 트랩은 memoize가 켜져 있으면(timeout>=0) 캐시 hit일 때 reflect를 다시 부르지 않는다", () => {
    let calls = 0;
    const there = remote({
      timeout: 50,
      reflect: () => {
        calls++;
        return [true, [DIRECT, 123]];
      },
    });
    const g = there.global as Record<string, unknown>;
    expect(g.answer).toBe(123);
    expect(g.answer).toBe(123);
    expect(calls).toBe(1);
  });

  it("global/isProxy/assign/direct/evaluate/gather/query/reflect를 모두 노출한다", () => {
    const there = remote({ reflect: () => undefined });
    expect(there.global).toBeDefined();
    expect(typeof there.isProxy).toBe("function");
    expect(typeof there.assign).toBe("function");
    expect(typeof there.direct).toBe("function");
    expect(typeof there.evaluate).toBe("function");
    expect(typeof there.gather).toBe("function");
    expect(typeof there.query).toBe("function");
    expect(typeof there.reflect).toBe("function");
  });

  it("global은 isProxy를 만족하는 Proxy다", () => {
    const there = remote({ reflect: () => undefined });
    expect(there.isProxy(there.global)).toBe(true);
    expect(there.isProxy({})).toBe(false);
    expect(there.isProxy(null)).toBe(false);
    expect(there.isProxy(false)).toBe(false);
  });

  it("direct(value)는 값을 그대로 돌려준다", () => {
    const there = remote({ reflect: () => undefined });
    const obj = {};
    expect(there.direct(obj)).toBe(obj);
  });

  it("query(비-Proxy 대상, path)는 utils/query를 직접 위임한다", () => {
    const there = remote({ reflect: () => undefined });
    expect(there.query(Array, "isArray.length")).toBe(Array.isArray.length);
  });
});
