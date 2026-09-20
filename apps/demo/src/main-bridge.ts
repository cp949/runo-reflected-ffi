// main 스레드 쪽 브리지. worker에 보내는 비동기 요청(sendAsync)과, worker가
// SharedArrayBuffer + Atomics로 동기로 걸어오는 reflect 호출에 대한 응답을
// 함께 처리한다. 와이어 envelope 모양(응답 튜플 조립/해체, 에러 직렬화,
// GET-wrap 결정)은 ./protocol이 담당하고, 이 파일은 전송(Atomics/SharedArrayBuffer)만 다룬다.

import { encoder } from "@cp949/runo-reflected-ffi/encoder";
import nextResolver from "./next-resolver";
import {
  buildSyncErrorPayload,
  classifyMainMessage,
  PAYLOAD_BYTE_OFFSET,
} from "./protocol";

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
  const [next, settle] = nextResolver();
  // worker의 동기 reflect 호출 결과를 공유 버퍼의 payload 영역에 인코딩한다.
  const encode = encoder({ byteOffset: PAYLOAD_BYTE_OFFSET });

  // 인코딩 길이를 공유 버퍼에 쓰고 Atomics.notify로 worker의 Atomics.wait를
  // 깨운다. Blob/File 바이트가 버퍼에 채워지기 *전에* 이 함수를 부르면 worker가
  // 미완성 데이터를 읽으므로, encode(...)가 Promise를 반환하는 동안은 호출하지
  // 않는다(resolve/reject 이후에만 부른다).
  const notify = (i32a: Int32Array, length: number): void => {
    i32a[1] = length;
    i32a[0] = 1;
    Atomics.notify(i32a, 0);
  };

  // worker가 보낸 메시지를 종류별로 분기해 처리한다.
  worker.onmessage = ({ data }: MessageEvent) => {
    const msg = classifyMainMessage(data);
    switch (msg.kind) {
      case "status":
        deps.onStatus(msg.text);
        return;
      case "asyncReply":
        // sendAsync로 보낸 비동기 요청의 응답이다.
        settle(msg.id, msg.ok, msg.value);
        return;
      case "syncCall": {
        // worker가 동기로 건 reflect 호출이다 — 결과를 처리한 뒤 공유
        // 버퍼에 써서 Atomics.notify로 worker의 Atomics.wait를 깨운다.
        const { i32a, args } = msg;
        const result = deps.reflect(...(args as Parameters<Reflect>));
        // method가 UNREF(0)면 worker가 응답을 기다리지 않으므로 쓰지 않는다.
        if (!args[0]) return;
        const encoded = encode(result, i32a.buffer);
        if (encoded instanceof Promise) {
          // result에 Blob/File이 섞이면 encode()가 바이트를 다 채운 뒤에야
          // 끝나는 Promise를 돌려준다 — resolve될 때까지 notify를 미룬다.
          encoded.then(
            (length) => notify(i32a, length),
            (err: unknown) => {
              // Blob/File 바이트 읽기 실패. worker의 Atomics.wait는 타임아웃이
              // 없어 notify를 안 보내면 워커 스레드가 영구 정지하므로, 실패도
              // 반드시 notify한다.
              const error = err instanceof Error ? err : new Error(String(err));
              const payload = buildSyncErrorPayload(args[0] as number, error);
              notify(i32a, encode(payload, i32a.buffer) as number);
            },
          );
        } else {
          notify(i32a, encoded);
        }
        return;
      }
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
