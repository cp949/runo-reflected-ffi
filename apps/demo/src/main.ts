// 데모용 main 엔트리 포인트. local()로 document/demoCounter/console을 worker에
// 노출하고, worker를 띄워 main-bridge를 통해 그 호출을 받아 처리한다.

import local from "@cp949/runo-reflected-ffi/local";
import { createMainBridge, type Reflect } from "./main-bridge";

// worker가 remote()로 접근할 데모 전용 전역 카운터.
declare global {
  interface Window {
    demoCounter: { value: number };
  }
}

const output = document.querySelector<HTMLPreElement>("#output");
if (!output) throw new Error("#output element not found");

/** 화면의 출력 영역에 한 줄 로그를 이어붙인다. */
const log = (text: string): void => {
  output.textContent += `${text}\n`;
};

window.demoCounter = { value: 0 };

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

// local()이 아직 만들어지기 전에 브리지를 먼저 구성해야 해서, reflect는
// 나중에 대입하는 변수로 선언하고 클로저로 참조만 넘긴다.
let reflect: Reflect;
const bridge = createMainBridge(worker, {
  reflect: (method, uid, ...args) => reflect(method, uid, ...args),
  onStatus: log,
});

const localApi = local({
  buffer: true,
  reflect: (...args: unknown[]) => bridge.sendAsync(args),
});
reflect = localApi.reflect;

log("main thread ready. spawning worker…");
