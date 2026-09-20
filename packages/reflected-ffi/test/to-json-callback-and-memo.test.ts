import { describe, expect, it, vi } from "vitest";
import toJSONCallback from "../src/utils/to-json-callback";
import memo from "../src/utils/memo";

describe("utils/to-json-callback", () => {
  it("메서드 축약형 함수에 이름을 붙인다", () => {
    const fn = {
      test(a: number, b: number) {
        return a + b;
      },
    }.test;
    expect(toJSONCallback(fn)).toMatch(/^function\s+\w+\(/);
  });

  it("이미 이름이 있는 함수는 그대로 둔다", () => {
    function named(a: number) {
      return a;
    }
    expect(toJSONCallback(named)).toBe(String(named));
  });

  it("화살표 함수는 건드리지 않는다", () => {
    const arrow = (a: number, b: number) => a + b;
    expect(toJSONCallback(arrow)).toBe(String(arrow));
  });
});

describe("utils/memo", () => {
  it("Map을 상속하고 set한 값을 get으로 읽을 수 있다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    instance.set("a", 1);
    expect(instance.get("a")).toBe(1);
    expect(instance.has("a")).toBe(true);
  });

  it("set()은 표준 Map처럼 this를 반환해 체이닝할 수 있다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    expect(instance.set("a", 1)).toBe(instance);
    expect(instance.set("a", 1).set("b", 2).get("b")).toBe(2);
  });

  it("drop은 값을 그대로 반환하면서 key(및 proto가 아니면 keys 캐시)를 지운다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    instance.set(Memo.keys, ["a"]);
    instance.set("a", 1);
    const result = instance.drop("a", 42);
    expect(result).toBe(42);
    expect(instance.has("a")).toBe(false);
    expect(instance.has(Memo.keys)).toBe(false);
  });

  it("readOr는 캐시 miss일 때 compute로 값을 얻어 저장하고 그 값을 반환한다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    const value = instance.readOr("a", () => [true, 1]);
    expect(value).toBe(1);
    expect(instance.get("a")).toBe(1);
  });

  it("readOr는 캐시 hit일 때 compute를 다시 호출하지 않고 캐시된 값을 반환한다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    instance.readOr("a", () => [true, 1]);
    const compute = vi.fn((): [boolean, number] => [true, 2]);
    const value = instance.readOr("a", compute);
    expect(value).toBe(1);
    expect(compute).not.toHaveBeenCalled();
  });

  it("readOr는 compute가 캐싱 불가를 알리면 값은 반환하되 저장하지 않는다", () => {
    const Memo = memo(50);
    const instance = new Memo();
    const value = instance.readOr("a", () => [false, 1]);
    expect(value).toBe(1);
    expect(instance.has("a")).toBe(false);
  });

  // set() 오버라이드가 반환값만 표준(this)으로 바뀌었을 뿐, readOr()를
  // 거치지 않고 직접 호출해도 여전히 만료 큐에 등록돼야 한다 — "timeout 뒤
  // 자동으로 비워지는 캐시"라는 Memo의 핵심 불변식.
  it("set()을 직접 호출해도 timeout 뒤 자동으로 비워진다", async () => {
    const Memo = memo(10);
    const instance = new Memo();
    instance.set("a", 1);
    expect(instance.has("a")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(instance.has("a")).toBe(false);
  });
});
