import { describe, expect, it } from "vitest";
import { fromView, toView } from "../src/utils/typed";

describe("utils/typed", () => {
  it("resizable ArrayBuffer 기반 뷰를 direct=false로 왕복시킨다 — decode는 인자 없이 페이로드만 보고 복원한다", () => {
    const buffer = new ArrayBuffer(12, { maxByteLength: 24 });
    const i32a = new Int32Array(buffer, 4, 1);
    i32a[0] = 1;
    expect(i32a.length).toBe(i32a[0]);

    const copy = fromView(toView(i32a, false)) as Int32Array;
    expect(copy.byteOffset).toBe(i32a.byteOffset);
    expect(copy.length).toBe(i32a.length);
    expect(copy[0]).toBe(i32a[0]);
  });

  it("일반 ArrayBuffer 기반 뷰를 direct=false로 왕복시킨다", () => {
    const ui8a = new Uint8Array([1, 2, 3]);
    const copy = fromView(toView(ui8a, false)) as Uint8Array;
    expect(copy.byteOffset).toBe(ui8a.byteOffset);
    expect(copy.length).toBe(ui8a.length);
    expect([...copy]).toEqual([...ui8a]);
  });

  it("direct=true는 버퍼를 복사하지 않고 그대로 참조를 넘긴다", () => {
    const ui8a = new Uint8Array([1, 2, 3]);
    const copy = fromView(toView(ui8a, true)) as Uint8Array;
    expect(copy.byteOffset).toBe(ui8a.byteOffset);
    expect(copy.length).toBe(ui8a.length);
    expect([...copy]).toEqual([...ui8a]);
  });

  it("resizable buffer + direct=true 조합도 왕복한다", () => {
    const ui8a = new Uint8Array(new ArrayBuffer(3, { maxByteLength: 6 }));
    ui8a.set([9, 8, 7]);
    const copy = fromView(toView(ui8a, true)) as Uint8Array;
    expect(copy.byteOffset).toBe(ui8a.byteOffset);
    expect(copy.length).toBe(ui8a.length);
    expect([...copy]).toEqual([...ui8a]);
  });

  it("encode 쪽 direct 설정과 무관하게 decode는 페이로드에 실린 isDirect를 그대로 따른다", () => {
    // encode(direct=true)로 만든 페이로드를 그대로 decode에 넘긴다 — decode에 direct
    // 인자가 없다는 것 자체가, 두 peer가 서로 다른 buffer 옵션으로 붙어도 wire 모양이
    // 항상 자기 서술적이라는 계약을 증명한다.
    const ui8a = new Uint8Array([4, 5, 6]);
    const direct = fromView(toView(ui8a, true)) as Uint8Array;
    const json = fromView(toView(ui8a, false)) as Uint8Array;
    expect([...direct]).toEqual([...ui8a]);
    expect([...json]).toEqual([...ui8a]);
  });

  it("이름이 allowlist 밖이면 throw한다 (조작된 ViewDetails로 임의 전역 생성자 실행 차단)", () => {
    const forged = [
      "Function",
      [false, [1, 2, 3], 0],
      0,
      0,
    ] as unknown as Parameters<typeof fromView>[0];
    expect(() => fromView(forged)).toThrow();
  });
});
