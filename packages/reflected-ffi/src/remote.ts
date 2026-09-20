// remote()의 구현. 반대편 local()이 감싼 객체를 로컬에서 Proxy로 그대로
// 다룰 수 있게 해주는 클라이언트를 만든다.

import {
  UNREF,
  ASSIGN,
  EVALUATE,
  GATHER,
  QUERY,
  APPLY,
  CONSTRUCT,
  DEFINE_PROPERTY,
  DELETE_PROPERTY,
  GET,
  GET_OWN_PROPERTY_DESCRIPTOR,
  GET_PROTOTYPE_OF,
  HAS,
  IS_EXTENSIBLE,
  OWN_KEYS,
  SET,
  SET_PROTOTYPE_OF,
} from "./utils/traps";

import {
  DIRECT,
  REMOTE,
  OBJECT,
  ARRAY,
  FUNCTION,
  SYMBOL,
  BIGINT,
  VIEW,
  BUFFER,
  REMOTE_OBJECT,
  REMOTE_FUNCTION,
} from "./types";

import { fromSymbol, toSymbol } from "./utils/symbol";
import { fromBuffer, fromView } from "./utils/typed";
import { toName } from "./utils/global";
import {
  assign,
  isArray,
  isView,
  fromKey,
  toKey,
  identity,
  loopValues,
  array,
  object,
  callback,
  tv,
} from "./utils/index";
import type { TypeValue } from "./utils/index";

import toJSONCallback from "./utils/to-json-callback";
import gather from "./utils/gather";
import query from "./utils/query";
import heap from "./utils/heap";
import memo from "./utils/memo";

export type RemoteOptions = {
  /** 원격 리시버를 거쳐 연산을 전달하는 함수. 모든 `Reflect` 메서드와 `unref`를 지원 */
  reflect?: (method: number, uid: unknown, ...args: unknown[]) => unknown;

  /** 로컬 값을 원격이 이해할 수 있는 더 단순한 참조로 바꾸는 함수 */
  transform?: (value: unknown) => unknown;

  /** 참조가 해제될 때 호출되는 함수 */
  released?: (value: unknown) => unknown;

  /** 원격 값을 캐싱할 수 있을 때 유지할 시간(ms). `-1`이면 캐싱하지 않음 */
  timeout?: number;
};

type MemoCtor = ReturnType<typeof memo>;
type MemoInstance = InstanceType<MemoCtor>;

/**
 * 원격 reflection 엔드포인트 하나를 만든다 — 통신하는 local peer 하나당 한
 * 번씩 호출하고, 하나의 인스턴스를 두 개 이상의 local과 공유하지 않는다.
 * (APPLY/UNREF 콜백에 쓰이는) `reflect`는 전달받은 `uid`를 누구에게
 * 공개됐었는지 검증하지 않고 그대로 신뢰하며, uid는 0부터 증가하는 단순
 * 카운터라서, 이 인스턴스를 여러 local이 공유하면 서로의 id가 충돌하거나
 * 새어 나갈 수 있다(ADR-0005).
 *
 * 이 `reflect` 역시 자체 인가 레이어가 없다 — APPLY/UNREF는 항상 허용된다.
 * 어떤 호출자가 이제껏 받은 모든 콜백을 자유롭게 실행하거나 해제할 수 있게
 * 두면 안 된다면, 이 함수를 호출하기 전에 자신의 전송/브리지 코드에서
 * `method`/`uid`를 걸러야 한다. method 상수는 `./utils/traps`에서
 * export하고 있다(ADR-0004).
 */
export default (
  {
    reflect = identity as unknown as (
      method: number,
      uid: unknown,
      ...args: unknown[]
    ) => unknown,
    transform = identity,
    released = identity,
    timeout = -1,
  }: RemoteOptions = object as RemoteOptions,
) => {
  // fromKey/toKey를 배열 전체에 적용하는 버전.
  const fromKeys = loopValues(fromKey);
  const toKeys = loopValues(toKey);

  // 와이어에서 받은 TypeValue를 로컬(remote 쪽)에서 쓸 수 있는 실제 값으로
  // 되돌린다. REMOTE 계열 태그는 local 쪽 참조를 감싸는 Proxy로 만든다.
  const fromValue = (value: unknown): unknown => {
    if (!isArray(value)) return value;
    const [t, v] = value as TypeValue;
    if ((t as number) & REMOTE) return asProxy(t, v);
    switch (t) {
      case OBJECT:
        return global;
      case DIRECT:
        return v;
      case SYMBOL:
        return fromSymbol(v as string);
      case BIGINT:
        return BigInt(v as string);
      case VIEW:
        return fromView(v as never);
      case BUFFER:
        return fromBuffer(v as never);
      // there is no other case
    }
  };

  // 로컬(remote 쪽) 값을 와이어로 보낼 TypeValue로 변환한다. 이미 local
  // 쪽에서 온 프록시(reflected 심볼을 가진 값)는 원래 참조 그대로 되돌려
  // 보내고, `direct()`로 등록되지 않은 순수 배열/plain object는 재귀적으로
  // 풀어서 보내며, 그 외에는 DIRECT 태그로 그대로 감싼다.
  const toValue = (
    value: unknown,
    cache: Map<unknown, TypeValue> = new Map(),
  ): unknown => {
    switch (typeof value) {
      case "object": {
        if (value === null) break;
        if (value === globalThis) return globalTarget;
        if (reflected in (value as object)) return reference;
        // 순환 참조 대비: 같은 값을 이미 변환했으면 캐시된 결과를 재사용한다.
        let cached = cache.get(value);
        if (!cached) {
          const $ = transform(value);
          if (indirect || !direct.has($ as WeakKey)) {
            if (isArray($)) {
              const a: unknown[] = [];
              cached = tv(ARRAY, a);
              cache.set(value, cached);
              for (let i = 0, length = ($ as unknown[]).length; i < length; i++)
                a[i] = toValue(($ as unknown[])[i], cache);
              return cached;
            }
            if (
              !isView($) &&
              !($ instanceof ArrayBuffer) &&
              toName($) === "Object"
            ) {
              const o: Record<PropertyKey, unknown> = {};
              cached = tv(OBJECT, o);
              cache.set(value, cached);
              for (const k in $ as object)
                o[k] = toValue(($ as Record<string, unknown>)[k], cache);
              return cached;
            }
          }
          cached = tv(DIRECT, $);
          cache.set(value, cached);
        }
        return cached;
      }
      case "function": {
        if (reflected in (value as object)) return reference;
        let cached = cache.get(value);
        if (!cached) {
          const $ = transform(value);
          cached = tv(FUNCTION, id($));
          cache.set(value, cached);
        }
        return cached;
      }
      case "symbol":
        return tv(SYMBOL, toSymbol(value));
    }
    return value;
  };

  // toValue를 배열 전체에 적용하는 버전.
  const toValues = loopValues(
    toValue as (value: unknown, cache?: Map<unknown, unknown>) => unknown,
  );

  // local 쪽 참조(uid=v)마다 Proxy를 하나만 만들어 WeakRef로 캐싱한다.
  // 함수 계열(REMOTE_FUNCTION)은 FunctionHandler, 그 외는 Handler를 쓴다.
  const asProxy = (t: number, v: unknown): object => {
    let wr = weakRefs.get(v);
    let proxy = wr?.deref();
    if (!proxy) {
      /* c8 ignore start */
      if (wr) fr.unregister(wr);
      /* c8 ignore stop */
      if (t === REMOTE_FUNCTION)
        proxy = new Proxy(
          callback,
          new FunctionHandler(t, v) as ProxyHandler<typeof callback>,
        );
      else
        proxy = new Proxy(
          t === REMOTE_OBJECT ? object : array,
          new Handler(t, v) as ProxyHandler<typeof object>,
        );
      wr = new WeakRef(proxy);
      weakRefs.set(v, wr);
      fr.register(proxy, v, wr);
    }
    return proxy;
  };

  // 주어진 값이 이 remote가 만든(local 쪽 참조를 감싼) 프록시인지 확인한다.
  const isProxy = (value: unknown): boolean => {
    switch (typeof value) {
      case "object":
        if (value === null) break;
      case "function":
        return reflected in (value as object);
    }
    return false;
  };

  const memoize = -1 < timeout;
  // 캐싱을 켜면 timeout짜리 Memo 클래스를, 끄면 그냥 Map을 캐시로 쓴다
  // (Map은 만료가 없으므로 캐싱하지 않는 것과 같아진다).
  const Memo = (memoize ? memo(timeout) : Map) as unknown as MemoCtor;

  // local 쪽 일반 객체/배열/전역을 감싸는 Proxy handler. get/ownKeys/
  // getPrototypeOf 결과는 memoize가 켜져 있으면 Memo로 짧게 캐싱한다.
  class Handler implements ProxyHandler<object> {
    t: number;
    v: unknown;
    $?: MemoInstance;

    constructor(t: number, v: unknown) {
      this.t = t;
      this.v = v;
      if (memoize) this.$ = new Memo();
    }

    get(_: object, key: PropertyKey): unknown {
      const k = key as string | symbol;
      // local의 GET은 자신의 timeout과 무관하게 항상 [shouldCache, wireValue]를
      // 돌려준다(ADR-0007) — 여기서도 memoize 여부와 무관하게 항상 destructure한다.
      // reflect 호출 자체는 compute 안에 남겨, memoize가 켜져 있고 캐시 hit이면
      // 아예 호출되지 않게(lazy) 유지한다.
      const compute = (): [boolean, unknown] => {
        const [cache, value] = reflect(GET, this.v, toKey(k)) as [
          boolean,
          unknown,
        ];
        return [cache, fromValue(value)];
      };
      return memoize ? this.$!.readOr(k, compute) : compute()[1];
    }

    set(_: object, key: PropertyKey, value: unknown): boolean {
      const result = reflect(
        SET,
        this.v,
        toKey(key as string | symbol),
        toValue(value),
      );
      return (
        memoize ? this.$!.drop(key as string | symbol, result) : result
      ) as boolean;
    }

    // TODO: `in` 연산도 캐싱해야 하는가?
    has(_: object, prop: PropertyKey): boolean {
      if (prop === reflected) {
        reference = [this.t, this.v];
        return true;
      }
      return reflect(HAS, this.v, toKey(prop as string | symbol)) as boolean;
    }

    protected _oK(): (string | symbol)[] {
      return fromKeys(reflect(OWN_KEYS, this.v) as TypeValue[], weakRefs) as (
        string | symbol
      )[];
    }
    ownKeys(_: object): (string | symbol)[] {
      return memoize
        ? this.$!.readOr(Memo.keys, () => [true, this._oK()])
        : this._oK();
    }

    // 캐싱하려면 키마다 별도 캐시가 필요해 Cache 코드가 복잡해지는 데 비해
    // 얻는 이득은 적을 것으로 보여 캐싱하지 않는다.
    getOwnPropertyDescriptor(
      _: object,
      key: PropertyKey,
    ): PropertyDescriptor | undefined {
      const descriptor = fromValue(
        reflect(
          GET_OWN_PROPERTY_DESCRIPTOR,
          this.v,
          toKey(key as string | symbol),
        ),
      ) as PropertyDescriptor | undefined;
      if (descriptor) {
        for (const k in descriptor)
          (descriptor as unknown as Record<string, unknown>)[k] = fromValue(
            (descriptor as unknown as Record<string, unknown>)[k],
          );
      }
      return descriptor;
    }

    defineProperty(
      _: object,
      key: PropertyKey,
      descriptor: PropertyDescriptor,
    ): boolean {
      const result = reflect(
        DEFINE_PROPERTY,
        this.v,
        toKey(key as string | symbol),
        toValue(descriptor),
      );
      return (
        memoize ? this.$!.drop(key as string | symbol, result) : result
      ) as boolean;
    }

    deleteProperty(_: object, key: PropertyKey): boolean {
      const result = reflect(
        DELETE_PROPERTY,
        this.v,
        toKey(key as string | symbol),
      );
      return (
        memoize ? this.$!.drop(key as string | symbol, result) : result
      ) as boolean;
    }

    protected _gPO(): object | null {
      return fromValue(reflect(GET_PROTOTYPE_OF, this.v)) as object | null;
    }
    /* c8 ignore start */
    getPrototypeOf(_: object): object | null {
      return memoize
        ? this.$!.readOr(Memo.proto, () => [true, this._gPO()])
        : this._gPO();
    }
    /* c8 ignore stop */

    setPrototypeOf(_: object, value: object | null): boolean {
      const result = reflect(SET_PROTOTYPE_OF, this.v, toValue(value));
      return (memoize ? this.$!.drop(Memo.proto, result) : result) as boolean;
    }
    // 다른 트랩들보다 훨씬 드물게 쓰이므로 캐싱하지 않는다.
    isExtensible(_: object): boolean {
      return reflect(IS_EXTENSIBLE, this.v) as boolean;
    }

    // ⚠️ 프록시들이 target을 공유하기 때문에 이 트랩은 원격에 그대로 반영할 수 없다.
    preventExtensions(_: object): boolean {
      return false;
    }
  }

  // local 쪽 함수를 감싸는 Proxy handler. construct/apply를 추가로 지원한다.
  class FunctionHandler extends Handler {
    construct(_: object, args: unknown[]): object {
      return fromValue(reflect(CONSTRUCT, this.v, toValues(args))) as object;
    }

    apply(_: object, self: unknown, args: unknown[]): unknown {
      const map = new Map<unknown, TypeValue>();
      return fromValue(
        reflect(APPLY, this.v, toValue(self, map), toValues(args, map)),
      );
    }

    override get(_: object, key: PropertyKey): unknown {
      switch (key) {
        // apply/call은 뻔한 왕복(reflect 호출)을 건너뛰고 바로 처리한다.
        case "apply":
          return (self: unknown, args: unknown[]) => this.apply(_, self, args);
        case "call":
          return (self: unknown, ...args: unknown[]) =>
            this.apply(_, self, args);
        default:
          return super.get(_, key);
      }
    }
  }

  // `direct()`가 처음 호출될 때만 WeakSet을 만든다(`indirect`가 true인 동안은
  // 아무 값도 direct 등록이 안 된 것과 같다).
  let indirect = true;
  let direct: WeakSet<WeakKey>;
  // `reflected in proxy`로 조회하면 Handler#has가 부수효과로 그 프록시의
  // [type, uid]를 여기 담아둔다(별도 트랩 없이 has를 통해 내부 상태를 꺼내는
  // 방법). toValue/isProxy와 assign/gather/query가 곧바로 이어서 읽어 쓴다.
  let reference: TypeValue | undefined;

  const { apply } = Reflect;
  // remote가 local에 노출한 콜백/참조와 uid를 양방향으로 보관하는 heap.
  const { id, ref, unref } = heap();
  // Handler/FunctionHandler 프록시를 uid별로 캐싱해 재사용한다.
  const weakRefs = new Map<unknown, WeakRef<object>>();
  // 이 remote가 만든 프록시인지 표시하는 비공개 심볼(isProxy/has 트랩에서 사용).
  const reflected = Symbol("reflected-ffi");
  const globalTarget = tv(OBJECT, null);
  const global: unknown = new Proxy(
    object,
    new Handler(OBJECT, null) as ProxyHandler<typeof object>,
  );
  // 프록시가 GC되면 더는 쓰이지 않는다는 뜻이므로 local 쪽에 UNREF를 보내 정리한다.
  const fr = new FinalizationRegistry<unknown>((v) => {
    weakRefs.delete(v);
    reflect(UNREF, v);
  });

  return {
    // 로컬 전역(globalThis)을 가리키는 프록시.
    global,

    isProxy,

    // target이 프록시면 로컬 쪽에도 ASSIGN을 반영하고, 아니면 보통의 Object.assign처럼 동작한다.
    assign<T extends object>(target: T, ...sources: object[]): T {
      const asProxy = isProxy(target);
      const assignment = assign(asProxy ? {} : target, ...sources);
      if (asProxy) reflect(ASSIGN, reference![1], toValue(assignment));
      return target;
    },

    // 값을 (heap을 거쳐 프록시로 감싸지 않고) local 쪽에 그대로 넘길 수 있게 등록한다.
    direct<T extends WeakKey>(value: T): T {
      if (indirect) {
        indirect = false;
        direct = new WeakSet();
      }
      direct.add(value);
      return value;
    },

    // 주어진 콜백을 로컬 쪽에서 주어진 인자로 실행하고 결과를 돌려받는다.
    evaluate: (callback: Function, ...args: unknown[]): unknown =>
      fromValue(
        reflect(EVALUATE, null, toJSONCallback(callback), toValues(args)),
      ),

    // target이 프록시면 GATHER로 로컬에서 한 번에 조회하고, 아니면
    // utils/gather.ts로 로컬 값에서 직접 조회한다(문자열 키는 query() 경로
    // 해석, symbol 키는 bracket — .query()와 같은 규칙).
    gather(target: unknown, ...keys: (string | symbol)[]): unknown[] {
      if (!isProxy(target)) return gather(target, ...keys);
      const resolvedKeys = reflect(GATHER, reference![1], toKeys(keys, weakRefs)) as (
        string | symbol
      )[];
      const result: unknown[] = resolvedKeys.slice();
      for (let i = 0; i < result.length; i++)
        result[i] = fromValue(result[i]);
      return result;
    },

    // target이 프록시면 QUERY로 로컬에서 경로를 조회하고, 아니면 로컬 값에서 직접 조회한다.
    query: (target: unknown, path: string): unknown =>
      isProxy(target)
        ? fromValue(reflect(QUERY, reference![1], path))
        : query(target, path),

    // local()이 걸어오는 호출을 처리하는 콜백. 현재 APPLY와 UNREF만 지원한다.
    reflect: async (
      method: number,
      uid: unknown,
      ...args: unknown[]
    ): Promise<unknown> => {
      switch (method) {
        // heap에 등록해둔 uid의 콜백을 찾아 실제로 호출한다.
        case APPLY: {
          const [context, params] = args as [unknown, unknown[]];
          for (let i = 0, length = params.length; i < length; i++)
            params[i] = fromValue(params[i]);
          return toValue(
            await apply(
              ref(uid as number) as (...a: unknown[]) => unknown,
              fromValue(context),
              params,
            ),
          );
        }
        // local이 더 이상 쓰지 않는 콜백을 해제한다.
        case UNREF: {
          released(ref(uid as number));
          return unref(uid as number);
        }
      }
    },
  };
};
