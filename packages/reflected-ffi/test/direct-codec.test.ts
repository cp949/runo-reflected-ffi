import { describe, expect, it } from "vitest";
import { decode, decoder } from "../src/direct/decoder";
import { encode, encoder } from "../src/direct/encoder";
import {
  Array as GrowableArrayBuffer,
  Buffer as StackBuffer,
} from "../src/direct/buffer";
import { ERROR, VIEW } from "../src/direct/types";

const roundtrip = (value: unknown): unknown =>
  decode(new Uint8Array(encode(value)));

class Unknown extends Error {
  override get name() {
    return "Unknown";
  }
}

describe("direct 코덱: 원시값/컬렉션 왕복", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["0", 0],
    ["-0", -0],
    ["1.23", 1.23],
    ["-1.23", -1.23],
    ["123", 123],
    ["-123", -123],
    ["null", null],
    ["undefined", undefined],
    ["1n", 1n],
    ["-1n", -1n],
    ["string", "test"],
    ["long string", "a".repeat(200)],
    ["emoji", "🥳"],
    ["array with dup", ["a", "b", "a"]],
    ["well-known symbol", Symbol.iterator],
    ["registered symbol", Symbol.for("iterator")],
    ["9223372036854775807n", 9223372036854775807n],
    ["9223372036854775808n", 9223372036854775808n],
  ] as [string, unknown][])("%s", (_label, value) => {
    const result = roundtrip(value);
    expect(
      Object.is(result, value) ||
        JSON.stringify(result) === JSON.stringify(value),
    ).toBe(true);
  });

  it("같은 참조로 등장하는 Date는 디코딩 후에도 같은 참조를 공유한다 (RECURSION)", () => {
    const date = new Date();
    const [a, b] = roundtrip([date, date]) as [Date, Date];
    expect(a).toBe(b);
    expect(a.getTime()).toBe(date.getTime());
  });

  it("Map/Set/Error/알 수 없는 Error 서브클래스를 왕복시킨다", () => {
    expect([
      ...(roundtrip(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      ) as Map<string, number>),
    ]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect([...(roundtrip(new Set([1, 2, 3])) as Set<number>)]).toEqual([
      1, 2, 3,
    ]);
    expect(roundtrip(new Error("test"))).toBeInstanceOf(Error);
    expect(roundtrip(new Unknown("test"))).toBeInstanceOf(Error);
  });

  it("일반 객체와 RegExp를 왕복시킨다", () => {
    expect(roundtrip({ a: 123 })).toEqual({ a: 123 });
    const re = roundtrip(/test/gi) as RegExp;
    expect(re.source).toBe("test");
    expect(re.flags).toBe("gi");
  });

  it("2^16 길이 문자열을 왕복시킨다 (멀티 청크 push 검증)", () => {
    expect(roundtrip("string".repeat(2 ** 16))).toBe("string".repeat(2 ** 16));
  });

  it("TypedArray는 클래스와 내용을 보존한다", () => {
    const result = roundtrip(new Int32Array([1, 2, 3])) as Int32Array;
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.join(",")).toBe("1,2,3");
  });

  it("DataView는 클래스와 내용을 보존한다", () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const result = roundtrip(new DataView(buffer)) as DataView;
    expect(result).toBeInstanceOf(DataView);
    expect(result.getUint8(0)).toBe(1);
    expect(result.byteLength).toBe(4);
  });

  it("toJSON이 있는 객체는 toJSON() 결과로 직렬화되고, this를 반환하면 null이 된다", () => {
    expect(roundtrip({ toJSON: () => 123 })).toBe(123);
    expect(
      roundtrip({
        toJSON() {
          return this;
        },
      }),
    ).toBe(null);
  });

  it("toJSON이 getter인 객체는 getter를 한 번만 호출한다 (원본은 `in` 체크, `typeof` 프로브 아님)", () => {
    let calls = 0;
    const obj = {
      get toJSON() {
        calls++;
        return () => 42;
      },
    };
    expect(roundtrip(obj)).toBe(42);
    expect(calls).toBe(1);
  });
});

describe("direct 코덱: encoder/decoder 팩토리(byteOffset)", () => {
  it("SharedArrayBuffer에 문자열을 인코딩/디코딩한다", () => {
    const sab = new SharedArrayBuffer(4, { maxByteLength: 1024 });
    const enc = encoder({ byteOffset: 0 });
    const dec = decoder({ byteOffset: 0 });

    const written = enc("hello encoder", sab) as number;
    expect(written).toBe(5 + "hello encoder".length);
    expect(dec(written, sab)).toBe("hello encoder");
  });

  it("여러 번 재사용해도 각 인코딩이 독립적으로 동작한다", () => {
    const sab = new SharedArrayBuffer(4, { maxByteLength: 1024 });
    const enc = encoder({ byteOffset: 0 });
    const dec = decoder({ byteOffset: 0 });

    expect(enc("a".repeat(256), sab)).toBe(261);
    expect(dec(261, sab)).toBe("a".repeat(256));
    expect(enc("a".repeat(10), sab)).toBe(15);
    expect(dec(15, sab)).toBe("a".repeat(10));
  });

  it("버퍼 배열을 인코딩/디코딩하면 서로 다른 인스턴스가 된다", () => {
    const sab = new SharedArrayBuffer(4, { maxByteLength: 1024 });
    const enc = encoder({ byteOffset: 0 });
    const dec = decoder({ byteOffset: 0 });

    const ab = new ArrayBuffer(4, { maxByteLength: 8 });
    const written = enc(
      [new Uint8Array(ab), new Uint8Array(ab)],
      sab,
    ) as number;
    const result = dec(written, sab) as Uint8Array[];
    expect(result.length).toBe(2);
    expect(result[0]!.length).toBe(4);
    expect(result[1]!.length).toBe(4);
    expect(result[0]).not.toBe(result[1]);
    expect(result[0]).toBeInstanceOf(Uint8Array);
  });
});

describe("direct 코덱: SharedArrayBuffer 백엔드 (test/array.js 이식)", () => {
  it("중첩 배열과 ArrayBuffer를 함께 인코딩/디코딩한다", () => {
    const encode2 = encoder();
    const buffer = new SharedArrayBuffer(1024);
    const source = [
      1,
      [2, 3],
      new TextEncoder().encode("456").buffer,
      [7, 8, 9],
    ];
    const result = encode2(source, buffer) as number;
    const revived = decode(new Uint8Array(buffer, 0, result)) as [
      number,
      number[],
      ArrayBuffer,
      number[],
    ];

    expect(result).toBe(35);
    expect(revived[0]).toBe(source[0]);
    expect(JSON.stringify(revived[1])).toBe(JSON.stringify(source[1]));
    expect(new TextDecoder().decode(new Uint8Array(revived[2]))).toBe(
      new TextDecoder().decode(new Uint8Array(source[2] as ArrayBuffer)),
    );
    expect(JSON.stringify(revived[3])).toBe(JSON.stringify(source[3]));
    expect(revived.length).toBe(source.length);
  });
});

describe("direct 코덱: growable Array 파사드 백엔드 (test/array-buffer.js 이식)", () => {
  it("Buffer/Array 조합으로 인코딩하면 결과 버퍼 크기가 정확히 맞아떨어진다", () => {
    const encode2 = encoder({ Array: StackBuffer });
    // 원본은 `new Array` (인자 없이) 호출 — TS ArrayBufferConstructor는 byteLength가
    // 필수라 0을 명시한다. 런타임 동작(0바이트로 시작)은 원본과 동일하다.
    const buffer = new GrowableArrayBuffer(0);
    const source = [
      1,
      [2, 3],
      new TextEncoder().encode("456").buffer,
      [7, 8, 9],
    ];
    const result = encode2(source, buffer) as number;
    const revived = decode(new Uint8Array(buffer.value!)) as [
      number,
      number[],
      ArrayBuffer,
      number[],
    ];

    expect(result).toBe(35);
    expect(result).toBe(buffer.value!.byteLength);
    expect(revived[0]).toBe(source[0]);
    expect(JSON.stringify(revived[1])).toBe(JSON.stringify(source[1]));
    expect(new TextDecoder().decode(new Uint8Array(revived[2]))).toBe(
      new TextDecoder().decode(new Uint8Array(source[2] as ArrayBuffer)),
    );
    expect(JSON.stringify(revived[3])).toBe(JSON.stringify(source[3]));
    expect(revived.length).toBe(source.length);
  });
});

describe("direct 코덱: Blob/File (test/blob.js 이식)", () => {
  it("Blob을 왕복시킨다", async () => {
    const enc = encoder();
    const dec = decoder();
    const blob = new Blob(["hello", "world"], { type: "application/json" });
    const sab = new SharedArrayBuffer(8, { maxByteLength: 8048 });

    const length = await enc(["a", blob, "c"], sab);
    const decoded = dec(length as number, sab) as [string, Blob, string];

    expect(decoded[1].type).toBe(blob.type);
    expect(decoded[1].size).toBe(blob.size);
    expect(await decoded[1].text()).toBe(await blob.text());
    expect(decoded[0]).toBe("a");
    expect(decoded[2]).toBe("c");
  });

  it("File을 왕복시킨다 (Blob 필드 + name/lastModified)", async () => {
    const enc = encoder();
    const dec = decoder();
    const blob = new Blob(["hello", "world"], { type: "application/json" });
    const file = new File([blob], "test.txt", { type: blob.type });
    const sab = new SharedArrayBuffer(8, { maxByteLength: 8048 });

    const length = await enc(["a", file, "c"], sab);
    const decoded = dec(length as number, sab) as [string, File, string];

    expect(decoded[1].type).toBe(blob.type);
    expect(decoded[1].size).toBe(blob.size);
    expect(await decoded[1].text()).toBe(await file.text());
    expect(decoded[0]).toBe("a");
    expect(decoded[2]).toBe("c");
  });

  it("encode()에 Blob을 넘기면 throw한다 — Blob/File은 encoder()만 지원한다", () => {
    const blob = new Blob(["leak"], { type: "text/plain" });
    expect(() => encode(["before", blob, "after"])).toThrow();
  });

  it("Blob이 섞인 encode() 시도 직후의 무관한 encoder() 호출이 오염되지 않는다 (회귀 — card 2)", async () => {
    const blob = new Blob(["leak"], { type: "text/plain" });

    // call A — Blob이 섞인 값을 encode()에 넘긴다. 실패하더라도 이후 호출에
    // 아무 흔적도 남기지 않아야 한다.
    try {
      encode(["before", blob, "after"]);
    } catch {
      /* 기대된 실패 — 위 테스트에서 별도로 검증한다 */
    }

    // call B — call A와 무관한 값을 encoder()로 인코딩한다. call A가 모듈
    // 상태에 미해결 Promise를 남겼다면 call B가 그 바이트를 엉뚱한
    // offset으로 가로채 자신의 버퍼를 오염시킨다.
    const encB = encoder();
    const decB = decoder();
    const bufB = new SharedArrayBuffer(8, { maxByteLength: 64 });
    const lengthB = await encB(["unrelated", "value"], bufB);

    expect(decB(lengthB as number, bufB)).toEqual(["unrelated", "value"]);
  });
});

describe("direct 코덱: 신뢰할 수 없는 바이트에 대한 클래스 이름 allowlist", () => {
  it("VIEW 태그의 클래스 이름이 allowlist 밖이면 decode()가 throw한다 (임의 전역 생성자 실행 차단)", () => {
    const nameBytes = encode("Function");
    const argBytes = encode("return 1");
    const malicious = new Uint8Array([VIEW, ...nameBytes, ...argBytes]);
    expect(() => decode(malicious)).toThrow();
  });

  it("VIEW 태그의 클래스 이름이 allowlist 안이면 정상 디코딩된다", () => {
    const nameBytes = encode("Uint8Array");
    const argBytes = encode([1, 2, 3]);
    const wellFormed = new Uint8Array([VIEW, ...nameBytes, ...argBytes]);
    expect(decode(wellFormed)).toBeInstanceOf(Uint8Array);
  });

  it("ERROR 태그의 클래스 이름이 allowlist 밖이면 Function 등을 실행하지 않고 base Error로 폴백한다", () => {
    const nameBytes = encode("Function");
    const messageBytes = encode("pwned");
    const stackBytes = encode("");
    const malicious = new Uint8Array([
      ERROR,
      ...nameBytes,
      ...messageBytes,
      ...stackBytes,
    ]);
    const result = decode(malicious);
    expect(result).toBeInstanceOf(Error);
    expect(typeof result).toBe("object");
  });
});

describe("direct 코덱: 캐시/RECURSION (test/cached.js 이식)", () => {
  it("같은 Error/RegExp 참조가 반복되면 디코딩 후에도 참조가 유지된다", () => {
    const error = new Error("test");
    const regexp = new RegExp("test");
    const input = [1, error, regexp, error, regexp, 2];
    const result = roundtrip(input) as unknown[];

    expect(result[0]).toBe(input[0]);
    expect(result.at(-1)).toBe(input.at(-1));
    expect(result[1]).toBe(result[3]);
    expect(result[1]).toBeInstanceOf(Error);
    expect(result[2]).toBe(result[4]);
    expect(result[2]).toBeInstanceOf(RegExp);
    expect(result.length).toBe(input.length);
  });
});
