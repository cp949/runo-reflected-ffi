import { describe, expect, it } from "vitest";
import Stack from "../src/direct/array";
import {
  Array as GrowableArrayBuffer,
  Buffer as StackBuffer,
} from "../src/direct/buffer";

describe("direct/array (Stack)", () => {
  it("growable SharedArrayBuffer에 밀어넣은 바이트를 순서대로 기록한다", () => {
    const sab = new SharedArrayBuffer(4, { maxByteLength: 64 });
    const stack = new Stack(sab, 0);
    stack.push(1, 2, 3);
    expect(stack.length).toBe(3);
    stack.sync(true);
    expect([...new Uint8Array(sab, 0, 3)]).toEqual([1, 2, 3]);
  });

  it("버퍼 용량을 넘으면 자동으로 grow된다", () => {
    const sab = new SharedArrayBuffer(2, { maxByteLength: 64 });
    const stack = new Stack(sab, 0);
    stack.push(1, 2, 3, 4, 5);
    stack.sync(true);
    expect(sab.byteLength).toBeGreaterThanOrEqual(5);
  });

  it("static push는 sync(false) 후 값을 기록한다", () => {
    const sab = new SharedArrayBuffer(8, { maxByteLength: 64 });
    const stack = new Stack(sab, 0);
    Stack.push(stack, new Uint8Array([9, 9]));
    expect(stack.length).toBe(2);
  });

  it("growable이 아닌 버퍼는 용량 초과 시 명확한 RangeError를 던진다 (Chrome 84 등 .grow() 미지원 환경 재현)", () => {
    const buffer = new ArrayBuffer(2);
    const stack = new Stack(buffer, 0);
    stack.push(1, 2, 3);
    expect(() => stack.sync(true)).toThrow(RangeError);
  });
});

describe("direct/buffer (Array 파사드 + Buffer)", () => {
  it("sync(true)에서 transferToFixedLength로 최종 버퍼를 만들고 .value에 채운다", () => {
    // 원본 JS 호출부(test/array-buffer.js)는 `new Array`처럼 인자 없이 호출하지만,
    // TS의 내장 ArrayBufferConstructor 타입은 byteLength를 필수로 요구하므로
    // 여기서는 0을 명시한다 — 런타임 동작(0바이트로 시작)은 원본과 동일하다.
    const holder = new GrowableArrayBuffer(0);
    const buffer = new StackBuffer(holder, 0);
    buffer.push(1, 2, 3);
    buffer.sync(true);
    expect(holder.value).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(holder.value!)]).toEqual([1, 2, 3]);
  });
});
