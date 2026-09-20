// Stack을 확장해, 값을 즉시 버퍼에 쓰는 대신 모아 뒀다가 마지막에 정확한
// 크기의 새 버퍼로 한 번에 옮겨 담는 변형. 전체 길이를 미리 알 수 없는
// 인코딩 대상에 쓴다.
import Stack from "./array";

// ArrayBuffer 서브클래스로 만들어, transferToFixedLength가 만든 결과 버퍼를
// 인스턴스 자신(value)에 들고 다니게 한다.
export class Array extends ArrayBuffer {
  value?: ArrayBuffer;

  transferToFixedLength(length: number): ArrayBuffer {
    return (this.value = new ArrayBuffer(length));
  }
}

/**
 * Stack과 달리 항목을 즉시 버퍼에 쓰지 않고 배열(e)에 모아 두고, 마지막
 * sync(true) 호출 시점에 정확한 크기의 새 ArrayBuffer로 한 번에 옮겨 담는다.
 */
export class Buffer extends Stack {
  protected e: (Uint8Array | number[])[];

  constructor(buffer: ArrayBufferLike, offset: number) {
    super(buffer, offset);
    this.e = [];
  }

  override sync(last: boolean): this {
    super.sync(last);
    if (last) {
      const length = this.l;
      const offset = this.v.byteOffset;
      // 지금까지 쌓인 총 길이만큼만 새 버퍼로 이전한다.
      const buffer = (this.v.buffer as Array).transferToFixedLength(
        length + offset,
      );
      // 모아둔 항목들을 순서대로 그 버퍼에 채워 넣는다.
      const view = new Uint8Array(buffer, offset);
      for (let entries = this.e, l = 0, i = 0; i < entries.length; i++) {
        const data = entries[i]!;
        view.set(data, l);
        l += data.length;
      }
    }
    return this;
  }

  /** 값을 버퍼에 바로 쓰지 않고, 나중에 한 번에 옮기기 위해 배열에 쌓아 둔다. */
  protected override _(value: Uint8Array | number[], byteLength: number): void {
    this.l += byteLength;
    this.e.push(value);
  }
}
