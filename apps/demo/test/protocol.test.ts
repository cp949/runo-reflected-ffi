import { describe, expect, it } from "vitest";
import {
  buildAsyncFailureReply,
  buildAsyncSuccessReply,
  buildSyncErrorPayload,
  classifyMainMessage,
} from "../src/protocol";
import { APPLY, GET, UNREF } from "@cp949/runo-reflected-ffi/traps";
import { createMainBridge } from "../src/main-bridge";
import { createWorkerBridge } from "../src/worker-bridge";

/**
 * main용/worker용 fake postMessage 쌍을 만든다 — 상대의 postMessage 호출이
 * 리스너를 동기적으로 즉시 호출하도록 연결한다. 실제 Worker/SharedArrayBuffer
 * 없이 async 경로(sendAsync)의 envelope 왕복만 검증하기 위한 테스트 대역이다.
 */
function createFakePostMessagePair() {
  let workerListener: ((event: MessageEvent) => void) | null = null;
  const fakeWorker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage(data: unknown) {
      workerListener?.({ data } as MessageEvent);
    },
  };
  const fakeWorkerEndpoint = {
    postMessage(data: unknown) {
      fakeWorker.onmessage?.({ data } as MessageEvent);
    },
    addEventListener(
      _type: "message",
      listener: (event: MessageEvent) => void,
    ) {
      workerListener = listener;
    },
  };
  return { fakeWorker, fakeWorkerEndpoint };
}

describe("classifyMainMessage", () => {
  it("status 메시지를 kind: status로 분류한다", () => {
    const data = { type: "status", text: "worker ready" };

    expect(classifyMainMessage(data)).toEqual({
      kind: "status",
      text: "worker ready",
    });
  });

  it("[id, true, value] 배열을 성공한 asyncReply로 분류한다", () => {
    const data = [3, true, "hello"];

    expect(classifyMainMessage(data)).toEqual({
      kind: "asyncReply",
      id: 3,
      ok: true,
      value: "hello",
    });
  });

  it("[id, false, {name,message,stack}] 배열을 실패한 asyncReply로 분류하며 value를 Error로 복원한다", () => {
    const data = [
      7,
      false,
      { name: "TypeError", message: "boom", stack: "TypeError: boom\n  at x" },
    ];

    const result = classifyMainMessage(data);

    expect(result.kind).toBe("asyncReply");
    if (result.kind !== "asyncReply") throw new Error("unreachable");
    expect(result.id).toBe(7);
    expect(result.ok).toBe(false);
    expect(result.value).toBeInstanceOf(Error);
    expect((result.value as Error).name).toBe("TypeError");
    expect((result.value as Error).message).toBe("boom");
    expect((result.value as Error).stack).toBe("TypeError: boom\n  at x");
  });

  it("[Int32Array, args] 배열을 syncCall로 분류한다", () => {
    const i32a = new Int32Array(new SharedArrayBuffer(8));
    const args = [1, "uid-1"];
    const data = [i32a, args];

    expect(classifyMainMessage(data)).toEqual({
      kind: "syncCall",
      i32a,
      args,
    });
  });
});

describe("buildAsyncSuccessReply", () => {
  it("[id, true, value]를 만든다", () => {
    expect(buildAsyncSuccessReply(9, "결과값")).toEqual([9, true, "결과값"]);
  });
});

describe("buildAsyncFailureReply", () => {
  it("UNREF 실패는 삼켜 [id, true, undefined]를 만든다", () => {
    const err = new Error("finalization callback threw");

    expect(buildAsyncFailureReply(5, UNREF, err)).toEqual([5, true, undefined]);
  });

  it("APPLY 실패는 [id, false, {name,message,stack}]으로 되돌린다", () => {
    const err = new TypeError("callback threw");

    expect(buildAsyncFailureReply(11, APPLY, err)).toEqual([
      11,
      false,
      { name: "TypeError", message: "callback threw", stack: err.stack },
    ]);
  });
});

describe("buildSyncErrorPayload", () => {
  it("GET 실패는 [false, error]로 감싼다 — remote.ts의 Handler#get이 2-tuple을 기대한다(ADR-0007)", () => {
    const error = new Error("no such property");

    expect(buildSyncErrorPayload(GET, error)).toEqual([false, error]);
  });

  it("GET이 아닌 method 실패는 감싸지 않고 error를 그대로 돌려준다", () => {
    const error = new Error("apply threw");

    expect(buildSyncErrorPayload(APPLY, error)).toBe(error);
  });
});

describe("async round-trip (fake postMessage 쌍)", () => {
  it("worker의 reflect()가 reject하면 main의 sendAsync Promise도 reject한다 — 5ffa5e8 회귀", async () => {
    const { fakeWorker, fakeWorkerEndpoint } = createFakePostMessagePair();

    const mainBridge = createMainBridge(fakeWorker as unknown as Worker, {
      reflect: () => {
        throw new Error("이 테스트는 main→worker sync 경로를 쓰지 않는다");
      },
      onStatus: () => {},
    });
    createWorkerBridge(fakeWorkerEndpoint, {
      reflect: async () => {
        throw new Error("remote callback threw");
      },
    });

    await expect(mainBridge.sendAsync([APPLY, 1])).rejects.toThrow(
      "remote callback threw",
    );
  });

  it("worker의 reflect()가 성공하면 main의 sendAsync Promise가 그 값으로 resolve한다", async () => {
    const { fakeWorker, fakeWorkerEndpoint } = createFakePostMessagePair();

    const mainBridge = createMainBridge(fakeWorker as unknown as Worker, {
      reflect: () => {
        throw new Error("이 테스트는 main→worker sync 경로를 쓰지 않는다");
      },
      onStatus: () => {},
    });
    createWorkerBridge(fakeWorkerEndpoint, {
      reflect: async () => "worker가 돌려준 값",
    });

    await expect(mainBridge.sendAsync([APPLY, 1])).resolves.toBe(
      "worker가 돌려준 값",
    );
  });
});
