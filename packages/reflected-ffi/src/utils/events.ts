// EventTarget.prototype.addEventListener를 패치하는 선택적 유틸리티다.
// 이 파일의 default export는 `local({ remote: ... })` 호출 시 `remote` 필드로 쓴다.

// `invoke`로 지정한 메서드 이름을 addEventListener 옵션에 추가로 받기 위한 타입.
type InvokeOptions = AddEventListenerOptions & { invoke?: string | string[] };

const { addEventListener } = EventTarget.prototype;

// EventTarget별로 "이벤트 타입 -> 이벤트 발생 시 호출할 메서드 이름 목록"을 기록한다.
const eventsHandler = new WeakMap<EventTarget, Map<string, string[]>>();

/**
 * addEventListener에 `invoke` 옵션을 추가한다. `invoke`로 넘긴 메서드 이름은
 * 이 파일의 default export가 실제 이벤트 발생 시 이벤트 객체에서 찾아 호출한다
 * (예: 원격 함수 실행 후에도 `preventDefault`/`stopPropagation`을 적용하기 위함).
 */
Reflect.defineProperty(EventTarget.prototype, "addEventListener", {
  value(
    this: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: InvokeOptions | boolean,
  ): void {
    const invoke =
      typeof options === "object" && options !== null
        ? options.invoke
        : undefined;
    if (invoke) {
      // 이 target에 대한 기록이 없으면 새로 만든다.
      let map = eventsHandler.get(this);
      if (!map) eventsHandler.set(this, (map = new Map()));
      map.set(type, ([] as string[]).concat(invoke));
      // 표준 addEventListener 옵션에는 없는 필드이므로 전달 전에 제거한다.
      delete (options as InvokeOptions).invoke;
    }
    return (addEventListener as Function).apply(this, arguments);
  },
});

/**
 * 원격 쪽에서 정의한 함수를 통해 실행된 이벤트에 `preventDefault`나
 * `stopPropagation` 등을 적용할 때 쓴다. 이벤트의 currentTarget(없으면
 * target)에 등록된 `invoke` 메서드 이름들을 찾아 순서대로 호출한다.
 */
export default (event: Event): void => {
  const { currentTarget, target, type } = event;
  const methods = eventsHandler
    .get((currentTarget || target) as EventTarget)
    ?.get(type);
  if (methods)
    for (const method of methods)
      (event as unknown as Record<string, () => void>)[method]!();
};
