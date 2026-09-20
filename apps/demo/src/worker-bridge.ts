// worker 쪽 브리지. main으로 보내는 동기 reflect 호출(sendSync)과, main이
// 비동기 postMessage로 걸어오는 reflect 호출에 대한 응답을 함께 처리한다.

import { decoder } from "@cp949/runo-reflected-ffi/decoder";
import { PAYLOAD_BYTE_OFFSET } from "./protocol";

// self(WorkerGlobalScope)를 대체 가능하게 하기 위한 최소 인터페이스 —
// postMessage/addEventListener만 있으면 된다(테스트 대역으로도 대체 가능).
type WorkerEndpoint = {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
};

/** local()/remote()의 reflect 콜백과 동일한 시그니처. 브리지가 그대로 감싸 전달한다. */
export type Reflect = (
  method: number,
  uid: unknown,
  ...args: unknown[]
) => unknown;

/** worker가 main에게 동기 reflect 호출을 보낼 때 쓰는 인터페이스. */
export interface WorkerBridge {
  sendSync(args: unknown[]): unknown;
}

/**
 * worker 쪽 브리지를 만든다. `deps.reflect`는 main이 비동기로 걸어오는
 * reflect 호출(remote()가 worker에 넘긴 콜백에 대한 APPLY/UNREF 등)을 실제로
 * 처리하는 콜백이다.
 */
export function createWorkerBridge(
  worker: WorkerEndpoint,
  deps: { reflect: Reflect },
): WorkerBridge {
  // main이 동기 채널로 보낸 응답을 payload 영역부터 디코딩한다.
  const decode = decoder({ byteOffset: PAYLOAD_BYTE_OFFSET });

  // 고정 크기(1MiB)로 처음부터 전부 할당한다 — growable SharedArrayBuffer
  // (.grow(), Chrome 111+)는 최소 지원 브라우저 Chrome 84에 없고, 재할당
  // ponyfill은 main 스레드가 이미 이 SAB의 참조를 들고 있어 불가능하다
  // (ADR-0002). 필요한 최대치를 처음부터 잡아 grow 자체를 없앤다.
  const sab = new SharedArrayBuffer(1 << 20);
  const i32a = new Int32Array(sab);

  // main이 비동기(postMessage)로 건 reflect 호출을 처리하고 결과를 그대로 돌려보낸다.
  worker.addEventListener(
    "message",
    async ({ data }: MessageEvent<[number, unknown[]]>) => {
      const [id, args] = data;
      worker.postMessage([
        id,
        await deps.reflect(...(args as Parameters<Reflect>)),
      ]);
    },
  );

  return {
    // reflect 호출을 main에 동기로 전달한다. main-bridge가 결과를 공유
    // 버퍼에 써서 Atomics.notify하면, 여기서 그 값을 디코딩해 반환한다.
    sendSync(args: unknown[]): unknown {
      worker.postMessage([i32a, args]);
      // method가 UNREF(0)면 main이 응답을 쓰지 않으므로 기다릴 필요가 없다.
      if (args[0]) {
        //@ts-ignore — Atomics.wait의 value 인자 생략은 원본과 동일 동작(undefined가 0으로 강제 변환됨)
        Atomics.wait(i32a, 0);
        i32a[0] = 0;
        return decode(i32a[1] as number, i32a.buffer);
      }
    },
  };
}
