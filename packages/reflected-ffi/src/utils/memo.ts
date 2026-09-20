/**
 * `timeout` 밀리초 뒤 자동으로 비워지는 read-through Memo 캐시 클래스를 만든다.
 * `remote()`가 get/ownKeys/getPrototypeOf 트랩 결과를 짧게 캐싱할 때 쓴다.
 */
export default (timeout: number) => {
  // 채워진 (Map, key) 쌍을 순서대로 쌓아두는 큐. 타이머 하나가 이 큐를 훑으며 비운다.
  const entries: unknown[] = [];

  // 큐의 i번째 항목부터 끝까지 꺼내며 각 Map에서 해당 key를 지운다.
  const drop = (i: number): void => {
    const cached = entries.splice(i);
    while (i < cached.length)
      (cached[i++] as Map<string | symbol, unknown>).delete(
        cached[i++] as string | symbol,
      );
  };

  // (self, key)를 큐에 등록한다. push 전 큐가 비어 있었을 때만(반환값이 2 미만)
  // 새로 타이머를 예약해, 이미 예약된 타이머와 중복되지 않게 한다.
  const set = (
    self: Map<string | symbol, unknown>,
    key: string | symbol,
  ): void => {
    if (entries.push(self, key) < 3) setTimeout(drop, timeout, 0);
  };

  return class Memo extends Map<string | symbol, unknown> {
    static keys = Symbol();
    static proto = Symbol();

    // key의 캐시 엔트리를 지운다. proto 캐시가 아니면 ownKeys 캐시(keys)도 함께 지운다.
    drop<V>(key: string | symbol, value: V): V {
      if (key !== Memo.proto) super.delete(Memo.keys);
      super.delete(key);
      return value;
    }

    // read-through: key에 캐시된 값이 있으면 그대로 반환하고, 없으면 compute를
    // 호출해 값을 얻는다. compute가 캐싱해도 안전하다고 알려줄 때만 캐시에 저장한다.
    readOr<V>(key: string | symbol, compute: () => [boolean, V]): V {
      if (this.has(key)) return this.get(key) as V;
      const [cache, value] = compute();
      return cache ? this.set(key, value) : value;
    }

    // @ts-expect-error — 표준 Map#set은 `this`를 반환하지만, 이 구현은 의도적으로
    // 저장한 value를 그대로 반환한다. remote.ts의 Handler#get/#ownKeys/
    // #getPrototypeOf 트랩이 `this.$.set(...)`의 반환값을 자신의 반환값으로
    // 그대로 사용하므로 절대 `this`를 반환하도록 "고치면" 안 된다.
    set<V>(key: string | symbol, value: V): V {
      // @ts-expect-error super.set returns this (Memo), but set() expects Map
      set(super.set(key, value), key);
      return value;
    }
  };
};
