// 데모용 worker 엔트리 포인트. remote()로 main 스레드가 local()로 노출한
// document/demoCounter/console에 동기적으로 접근하는 모습을 보여준다.

import remote from "@cp949/runo-reflected-ffi/remote";
import { createWorkerBridge, type Reflect } from "./worker-bridge";

// worker-bridge가 기대하는 최소 인터페이스로 self를 좁혀서 쓴다.
const worker = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
};

// remote()가 아직 만들어지기 전에 브리지를 먼저 구성해야 해서, reflect는
// 나중에 대입하는 변수로 선언하고 클로저로 참조만 넘긴다.
let reflect: Reflect;
const bridge = createWorkerBridge(worker, {
  reflect: (method, uid, ...args) => reflect(method, uid, ...args),
});

const remoteApi = remote({
  reflect: (...args: unknown[]) => bridge.sendSync(args),
});
reflect = remoteApi.reflect;

// main 스레드의 globalThis를 가리키는 프록시. 이하 접근은 전부 동기
// reflect(sendSync)를 통해 main 스레드로 왕복한다.
const theGlobal = remoteApi.global as Record<string, any>;

worker.postMessage({
  type: "status",
  text: `initial document.title = "${theGlobal.document.title}"`,
});

// main.ts가 window에 심어둔 데모 카운터를 worker에서 동기적으로 5번 증가시킨다.
const counter = theGlobal.demoCounter;
for (let i = 0; i < 5; i++) counter.value++;
worker.postMessage({
  type: "status",
  text: `demoCounter.value after 5 synchronous increments = ${counter.value}`,
});

// main 스레드의 document.title을 worker에서 직접 SET한다.
theGlobal.document.title = "updated by worker via reflected-ffi";
worker.postMessage({
  type: "status",
  text: "document.title updated from the worker thread.",
});

// main 스레드의 console을 그대로 호출한다 — 로그는 main 쪽 콘솔에 찍힌다.
theGlobal.console.log(
  "[reflected-ffi demo] hello from the worker, proxied to the main thread console",
);
