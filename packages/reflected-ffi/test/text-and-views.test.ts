import { describe, expect, it } from "vitest";
import { decoder, encoder } from "../src/utils/text";
import { dv, u8a8 } from "../src/direct/views";

describe("utils/text", () => {
  it("encoder/decoder는 TextEncoder/TextDecoder 싱글턴이다", () => {
    expect(encoder).toBeInstanceOf(TextEncoder);
    expect(decoder).toBeInstanceOf(TextDecoder);
    expect(decoder.decode(encoder.encode("hello"))).toBe("hello");
  });
});

describe("direct/views", () => {
  it("dv와 u8a8은 같은 8바이트 버퍼를 공유한다", () => {
    expect(u8a8.length).toBe(8);
    expect(dv.byteLength).toBe(8);
    u8a8[0] = 0xff;
    expect(dv.getUint8(0)).toBe(0xff);
    dv.setUint32(4, 12345, true);
    expect(u8a8[4]).not.toBe(0);
  });
});
