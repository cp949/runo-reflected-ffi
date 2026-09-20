import { describe, expect, it } from "vitest";
import remote from "../src/remote";

describe("remote() 반환 API 표면", () => {
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
