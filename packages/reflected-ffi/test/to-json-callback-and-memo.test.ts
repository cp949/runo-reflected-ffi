import { describe, expect, it } from "vitest";
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

  it("set은 표준 Map과 달리 this가 아니라 저장한 value를 반환한다", () => {
    // remote.ts의 Handler#get/#ownKeys/#getPrototypeOf 트랩이
    // `this.$.set(...)`의 반환값을 그대로 자기 반환값으로 쓰기 때문에
    // 이 반환값이 `this`(Map 인스턴스)로 바뀌면 원격 프록시가 값 대신
    // Memo 인스턴스를 돌려주는 심각한 회귀가 된다.
    const Memo = memo(50);
    const instance = new Memo();
    expect(instance.set("a", 42)).toBe(42);
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
});
