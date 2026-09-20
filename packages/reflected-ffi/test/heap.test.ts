import { describe, expect, it } from "vitest";
import heap from "../src/utils/heap";

describe("utils/heap", () => {
  it("같은 참조에는 같은 id를 재사용한다", () => {
    const { id } = heap();
    const ref = {};
    expect(id(ref)).toBe(id(ref));
  });

  it("서로 다른 참조에는 서로 다른 id를 할당한다", () => {
    const { id } = heap();
    expect(id({})).not.toBe(id({}));
  });

  it("ref(id(x))는 x를 돌려준다", () => {
    const { id, ref } = heap();
    const value = { a: 1 };
    expect(ref(id(value))).toBe(value);
  });

  it("unref는 id를 해제하고 true를 반환하며, 해제된 id는 더 이상 조회되지 않는다", () => {
    const { id, ref, unref } = heap();
    const value = {};
    const uid = id(value);
    expect(unref(uid)).toBe(true);
    expect(ref(uid)).toBeUndefined();
  });

  it("clear는 모든 매핑을 지운다", () => {
    const { id, ref, clear } = heap();
    const uid = id({});
    clear();
    expect(ref(uid)).toBeUndefined();
  });
});
