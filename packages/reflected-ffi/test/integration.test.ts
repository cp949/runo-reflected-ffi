import { describe, expect, it } from "vitest";
import local from "../src/local";
import remote from "../src/remote";
import { UNREF } from "../src/utils/traps";

// local()은 timeout(memoize) 옵션이 없고, remote()는 buffer(direct 인코딩) 옵션이
// 없다 — 두 필드는 이제 peer마다 독립된 설정이라 서로 맞출 필요 자체가 없다
// (ADR-0007). Battery는 그 독립성을 그대로 드러낸다.
type Battery = { localBuffer: boolean; remoteTimeout: number };

const bootstrap = ({ localBuffer, remoteTimeout }: Battery) => {
  const array = [1, 2, 3];

  const there: ReturnType<typeof remote> = remote({
    timeout: remoteTimeout,
    reflect: (...args: Parameters<ReturnType<typeof local>["reflect"]>) =>
      here.reflect(...args),
    transform: (value: unknown) =>
      value === array ? there.direct(array) : value,
  });

  const here: ReturnType<typeof local> = local({
    buffer: localBuffer,
    reflect: (...args: Parameters<ReturnType<typeof remote>["reflect"]>) =>
      there.reflect(...args),
    transform: (value: unknown) =>
      value === array ? here.direct(array) : value,
  });

  return { there, here, array };
};

const runBattery = async ({
  localBuffer,
  remoteTimeout,
}: Battery): Promise<void> => {
  const { there, here, array } = bootstrap({ localBuffer, remoteTimeout });
  const theGlobal = there.global as Record<string, any>;

  // WeakRef/FinalizationRegistry uid 캐시가 실제로 상대에게 UNREF를 보내는지
  // 잠그는 스파이. reflect는 프로퍼티 조회 시점에 호출되므로 이후 교체해도
  // FinalizationRegistry 콜백을 포함한 모든 호출을 잡는다.
  let unrefCount = 0;
  const origHereReflect = here.reflect.bind(here);
  here.reflect = ((...args: Parameters<typeof origHereReflect>) => {
    if (args[0] === UNREF) unrefCount++;
    return origHereReflect(...args);
  }) as typeof here.reflect;
  const origThereReflect = there.reflect.bind(there);
  there.reflect = ((...args: Parameters<typeof origThereReflect>) => {
    if (args[0] === UNREF) unrefCount++;
    return origThereReflect(...args);
  }) as typeof there.reflect;

  theGlobal.trapped = function trap() {};

  expect(Object.isExtensible(theGlobal.Array)).toBe(true);
  expect("isArray" in theGlobal.Array).toBe(true);
  expect(theGlobal.Array.isArray([])).toBe(true);
  expect(theGlobal.Array.isArray(new theGlobal.Array())).toBe(true);
  expect(new theGlobal.Array() instanceof theGlobal.Array).toBe(true);

  const arr3 = new theGlobal.Array(1, 2, 3);
  for (let i = 0; i < 3; i++) {
    expect(arr3[i]).toBe(i + 1);
    expect(arr3.at(i)).toBe(i + 1);
  }

  expect(theGlobal.Symbol.iterator in theGlobal.Array.prototype).toBe(true);
  expect(Symbol.for("iterator") in theGlobal.Array.prototype).toBe(false);
  expect(theGlobal.Object({}) instanceof theGlobal.Object).toBe(true);
  expect(new theGlobal.Date() instanceof theGlobal.Date).toBe(true);
  expect(theGlobal.Object.getPrototypeOf(new theGlobal.Date())).toBe(
    theGlobal.Date.prototype,
  );
  expect(theGlobal.Reflect.isExtensible({})).toBe(true);

  let obj = theGlobal.Object({});
  obj.value = 123;
  expect(obj.value).toBe(123);
  expect(Reflect.ownKeys(obj).length).toBe(1);
  expect(Reflect.ownKeys(obj)[0]).toBe("value");
  expect(theGlobal.Object.is(obj, obj)).toBe(true);
  expect(theGlobal.Object.is(obj, {})).toBe(false);
  expect(!!Object.getOwnPropertyDescriptor(obj, "value")).toBe(true);
  expect(!!theGlobal.Object.getOwnPropertyDescriptor(obj, "value")).toBe(true);
  delete obj.value;
  expect(!!Object.getOwnPropertyDescriptor(obj, "value")).toBe(false);
  expect(!!theGlobal.Object.getOwnPropertyDescriptor(obj, "value")).toBe(false);

  theGlobal.Object.defineProperty(obj, "value", {
    configurable: true,
    get: theGlobal.Function('return "get"'),
    set: (_: unknown) => "set",
  });
  expect(obj.value).toBe("get");

  expect(Object.getPrototypeOf(obj)).toBe(theGlobal.Object.prototype);
  expect(Reflect.setPrototypeOf(obj, null)).toBe(true);
  try {
    Object.preventExtensions(obj);
  } catch {
    /* proxy may reject this, matches original */
  }

  const fn = theGlobal.Function("a", "return a");
  expect(fn(true)).toBe(true);
  expect(!!fn(globalThis)).toBe(true);
  expect(fn(theGlobal)).toBe(theGlobal);
  expect(fn(null)).toBe(null);
  expect(fn(Symbol.iterator)).toBe(Symbol.iterator);
  expect(fn(new ArrayBuffer(12))).toBeInstanceOf(ArrayBuffer);
  expect(fn(new Int32Array([1, 2, 3]))).toBeInstanceOf(Int32Array);
  expect(fn(Function)).toBe(fn(Function));

  expect(there.isProxy(theGlobal.JSON)).toBe(true);
  expect(there.isProxy(theGlobal.Array)).toBe(true);
  expect(there.isProxy(null)).toBe(false);
  expect(there.isProxy(false)).toBe(false);

  expect(fn(array)).toBe(array);
  expect(fn(123n)).toBe(123n);

  expect(ArrayBuffer.isView(new theGlobal.Int32Array([1, 2, 3]))).toBe(true);
  expect((await theGlobal.import("../src/types")).DIRECT).toBe(0);

  expect(here.evaluate((a: number, b: number) => a + b, 1, 2)).toBe(3);
  expect(there.evaluate((a: number, b: number) => a + b, 1, 2)).toBe(3);
  expect(
    there.evaluate(
      function named(a: number, b: number) {
        return a + b;
      },
      1,
      2,
    ),
  ).toBe(3);
  expect(
    there.evaluate(
      {
        test(a: number, b: number) {
          return a + b;
        },
      }.test,
      1,
      2,
    ),
  ).toBe(3);
  expect(
    await there.evaluate(
      async function asyncTest(a: number, b: number) {
        return a + b;
      },
      1,
      2,
    ),
  ).toBe(3);

  expect(there.query(theGlobal, "Array.isArray.length")).toBe(
    there.query(globalThis, "Array.isArray.length"),
  );
  expect(there.query(theGlobal, 'Array["isArray"]["length"]')).toBe(
    there.query(globalThis, "Array.isArray.length"),
  );
  expect(there.query(theGlobal, "Object.name[0]")).toBe("O");

  Object.defineProperty(theGlobal, "test", { value: 123 });
  expect(theGlobal.test).toBe(123);

  await new Promise<void>((resolve) => {
    theGlobal.setTimeout(
      (a: number, b: number, c: number) => {
        expect(a === 1 && b === 2 && c === 3).toBe(true);
        resolve();
      },
      10,
      1,
      2,
      3,
    );
  });

  const arr = new theGlobal.Array(1, 2, 3);
  fn(here.direct([arr, arr]));

  there.assign(theGlobal, { value: 1, array: [1, 2, 3] });
  expect(
    here.gather(
      { value: 1, [Symbol.for("gather")]: 2 },
      "value",
      Symbol.for("gather"),
    )[0],
  ).toBe(1);
  expect(
    here.gather(
      { value: 1, [Symbol.for("gather")]: 2 },
      "value",
      Symbol.for("gather"),
    )[1],
  ).toBe(2);
  expect(there.gather(theGlobal, "value")[0]).toBe(1);
  expect(there.gather(theGlobal, "value").length).toBe(1);
  expect(there.gather(theGlobal, "value", "array").length).toBe(2);
  expect(there.gather(theGlobal, "value", "array[1]")[1]).toBe(2);
  expect(there.gather(theGlobal, Symbol.iterator)[0]).toBeUndefined();

  obj = there.assign({}, { value: 1 });
  expect(there.gather(obj, "value")[0]).toBe(1);
  expect(there.gather(obj, "value").length).toBe(1);

  // non-proxy target에 dotted-path 문자열 키를 넘기면 there.gather도
  // here.gather처럼 query()로 경로를 해석해야 한다(bracket 전용 접근 금지).
  obj = there.assign({}, { nested: { value: 5 } });
  expect(there.gather(obj, "nested.value")[0]).toBe(5);

  expect(there.isProxy(new theGlobal.Uint8Array([1, 2, 3]))).toBe(false);
  expect([...new theGlobal.Uint8Array([1, 2, 3])]).toEqual([1, 2, 3]);

  obj = null;
  theGlobal.trapped = null;

  try {
    if (typeof gc === "function") gc();
  } catch {
    /* --expose-gc might not be active in some runners */
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 마지막 참조가 끊긴 프록시/래퍼 함수가 실제로 GC돼 FinalizationRegistry가
  // 상대에게 UNREF를 보냈는지 고정한다 — 이전에는 gc()만 호출하고 결과를
  // 단언하지 않는 smoke-run이었다.
  expect(unrefCount).toBeGreaterThanOrEqual(1);

  here.terminate();
};

describe("local ↔ remote 통합 (원본 test/index.js + test/buffer.js 이식)", () => {
  // local의 buffer와 remote의 timeout은 서로 다른 관심사라 맞춰 설정할 필요가
  // 없다(ADR-0007) — 이 매트릭스는 그 독립성 자체를 검증한다. 특히 마지막 케이스는
  // 이전엔 원본 코드가 "두 peer가 같은 값을 쓴다"고 가정해 한 번도 테스트되지 않았던
  // 조합이다: local이 direct 버퍼 인코딩을 쓰면서 동시에 remote가 GET 결과를
  // 캐싱하는 경우.
  it.each([
    {
      label: "local buffer:false, remote timeout:-1(캐시 없음)",
      localBuffer: false,
      remoteTimeout: -1,
    },
    {
      label: "local buffer:false, remote timeout:1(캐시 있음)",
      localBuffer: false,
      remoteTimeout: 1,
    },
    {
      label: "local buffer:true, remote timeout:-1(캐시 없음)",
      localBuffer: true,
      remoteTimeout: -1,
    },
    {
      label: "local buffer:true, remote timeout:1(캐시 있음) — 이전엔 검증된 적 없는 조합",
      localBuffer: true,
      remoteTimeout: 1,
    },
  ])(
    "$label",
    async ({ localBuffer, remoteTimeout }) => {
      await runBattery({ localBuffer, remoteTimeout });
    },
    10_000,
  );
});
