// main 스레드 쪽 브리지. worker에 보내는 비동기 요청(sendAsync)과, worker가
// SharedArrayBuffer + Atomics로 동기로 걸어오는 reflect 호출에 대한 응답을
// 함께 처리한다.

import { encoder } from "@cp949/runo-reflected-ffi/encoder";
import nextResolver from "./next-resolver";
import { PAYLOAD_BYTE_OFFSET } from "./protocol";

/** local()/remote()의 reflect 콜백과 동일한 시그니처. 브리지가 그대로 감싸 전달한다. */
export type Reflect = (
  method: number,
  uid: unknown,
  ...args: unknown[]
) => unknown;

/** main 스레드가 worker에게 비동기 요청을 보낼 때 쓰는 인터페이스. */
export interface MainBridge {
  sendAsync(args: unknown[]): Promise<unknown>;
}

/**
 * main 스레드 쪽 브리지를 만든다. `deps.reflect`는 worker가 동기로 건
 * reflect 호출(local()이 노출한 값에 대한 GET/SET/APPLY 등)을 실제로
 * 처리하는 콜백이고, `deps.onStatus`는 worker가 보내는 상태 로그를 받는다.
 */
export function createMainBridge(
  worker: Worker,
  deps: {
    reflect: Reflect;
    onStatus: (text: string) => void;
  },
): MainBridge {
  // sendAsync로 보낸 요청(id)별로 응답 Promise를 관리한다.
  const [next, resolve] = nextResolver();
  // worker의 동기 reflect 호출 결과를 공유 버퍼의 payload 영역에 인코딩한다.
  const encode = encoder({ byteOffset: PAYLOAD_BYTE_OFFSET });

  // worker가 보낸 메시지를 종류별로 분기해 처리한다.
  worker.onmessage = ({ data }: MessageEvent) => {
    if (!Array.isArray(data)) {
      // 배열이 아니면 상태 로그 메시지다.
      const status = data as { type?: string; text?: string } | null;
      if (status?.type === "status") deps.onStatus(String(status.text));
      return;
    }
    const [first, args] = data as [Int32Array | number, unknown[]];
    if (typeof first === "number") {
      // 첫 요소가 숫자(id)면 sendAsync로 보낸 비동기 요청의 응답이다.
      resolve(first, args);
      return;
    }
    // 그 외에는 worker가 동기로 건 reflect 호출이다 — 결과를 처리한 뒤
    // 공유 버퍼에 써서 Atomics.notify로 worker의 Atomics.wait를 깨운다.
    const i32a = first;
    const result = deps.reflect(...(args as Parameters<Reflect>));
    // method가 UNREF(0)면 worker가 응답을 기다리지 않으므로 쓰지 않는다.
    if (args[0]) {
      i32a[1] = encode(result, i32a.buffer) as number;
      i32a[0] = 1;
      Atomics.notify(i32a, 0);
    }
  };

  return {
    // 새 요청 id를 발급해 worker에 보내고, 응답이 오면 완료될 Promise를 반환한다.
    sendAsync(args: unknown[]): Promise<unknown> {
      const [id, promise] = next();
      worker.postMessage([id, args]);
      return promise;
    },
  };
}
