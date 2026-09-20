import { describe, expect, it } from "vitest";
import local from "../src/local";
import remote from "../src/remote";

type Battery = { timeout: number; buffer: boolean };

const bootstrap = ({ timeout, buffer }: Battery) => {
  const array = [1, 2, 3];

  const there: ReturnType<typeof remote> = remote({
    timeout,
    buffer,
    reflect: (...args: Parameters<ReturnType<typeof local>["reflect"]>) =>
      here.reflect(...args),
    transform: (value: unknown) =>
      value === array ? there.direct(array) : value,
  });

  const here: ReturnType<typeof local> = local({
    timeout,
    buffer,
    reflect: (...args: Parameters<ReturnType<typeof remote>["reflect"]>) =>
      there.reflect(...args),
    transform: (value: unknown) =>
      value === array ? here.direct(array) : value,
  });

  return { there, here, array };
};

const runBattery = async ({ timeout, buffer }: Battery): Promise<void> => {
  const { there, here, array } = bootstrap({ timeout, buffer });
  const theGlobal = there.global as Record<string, any>;

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

  here.terminate();
};

describe("local ↔ remote 통합 (원본 test/index.js + test/buffer.js 이식)", () => {
  it.each([
    {
      label: "buffer:false, memoize 없음 (timeout=-1)",
      timeout: -1,
      buffer: false,
    },
    {
      label: "buffer:false, memoize 있음 (timeout=1)",
      timeout: 1,
      buffer: false,
    },
    {
      label: "buffer:true, memoize 없음 (timeout=-1)",
      timeout: -1,
      buffer: true,
    },
  ])(
    "$label",
    async ({ timeout, buffer }) => {
      await runBattery({ timeout, buffer });
    },
    10_000,
  );
});
