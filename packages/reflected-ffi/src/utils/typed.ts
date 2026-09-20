import { resolveViewClass, toTag } from "./global";
import { fromArray } from "./index";

// ArrayBuffer/TypedArray/DataView를 와이어로 주고받을 수 있는 튜플로
// 바꾸거나(toBuffer/toView) 되돌린다(fromBuffer/fromView). `direct`는 direct
// 코덱(이진 전송, ArrayBufferLike를 그대로 옮길 수 있음)인지, 아니면 JSON류
// 경로(숫자 배열로 풀어야 함)인지를 가른다.

/** [버퍼 내용(direct면 ArrayBufferLike 그대로, 아니면 숫자 배열), maxByteLength(resizable 아니면 0)]. */
export type BufferDetails = [ArrayBufferLike | number[], number];

/** [뷰의 클래스 이름(toTag), 버퍼 정보, byteOffset, length(기본 길이면 0)]. */
export type ViewDetails = [string, BufferDetails, number, number];

// maxByteLength까지 늘어날 수 있는(resizable) ArrayBuffer를 만든다.
const resizable = (length: number, maxByteLength: number): ArrayBufferLike =>
  new ArrayBuffer(length, { maxByteLength });

/** 와이어에서 받은 `BufferDetails`로부터 원래의 ArrayBufferLike를 복원한다. */
export const fromBuffer = (
  [value, maxByteLength]: BufferDetails,
  direct: boolean,
): ArrayBufferLike => {
  const length = direct
    ? (value as ArrayBufferLike).byteLength
    : (value as number[]).length;
  if (direct) {
    // direct 코덱은 이미 ArrayBufferLike를 받았다. resizable이어야 하면
    // 새 resizable 버퍼로 복사해 옮긴다.
    if (maxByteLength) {
      const buffer = resizable(length, maxByteLength);
      new Uint8Array(buffer).set(new Uint8Array(value as ArrayBufferLike));
      value = buffer;
    }
  } else {
    // JSON류 경로는 숫자 배열로 받았으므로 버퍼를 새로 만들어 채워야 한다.
    const buffer = maxByteLength
      ? resizable(length, maxByteLength)
      : new ArrayBuffer(length);
    new Uint8Array(buffer).set(value as number[]);
    value = buffer;
  }
  return value as ArrayBufferLike;
};

/** 와이어에서 받은 `ViewDetails`로부터 원래의 TypedArray/DataView를 복원한다. */
export const fromView = (
  [name, args, byteOffset, length]: ViewDetails,
  direct: boolean,
): ArrayBufferView => {
  const buffer = fromBuffer(args, direct);
  const Class = resolveViewClass(name) as new (
    buffer: ArrayBufferLike,
    byteOffset: number,
    length?: number,
  ) => ArrayBufferView;
  return length
    ? new Class(buffer, byteOffset, length)
    : new Class(buffer, byteOffset);
};

/** ArrayBufferLike를 와이어로 보낼 `BufferDetails`로 변환한다. */
export const toBuffer = (
  value: ArrayBufferLike,
  direct: boolean,
): BufferDetails => [
  direct ? value : fromArray(new Uint8Array(value)),
  // `value`는 (toView가 넘기는 TypedArray의 buffer를 통해) SharedArrayBuffer일
  // 수도 있는데, SharedArrayBuffer에는 `resizable` 프로퍼티가 없다 — 이 캐스트는
  // 그 사실을 명시할 뿐이며, 아래 접근은 그 경우 `undefined`(falsy)로 읽힌다.
  (value as ArrayBuffer).resizable ? (value as ArrayBuffer).maxByteLength : 0,
];

/** TypedArray/DataView를 와이어로 보낼 `ViewDetails`로 변환한다. */
export const toView = (
  value: ArrayBufferView,
  direct: boolean,
): ViewDetails => {
  const { BYTES_PER_ELEMENT, byteOffset, buffer, length } =
    value as ArrayBufferView & { BYTES_PER_ELEMENT: number; length: number };
  return [
    toTag(value),
    toBuffer(buffer, direct),
    byteOffset,
    // length가 버퍼 나머지 전체를 채우는 기본값과 같으면 0으로 생략해,
    // fromView가 length 없이 생성자를 호출하도록 한다.
    length !== (buffer.byteLength - byteOffset) / BYTES_PER_ELEMENT
      ? length
      : 0,
  ];
};
