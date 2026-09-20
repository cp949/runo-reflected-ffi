// 값을 direct 코덱의 바이트 태그 스트림으로 직렬화하는 인코더.
import {
  FALSE,
  TRUE,
  UNDEFINED,
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
import Stack from "./array";
import { isArray, isView, push } from "../utils/index";
import { encoder as textEncoder } from "../utils/text";
import { toSymbol } from "../utils/symbol";
import { dv, u8a8 } from "./views";
import { toTag } from "../utils/global";

type Cache = Map<unknown, number[]>;
type Output = { push(...values: number[]): number; length: number };
type PushView = (output: Stack, value: Uint8Array) => void;
/**
 * Blob/File 바이트는 비동기로 읽어야 해서 encode() 호출이 끝난 뒤에 채워
 * 넣는다. 이 상태가 모듈 전역이면 겹치는 두 호출이 서로의 큐를 훔쳐 쓴다
 * (call B가 call A의 미해결 Promise를 자신의 버퍼에 잘못된 offset으로
 * 써버림) — 그래서 호출마다 새로 만들어 inflate()에 실어 나른다.
 */
type Ctx = { blobs: Promise<[number, ArrayBuffer]>[]; pushView: PushView };

const { isNaN, isFinite, isInteger } = Number;
const { ownKeys } = Reflect;
const { is } = Object;

/**
 * 이미 인코딩한 참조인지 확인해 순환 참조를 백레퍼런스로 대체한다. 처음
 * 보는 참조면 현재 출력 위치를 캐시에 등록하고 true를 반환한다.
 */
const process = (input: unknown, output: Output, cache: Cache): boolean => {
  const value = cache.get(input);
  const unknown = !value;
  if (unknown) {
    // 이 참조를 나중에 RECURSION으로 되찾을 수 있도록 현재 출력 위치를
    // 4바이트로 쪼개 캐시에 저장한다.
    dv.setUint32(0, output.length, true);
    cache.set(input, [u8a8[0]!, u8a8[1]!, u8a8[2]!, u8a8[3]!]);
  } else output.push(RECURSION, value[0]!, value[1]!, value[2]!, value[3]!);
  return unknown;
};

/** 타입 태그와 길이(4바이트)를 함께 출력한다 — 컨테이너 타입의 공통 헤더. */
const set = (output: Output, type: number, length: number): void => {
  dv.setUint32(0, length, true);
  output.push(type, u8a8[0]!, u8a8[1]!, u8a8[2]!, u8a8[3]!);
};

/**
 * 값 하나를 태그 + 데이터 형태로 출력에 기록한다 — direct 코덱 인코딩의
 * 본체. 객체/배열 등 컨테이너는 재귀 호출로 내부 값을 이어서 기록한다.
 */
const inflate = (
  input: unknown,
  output: Output,
  cache: Cache,
  ctx: Ctx,
): void => {
  switch (typeof input) {
    case "number": {
      // 유한하고 0~255 범위인 정수는 UI8 한 바이트로, 그 외 유한수는
      // float64(8바이트)로 인코딩해 흔한 값의 크기를 줄인다.
      if (input && isFinite(input)) {
        if (isInteger(input) && input < 256 && -1 < input)
          output.push(UI8, input);
        else {
          dv.setFloat64(0, input, true);
          output.push(
            NUMBER,
            u8a8[0]!,
            u8a8[1]!,
            u8a8[2]!,
            u8a8[3]!,
            u8a8[4]!,
            u8a8[5]!,
            u8a8[6]!,
            u8a8[7]!,
          );
        }
      } else if (isNaN(input)) output.push(NAN);
      else if (!input) output.push(is(input, 0) ? ZERO : N_ZERO);
      else output.push(input < 0 ? N_INFINITY : INFINITY);
      break;
    }
    case "object": {
      switch (true) {
        case input === null:
          output.push(NULL);
          break;
        // 이미 인코딩한 참조면 process()가 RECURSION 백레퍼런스를 쓰고
        // 여기서 끝난다 — 아래 case들로 내려가지 않는다.
        case !process(input, output, cache):
          break;
        case isArray(input): {
          const arr = input as unknown[];
          const length = arr.length;
          set(output, ARRAY, length);
          for (let i = 0; i < length; i++)
            inflate(arr[i], output, cache, ctx);
          break;
        }
        case isView(input): {
          output.push(VIEW);
          inflate(toTag(input), output, cache, ctx);
          input = (input as ArrayBufferView).buffer;
          if (!process(input, output, cache)) break;
          // 폴스루 — 뷰의 내부 버퍼가 새 참조면 아래 ArrayBuffer 분기로
          // 이어서 실제 바이트를 기록한다.
        }
        case input instanceof ArrayBuffer: {
          const ui8a = new Uint8Array(input as ArrayBufferLike);
          set(output, BUFFER, ui8a.length);
          ctx.pushView(output as Stack, ui8a);
          break;
        }
        case input instanceof Date:
          output.push(DATE);
          inflate((input as Date).getTime(), output, cache, ctx);
          break;
        case input instanceof Map: {
          const m = input as Map<unknown, unknown>;
          set(output, MAP, m.size);
          for (const [key, value] of m) {
            inflate(key, output, cache, ctx);
            inflate(value, output, cache, ctx);
          }
          break;
        }
        case input instanceof Set: {
          const s = input as Set<unknown>;
          set(output, SET, s.size);
          for (const value of s) inflate(value, output, cache, ctx);
          break;
        }
        case input instanceof Error: {
          const err = input as Error;
          output.push(ERROR);
          inflate(err.name, output, cache, ctx);
          inflate(err.message, output, cache, ctx);
          inflate(err.stack, output, cache, ctx);
          break;
        }
        /* c8 ignore start */
        case input instanceof ImageData: {
          const img = input as ImageData;
          output.push(IMAGE_DATA);
          inflate(img.data, output, cache, ctx);
          inflate(img.width, output, cache, ctx);
          inflate(img.height, output, cache, ctx);
          inflate(img.colorSpace, output, cache, ctx);
          inflate(
            (img as unknown as { pixelFormat?: unknown }).pixelFormat,
            output,
            cache,
            ctx,
          );
          break;
        }
        /* c8 ignore stop */
        case input instanceof RegExp: {
          const re = input as RegExp;
          output.push(REGEXP);
          inflate(re.source, output, cache, ctx);
          inflate(re.flags, output, cache, ctx);
          break;
        }
        case input instanceof File: {
          const file = input as File;
          output.push(FILE);
          inflate(file.name, output, cache, ctx);
          inflate(file.lastModified, output, cache, ctx);
          // 폴스루 — File은 Blob이기도 하므로 이어서 BLOB 데이터까지
          // 기록한다.
        }
        case input instanceof Blob: {
          const blob = input as Blob;
          const size = blob.size;
          output.push(BLOB);
          inflate(blob.type, output, cache, ctx);
          inflate(size, output, cache, ctx);
          // 실제 바이트는 아직 없으니 자리(0으로 채운 자리표시자)만 미리
          // 차지해 두고, 이 호출의 ctx.blobs 처리 시 이 위치(length)에
          // 덮어쓴다.
          const length = output.length;
          ctx.pushView(output as Stack, new Uint8Array(size));
          ctx.blobs.push(
            blob
              .arrayBuffer()
              .then((buffer) => [length, buffer] as [number, ArrayBuffer]),
          );
          break;
        }
        default: {
          // toJSON이 있으면 그 결과를 대신 인코딩하고, 없으면 열거 가능한
          // 키/값 쌍을 OBJECT로 기록한다.
          if (input !== null && "toJSON" in (input as object)) {
            const json = (input as { toJSON(): unknown }).toJSON();
            inflate(json === input ? null : json, output, cache, ctx);
          } else {
            const keys = ownKeys(input as object);
            const length = keys.length;
            set(output, OBJECT, length);
            for (let i = 0; i < length; i++) {
              const key = keys[i]!;
              inflate(key, output, cache, ctx);
              inflate(
                (input as Record<PropertyKey, unknown>)[key],
                output,
                cache,
                ctx,
              );
            }
          }
          break;
        }
      }
      break;
    }
    case "string": {
      // 문자열은 값 비교로 캐시되므로, 같은 내용의 문자열이 반복되면 자동
      // 으로 RECURSION 백레퍼런스로 압축된다.
      if (process(input, output, cache)) {
        const encoded = textEncoder.encode(input);
        set(output, STRING, encoded.length);
        ctx.pushView(output as Stack, encoded);
      }
      break;
    }
    case "boolean": {
      output.push(input ? TRUE : FALSE);
      break;
    }
    case "symbol": {
      output.push(SYMBOL);
      inflate(toSymbol(input), output, cache, ctx);
      break;
    }
    case "bigint": {
      // int64 최댓값을 넘으면 부호 없는 태그(BIGUINT)로, 아니면 부호 있는
      // 태그(BIGINT)로 인코딩한다.
      let type = BIGINT;
      if (9223372036854775807n < input) {
        dv.setBigUint64(0, input, true);
        type = BIGUINT;
      } else dv.setBigInt64(0, input, true);
      output.push(
        type,
        u8a8[0]!,
        u8a8[1]!,
        u8a8[2]!,
        u8a8[3]!,
        u8a8[4]!,
        u8a8[5]!,
        u8a8[6]!,
        u8a8[7]!,
      );
      break;
    }
    // 여기 도달하는 값은 undefined거나 함수다 — 둘 다 UNDEFINED 태그로
    // 인코딩한다.
    default: {
      output.push(UNDEFINED);
      break;
    }
  }
};

/** 값을 일반 number 배열로 인코딩한다. Blob/File은 지원하지 않는다 — 필요하면 encoder()를 쓴다. */
export const encode = (value: unknown): number[] => {
  const output: number[] = [];
  const ctx: Ctx = { blobs: [], pushView: push as unknown as PushView };
  inflate(value, output as unknown as Output, new Map(), ctx);
  if (ctx.blobs.length)
    // ADR-0002와 같은 원칙 — 지원하지 않는 능력은 진단 가능한 에러로
    // 알린다. encode()는 동기 배열만 반환하는 interface라 Blob/File의
    // 비동기 바이트를 채워 넣을 자리가 없다.
    throw new Error(
      "encode()는 Blob/File을 지원하지 않는다 — 대신 encoder()를 쓴다.",
    );
  return output;
};

/**
 * 값을 지정한 버퍼(byteOffset부터)에 직접 인코딩하는 인코더 함수를 만든다.
 * Blob/File이 포함되면 바이트를 비동기로 읽어야 해서 반환값이 Promise일
 * 수 있다.
 */
export const encoder =
  <T extends typeof Stack = typeof Stack>({
    byteOffset = 0,
    Array: ArrayClass = Stack as unknown as T,
  }: { byteOffset?: number; Array?: T } = {}) =>
  (value: unknown, buffer: ArrayBufferLike): number | Promise<number> => {
    const output = new ArrayClass(buffer, byteOffset);
    const ctx: Ctx = {
      blobs: [],
      pushView: ArrayClass.push as unknown as PushView,
    };
    inflate(value, output as unknown as Output, new Map(), ctx);
    const length = output.length;
    output.sync(true);
    return ctx.blobs.length
      ? Promise.all(ctx.blobs).then((entries) => {
          // 대기 중이던 Blob/File 바이트를 앞서 예약해 둔 위치에 채운다.
          const ui8a = new Uint8Array(buffer, byteOffset);
          for (const [len, buff] of entries)
            ui8a.set(new Uint8Array(buff), len);
          return length;
        })
      : length;
  };
