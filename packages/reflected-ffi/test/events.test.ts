import { describe, expect, it, vi } from "vitest";
import invokeRemoteMethods from "../src/utils/events";

describe("utils/events", () => {
  it("invoke 옵션으로 등록된 메서드를 이벤트 객체에서 호출한다", () => {
    const target = new EventTarget();
    const preventDefault = vi.fn();
    // @ts-expect-error
    target.addEventListener("click", () => {}, { invoke: "preventDefault" });

    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });
    Object.defineProperty(event, "currentTarget", { value: target });

    invokeRemoteMethods(event);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("invoke 옵션이 없으면 아무 메서드도 호출하지 않는다", () => {
    const target = new EventTarget();
    const preventDefault = vi.fn();
    target.addEventListener("click", () => {});

    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });
    Object.defineProperty(event, "currentTarget", { value: target });

    invokeRemoteMethods(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("invoke는 배열로 여러 메서드를 지정할 수 있다", () => {
    const target = new EventTarget();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    target.addEventListener("click", () => {}, {
      // @ts-expect-error
      invoke: ["preventDefault", "stopPropagation"],
    });

    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });
    Object.defineProperty(event, "stopPropagation", { value: stopPropagation });
    Object.defineProperty(event, "currentTarget", { value: target });

    invokeRemoteMethods(event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
  });
});
