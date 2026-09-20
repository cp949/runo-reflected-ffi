// encoder가 쓰는 배열 유사 퍼사드 — number[] 대신 실제 바이트 버퍼(ArrayBuffer/
// SharedArrayBuffer)에 직접 기록해 중간 배열 할당을 피한다.

/** 인코딩 대상 값을 담는 스택. push()로 쌓은 값을 필요할 때 버퍼로 흘려보낸다. */
export default class Stack {
  protected l: number;
  protected o: number[];
  protected v: Uint8Array;
  push: (...items: number[]) => number;

  /** 대기 중인 값을 먼저 버퍼에 반영한 뒤, 새 값 하나를 이어서 기록한다. */
  static push(self: Stack, value: Uint8Array): void {
    self.sync(false);
    self._(value, value.length);
  }

  constructor(buffer: ArrayBufferLike, offset: number) {
    const output: number[] = [];

    // 지금까지 버퍼에 실제로 반영된 바이트 길이
    this.l = 0;

    // sync 전까지 임시로 쌓아 두는 개별 바이트 값
    this.o = output;

    // 기록 대상 버퍼(offset 이후 구간)를 가리키는 뷰
    this.v = new Uint8Array(buffer, offset);

    this.push = output.push.bind(output);
  }

  get length(): number {
    return this.l + this.o.length;
  }

  /** o에 쌓인 항목을 버퍼에 반영한다. last가 아니면 이어서 쓰기 위해 o를 비운다. */
  sync(last: boolean): void {
    const output = this.o;
    const length = output.length;
    if (length) this._(last ? output : output.splice(0), length);
  }

  /** 값을 실제 버퍼에 쓴다. 공간이 모자라면 버퍼 확장을 시도한다. */
  protected _(value: Uint8Array | number[], byteLength: number): void {
    const { buffer, byteOffset } = this.v;
    const offset = this.l;
    this.l += byteLength;
    byteLength += byteOffset + offset;
    if (buffer.byteLength < byteLength) {
      // 이 버퍼는 항상 growable SharedArrayBuffer다 — 일반 ArrayBuffer에는
      // grow가 없다. `.grow()` 자체가 Chrome 111+에만 있고 그 미만
      // 브라우저(예: Chrome 84)에는 대체(ponyfill) 방법이 없다 — 새 버퍼를
      // 할당해 복사해도 이미 이 SharedArrayBuffer 참조를 들고 있는 다른
      // 스레드에는 반영되지 않기 때문이다. 그런 환경을 대상으로 할 때는
      // 버퍼를 처음부터 예상 최대 크기로 할당해 둬야 한다.
      if (!("grow" in buffer))
        throw new RangeError(
          "Stack buffer capacity exceeded and this environment has no growable SharedArrayBuffer support — allocate the buffer with enough capacity upfront.",
        );
      (buffer as SharedArrayBuffer).grow(byteLength);
    }
    this.v.set(value, offset);
  }
}
