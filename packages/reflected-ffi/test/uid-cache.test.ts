import { describe, expect, it, vi } from "vitest";
import getOrBuild from "../src/utils/uid-cache";

describe("utils/uid-cache", () => {
  it("같은 uid로 두 번 호출하면 build를 한 번만 실행하고 같은 값을 재사용한다", () => {
    const weakRefs = new Map<unknown, WeakRef<object>>();
    const fr = new FinalizationRegistry<unknown>(() => {});
    const build = vi.fn(() => ({}));

    const a = getOrBuild(weakRefs, fr, 1, build);
    const b = getOrBuild(weakRefs, fr, 1, build);

    expect(a).toBe(b);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("서로 다른 uid는 각각 build를 실행해 서로 다른 값을 만든다", () => {
    const weakRefs = new Map<unknown, WeakRef<object>>();
    const fr = new FinalizationRegistry<unknown>(() => {});

    const a = getOrBuild(weakRefs, fr, 1, () => ({ tag: "a" }));
    const b = getOrBuild(weakRefs, fr, 2, () => ({ tag: "b" }));

    expect(a).not.toBe(b);
  });

  it("weakRefs에서 항목이 사라지면 다음 호출에서 다시 build한다(gc() 없이 재현)", () => {
    const weakRefs = new Map<unknown, WeakRef<object>>();
    const fr = new FinalizationRegistry<unknown>(() => {});
    const build = vi.fn(() => ({}));

    const first = getOrBuild(weakRefs, fr, 1, build);
    weakRefs.delete(1);
    const second = getOrBuild(weakRefs, fr, 1, build);

    expect(second).not.toBe(first);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("새로 만든 값을 uid로 weakRefs에 넣고 FinalizationRegistry에도 등록한다", () => {
    const weakRefs = new Map<unknown, WeakRef<object>>();
    const fr = new FinalizationRegistry<unknown>(() => {});
    const registerSpy = vi.spyOn(fr, "register");

    const value = getOrBuild(weakRefs, fr, "uid-1", () => ({}));

    expect(weakRefs.get("uid-1")?.deref()).toBe(value);
    expect(registerSpy).toHaveBeenCalledWith(
      value,
      "uid-1",
      expect.any(WeakRef),
    );
  });
});
