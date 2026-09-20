import { GET, UNREF } from "@cp949/runo-reflected-ffi/traps";

// main↔worker 동기 채널이 공유하는 SharedArrayBuffer는 앞 8바이트(Int32Array
// 2칸: ready 플래그, 인코딩된 결과의 길이)를 헤더로 쓴다. encoder/decoder는
// 이 오프셋 이후부터 실제 payload를 읽고 쓴다.
export const PAYLOAD_BYTE_OFFSET = 8;

/** main-bridge.ts가 worker.onmessage에서 받는 data를 종류별로 분류한 결과. */
export type MainMessage =
  | { kind: "status"; text: string }
  | { kind: "asyncReply"; id: number; ok: boolean; value: unknown }
  | { kind: "syncCall"; i32a: Int32Array; args: unknown[] };

// worker-bridge.ts가 async reflect 실패를 왕복시킬 때 쓰는 {name, message,
// stack} 평범한 객체를 Error 인스턴스로 되살린다 — 이 채널은 postMessage
// 구조적 복제에 기대므로, floor(Chrome 84/Firefox 79, ADR-0001)에서
// 보장되지 않는 네이티브 Error 클론에 기대지 않는다.
const toError = (payload: unknown): Error => {
  const { name, message, stack } = payload as {
    name?: string;
    message?: string;
    stack?: string;
  };
  return Object.assign(new Error(message), { name, stack });
};

/** worker가 보낸 메시지를 종류별로 분류한다. */
export function classifyMainMessage(data: unknown): MainMessage {
  if (Array.isArray(data)) {
    const [first] = data as [Int32Array | number, ...unknown[]];
    if (typeof first === "number") {
      const [id, ok, payload] = data as [number, boolean, unknown];
      return {
        kind: "asyncReply",
        id,
        ok,
        value: ok ? payload : toError(payload),
      };
    }
    const [i32a, args] = data as [Int32Array, unknown[]];
    return { kind: "syncCall", i32a, args };
  }
  const status = data as { type?: string; text?: string };
  return { kind: "status", text: String(status.text) };
}

/** worker-bridge.ts가 async reflect 성공을 main에 왕복시킬 때 보낼 메시지를 만든다. */
export function buildAsyncSuccessReply(
  id: number,
  value: unknown,
): [number, true, unknown] {
  return [id, true, value];
}

/**
 * worker-bridge.ts가 async reflect 실패를 main에 왕복시킬 때 보낼 메시지를
 * 만든다. method가 UNREF면 아무도 결과를 기다리지 않으므로(local.ts의
 * FinalizationRegistry 콜백이 fire-and-forget으로 호출) 실패해도 성공으로
 * 위장해 삼킨다 — reject로 돌려보내 봐야 소비하는 곳이 없어 새
 * unhandled rejection만 남는다.
 */
export function buildAsyncFailureReply(
  id: number,
  method: number,
  err: unknown,
): [number, boolean, unknown] {
  if (method === UNREF) return [id, true, undefined];
  const error = err instanceof Error ? err : new Error(String(err));
  return [
    id,
    false,
    { name: error.name, message: error.message, stack: error.stack },
  ];
}

/**
 * 동기 reflect 호출이 실패했을 때 공유 버퍼에 인코딩할 payload를 만든다.
 * GET의 응답 슬롯은 [shouldCache, [type, value]] 2-tuple이어야 remote.ts의
 * Handler#get이 구조분해에 성공한다(ADR-0007) — 실패도 같은 모양을 흉내내
 * [false, error]로 감싼다. 그 외(APPLY 등)는 remote.ts의 fromValue가 배열이
 * 아닌 값을 그대로 통과시키므로 감싸지 않는다. 이 규칙은 이 데모의 전송
 * 방식과 무관한 core 패키지 wire 계약이라, Worker+SharedArrayBuffer가 아닌
 * 다른 전송으로 브리지를 새로 만들어도 그대로 적용된다.
 */
export function buildSyncErrorPayload(method: number, error: Error): unknown {
  return method === GET ? [false, error] : error;
}
