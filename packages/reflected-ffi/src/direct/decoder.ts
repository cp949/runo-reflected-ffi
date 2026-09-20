// encoder.ts가 만든 바이트 태그 스트림을 원래 값으로 복원하는 direct 코덱의
// 디코더.
import {
  FALSE,
  TRUE,
  NULL,
  NUMBER,
  UI8,
  NAN,
  INFINITY,
  N_INFINITY,
  ZERO,
  N_ZERO,
  BIGINT,
  BIGUINT,
  STRING,
  SYMBOL,
  ARRAY,
  BUFFER,
  DATE,
  ERROR,
  MAP,
  OBJECT,
  REGEXP,
  SET,
  VIEW,
  IMAGE_DATA,
  BLOB,
  FILE,
  RECURSION,
} from "./types";
import { ImageData } from "./web";
import { decoder as textDecoder } from "../utils/text";
import { defineProperty } from "../utils/index";
import { fromSymbol } from "../utils/symbol";
import { resolveErrorClass, resolveViewClass } from "../utils/global";
import { dv, u8a8 } from "./views";

type Cache = Map<number, unknown>;
// 명시적 읽기 커서 — number/size/deflate가 현재 바이트 위치에 의존한다는
// 사실을 숨겨진 모듈 전역 변수 대신 함수 시그니처에 드러낸다.
type Cursor = { i: number };

/**
 * 값을 캐시에 등록하면서 그대로 반환한다 — 이후 RECURSION 태그가 같은
 * 인덱스로 이 값을 다시 찾아가 순환 참조를 복원할 수 있게 한다.
 */
const $ = (cache: Cache, index: number, value: unknown): unknown => {
  cache.set(index, value);
  return value;
};

/** 커서 위치의 8바이트를 스크래치 버퍼(u8a8)로 옮긴다 — float64/bigint 등
 * 멀티바이트 값을 읽기 전에 거치는 공용 단계. */
const number = (input: Uint8Array, c: Cursor): void => {
  u8a8[0] = input[c.i++]!;
  u8a8[1] = input[c.i++]!;
  u8a8[2] = input[c.i++]!;
  u8a8[3] = input[c.i++]!;
  u8a8[4] = input[c.i++]!;
  u8a8[5] = input[c.i++]!;
  u8a8[6] = input[c.i++]!;
  u8a8[7] = input[c.i++]!;
};

/** 커서 위치의 4바이트를 uint32 길이 값으로 읽는다(리틀 엔디안). */
const size = (input: Uint8Array, c: Cursor): number => {
  u8a8[0] = input[c.i++]!;
  u8a8[1] = input[c.i++]!;
  u8a8[2] = input[c.i++]!;
  u8a8[3] = input[c.i++]!;
  return dv.getUint32(0, true);
};

/**
 * 태그 하나를 읽고 그에 대응하는 값을 재귀적으로 복원한다 — direct 코덱
 * 디코딩의 본체.
 */
const deflate = (input: Uint8Array, cache: Cache, c: Cursor): unknown => {
  switch (input[c.i++]) {
    case NUMBER: {
      number(input, c);
      return dv.getFloat64(0, true);
    }
    case UI8:
      return input[c.i++];
    case OBJECT: {
      const object = $(cache, c.i - 1, {}) as Record<PropertyKey, unknown>;
      for (let j = 0, length = size(input, c); j < length; j++)
        object[deflate(input, cache, c) as PropertyKey] = deflate(
          input,
          cache,
          c,
        );
      return object;
    }
    case ARRAY: {
      const array = $(cache, c.i - 1, []) as unknown[];
      for (let j = 0, length = size(input, c); j < length; j++)
        array.push(deflate(input, cache, c));
      return array;
    }
    case VIEW: {
      const index = c.i - 1;
      const name = deflate(input, cache, c) as string;
      // resolveViewClass가 이름을 allowlist로 검증한 뒤 생성자를 돌려준다 —
      // 목록 밖 이름이면 여기서 throw한다(CWE-502 방지, ADR-0003).
      const Class = resolveViewClass(name);
      return $(cache, index, new Class(deflate(input, cache, c)));
    }
    case BUFFER: {
      const index = c.i - 1;
      const length = size(input, c);
      return $(cache, index, input.slice(c.i, (c.i += length)).buffer);
    }
    case STRING: {
      const index = c.i - 1;
      const length = size(input, c);
      // subarray로도 만들 수 있지만 Web에서 지원하지 않고, 배열 대신 타입드
      // 배열을 쓰는 경로와도 맞지 않는다.
      return $(
        cache,
        index,
        textDecoder.decode(input.slice(c.i, (c.i += length))),
      );
    }
    case DATE: {
      return $(cache, c.i - 1, new Date(deflate(input, cache, c) as number));
    }
    case MAP: {
      const map = $(cache, c.i - 1, new Map()) as Map<unknown, unknown>;
      for (let j = 0, length = size(input, c); j < length; j++)
        map.set(deflate(input, cache, c), deflate(input, cache, c));
      return map;
    }
    case SET: {
      const set = $(cache, c.i - 1, new Set()) as Set<unknown>;
      for (let j = 0, length = size(input, c); j < length; j++)
        set.add(deflate(input, cache, c));
      return set;
    }
    case ERROR: {
      const index = c.i - 1;
      const name = deflate(input, cache, c) as string;
      const message = deflate(input, cache, c) as string;
      const stack = deflate(input, cache, c) as string;
      // resolveErrorClass는 목록 밖 이름이면 기본 Error로 폴백한다(throw하지
      // 않는다) — 알 수 없는 서브클래스도 왕복은 되도록 하기 위함.
      const Class = resolveErrorClass(name);
      const error = new Class(message);
      return $(cache, index, defineProperty(error, "stack", { value: stack }));
    }
    /* c8 ignore start */
    case IMAGE_DATA: {
      const index = c.i - 1;
      const data = deflate(input, cache, c) as Uint8ClampedArray<ArrayBuffer>;
      const width = deflate(input, cache, c) as number;
      const height = deflate(input, cache, c) as number;
      const colorSpace = deflate(input, cache, c) as PredefinedColorSpace;
      const pixelFormat = deflate(
        input,
        cache,
        c,
      ) as ImageDataSettings["pixelFormat"];
      const settings = { colorSpace, pixelFormat };
      return $(cache, index, new ImageData(data, width, height, settings));
    }
    /* c8 ignore stop */
    case REGEXP: {
      const index = c.i - 1;
      const source = deflate(input, cache, c) as string;
      const flags = deflate(input, cache, c) as string;
      return $(cache, index, new RegExp(source, flags));
    }
    case FALSE:
      return false;
    case TRUE:
      return true;
    case NAN:
      return NaN;
    case INFINITY:
      return Infinity;
    case N_INFINITY:
      return -Infinity;
    case ZERO:
      return 0;
    case N_ZERO:
      return -0;
    case NULL:
      return null;
    case BIGINT:
      return (number(input, c), dv.getBigInt64(0, true));
    case BIGUINT:
      return (number(input, c), dv.getBigUint64(0, true));
    case SYMBOL:
      return fromSymbol(deflate(input, cache, c) as string);
    case RECURSION:
      return cache.get(size(input, c));
    case BLOB: {
      const index = c.i - 1;
      const type = deflate(input, cache, c) as string;
      const blobSize = deflate(input, cache, c) as number;
      return $(
        cache,
        index,
        new Blob([input.slice(c.i, (c.i += blobSize))], { type }),
      );
    }
    case FILE: {
      const index = c.i - 1;
      const name = deflate(input, cache, c) as string;
      const lastModified = deflate(input, cache, c) as number;
      const blob = deflate(input, cache, c) as Blob;
      return $(
        cache,
        index,
        new File([blob], name, { type: blob.type, lastModified }),
      );
    }
    // 알 수 없는 태그(원래 undefined였거나 함수였던 값 포함)는 undefined로
    // 취급한다.
    default:
      return undefined;
  }
};

/** 인코딩된 바이트 배열 전체를 값으로 복원한다. */
export const decode = (value: Uint8Array): unknown =>
  deflate(value, new Map(), { i: 0 });

/** 버퍼의 일부 구간(byteOffset부터 length바이트)을 decode()로 복원하는
 * 디코더 함수를 만든다. */
export const decoder =
  ({ byteOffset = 0 }: { byteOffset?: number } = {}) =>
  (length: number, buffer: ArrayBufferLike): unknown =>
    decode(new Uint8Array(buffer, byteOffset, length));
