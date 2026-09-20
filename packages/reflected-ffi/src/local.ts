// local()의 구현. 로컬 객체를 감싸 원격에서 오는 trap 호출(GET/SET/APPLY 등)을
// 수신·처리하는 리시버를 만든다.

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
  OBJECT,
  ARRAY,
  FUNCTION,
  REMOTE,
  SYMBOL,
  BIGINT,
  VIEW,
  BUFFER,
  REMOTE_ARRAY,
  REMOTE_OBJECT,
  REMOTE_FUNCTION,
} from "./types";

import { ImageData } from "./direct/web";
import { fromSymbol, toSymbol } from "./utils/symbol";
import { toBuffer, toView } from "./utils/typed";
import {
  assign,
  isArray,
  isView,
  fromKey,
  toKey,
  identity,
  loopValues,
  object,
  tv,
} from "./utils/index";
import type { TypeValue } from "./utils/index";

import gather from "./utils/gather";
import query from "./utils/query";
import heap from "./utils/heap";
import getOrBuild from "./utils/uid-cache";

// DOM이 없는 환경(Node.js 등)에서도 `instanceof Node` 검사가 안전하게
// 동작하도록, 없으면 아무것도 매칭되지 않는 더미 클래스를 대신 쓴다.
const Node =
  (globalThis as { Node?: typeof globalThis.Node }).Node || class Node {};

const {
  apply,
  construct,
  defineProperty,
  deleteProperty,
  get,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  has,
  isExtensible,
  ownKeys,
  set,
  setPrototypeOf,
} = Reflect;

// 배열의 `length`나 숫자 인덱스 키(캐싱하면 안 되는 값들)를 가려내기 위한 정규식.
const arrayKey = /^(?:[0-9]+|length)$/;

/** `target`의 `key`에 대한 GET 결과를 remote 쪽이 캐싱해도 안전한지 판단한다. */
const shouldCache = (
  target: Record<PropertyKey, unknown>,
  key: string | symbol,
  asModule: boolean,
): boolean => {
  if (asModule) return true;
  // DOM 관련 값(전부 접근자 프로퍼티)과 배열의 length/인덱스 접근자는 캐싱하지 않는다.
  if (
    target instanceof Node ||
    (isArray(target) && typeof key === "string" && arrayKey.test(key))
  )
    return false;
  // 알 수 없는 프로퍼티는 캐싱하되, 접근자(getter/setter)는 캐싱하지 않는다.
  if (key in target) {
    let t: object = target;
    let d: PropertyDescriptor | undefined;
    while (!(d = getOwnPropertyDescriptor(t, key))) {
      t = getPrototypeOf(t) as object;
      /* c8 ignore start */
      // "알 수 없는" 값에 대비한 비상 탈출 조건.
      if (!t) break;
      /* c8 ignore stop */
    }
    return !!d && "value" in d;
  }
  // 존재하지 않는 프로퍼티 접근은 딱히 의미 없이 반복될 수 있고, 실제로 값이
  // set되면 캐시가 제거되니 캐싱해도 무방하다.
  return true;
};

export type LocalOptions = {
  /** 원격 리시버를 거쳐 연산을 전달하는 함수 */
  reflect?: (
    method: number,
    uid: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;

  /** 로컬 값을 원격이 이해할 수 있는 더 단순한 참조로 바꾸는 함수 */
  transform?: (value: unknown) => unknown;

  /** 원격의 호출을 실행되기 *직전에* 가로채는 함수 */
  remote?: (...args: unknown[]) => unknown;

  /** 원격이 `import(...)`를 요청할 때 모듈을 가져오는 함수 */
  module?: (name: string) => Promise<unknown>;

  /** true면 JSON 호환을 깨더라도 버퍼를 직접(direct) 직렬화하도록 허용 */
  buffer?: boolean;
};

/**
 * 로컬 reflection 엔드포인트 하나를 만든다 — 신뢰할 수 없는 원격 peer 하나당
 * 한 번씩 호출하고, 이 인스턴스의 `reflect`를 두 개 이상의 peer가 공유하게
 * 하지 않는다. 반환된 `reflect`는 전달받은 `uid`를 누구에게 공개됐었는지
 * 검증하지 않고 그대로 신뢰하며, uid는 0부터 증가하는 단순 카운터라서, 이
 * 인스턴스를 두 peer가 공유하면 한쪽 peer가 다른 peer에게만 준 uid를 추측해
 * 재사용할 수 있다(ADR-0005).
 *
 * `reflect` 자체에는 인가 레이어가 없다 — 원격이 준 소스를 실행하는 EVALUATE를
 * 포함해 모든 trap이 항상 허용된다. 실제 신뢰 경계 너머로 이 함수를 노출한다면
 * 이 `reflect`를 호출하기 *전에* 자신의 전송/브리지 코드에서 `method`/`uid`를
 * 걸러야 한다 — 어차피 와이어에서 이 값들을 파싱해야 하고, 이를 위해 method
 * 상수(`GET`, `EVALUATE` 등)를 `./utils/traps`에서 export하고 있다(ADR-0004).
 */
export default (
  {
    reflect = identity as unknown as (
      method: number,
      uid: unknown,
      ...args: unknown[]
    ) => Promise<unknown>,
    transform = identity,
    remote = identity,
    module = (name: string) => import(/* @vite-ignore */ name),
    buffer = false,
  }: LocalOptions = object as LocalOptions,
) => {
  // 와이어에서 받은 TypeValue를 로컬에서 쓸 수 있는 실제 값으로 되돌린다.
  // REMOTE 계열 태그는 heap에서 uid로 참조를 꺼내오는 식으로 처리한다.
  const fromValue = (
    value: unknown,
    cache: Map<unknown, unknown> = new Map(),
  ): unknown => {
    if (!isArray(value)) return value;
    const [t, v] = value as TypeValue;
    switch (t) {
      case OBJECT: {
        if (v === null) return globalThis;
        // 순환 참조 대비: 이미 변환 중인 객체면 그 자리에서 재사용한다.
        let cached = cache.get(value);
        if (!cached) {
          cached = v;
          cache.set(value, v);
          for (const k in v as object)
            (v as Record<string, unknown>)[k] = fromValue(
              (v as Record<string, unknown>)[k],
              cache,
            );
        }
        return cached;
      }
      case ARRAY: {
        return (
          cache.get(value) ||
          (cache.set(value, v), fromValues(v as unknown[], cache))
        );
      }
      case FUNCTION: {
        // 원격 함수(uid=v)마다 로컬 프록시 함수를 하나만 만들어 WeakRef로
        // 캐싱한다. 프록시가 GC되면 FinalizationRegistry(fr)가 원격에 UNREF를
        // 보내 정리한다 — 안무 자체는 utils/uid-cache.ts가 갖고 있다.
        return getOrBuild(weakRefs, fr, v, function build() {
          return function (
            this: unknown,
            ...args: unknown[]
          ): Promise<unknown> {
            remote.apply(this, args);

            // 비동기로 reflect되는 값은 문자열화해서 넘기지 않는다 — 이 경로에
            // Atomics/SharedArrayBuffer를 쓸 이유가 없기 때문이다. 다만 이
            // 로컬 쪽의 현재 상태는 그대로 반영해야 한다.
            for (let i = 0, length = args.length; i < length; i++)
              args[i] = toValue(args[i]);

            const result = reflect(APPLY, v, toValue(this), args);
            return result.then(fromValue);
          };
        });
      }
      case SYMBOL:
        return fromSymbol(v as string);
      default:
        return (t as number) & REMOTE ? ref(v as number) : v;
    }
  };

  // 로컬 값을 와이어로 보낼 TypeValue로 변환한다. `direct()`로 등록됐거나
  // ImageData인 값, 버퍼/뷰는 각자의 태그로, 그 외 객체/함수는 heap에 등록해
  // uid로 참조하는 REMOTE 계열 태그로 감싼다.
  const toValue = (value: unknown): unknown => {
    switch (typeof value) {
      case "object": {
        if (value === null) break;
        if (value === globalThis) return globalTarget;
        const $ = transform(value);
        return (hasDirect && direct.has($ as WeakKey)) || $ instanceof ImageData
          ? tv(DIRECT, $)
          : isView($)
            ? tv(VIEW, toView($ as ArrayBufferView, buffer))
            : $ instanceof ArrayBuffer
              ? tv(BUFFER, toBuffer($ as ArrayBufferLike, buffer))
              : tv(isArray($) ? REMOTE_ARRAY : REMOTE_OBJECT, id($));
      }
      case "function":
        return tv(REMOTE_FUNCTION, id(transform(value)));
      case "symbol":
        return tv(SYMBOL, toSymbol(value));
      case "bigint":
        return tv(BIGINT, value.toString());
    }
    return value;
  };

  // fromValue/fromKey/toKey를 배열 전체에 적용하는 버전.
  const fromValues = loopValues(fromValue);
  const fromKeys = loopValues(fromKey);
  const toKeys = loopValues(toKey);

  // 원격에 노출한 로컬 참조(객체/함수)와 uid를 양방향으로 보관하는 heap.
  const { clear, id, ref, unref } = heap();

  // FUNCTION 케이스에서 uid별로 만든 로컬 프록시 함수를 보관하는 캐시.
  const weakRefs = new Map<unknown, WeakRef<object>>();
  const globalTarget = tv(OBJECT, null);
  // 프록시 함수가 GC되면 더는 쓰이지 않는다는 뜻이므로 원격에 UNREF를 보내 정리한다.
  const fr = new FinalizationRegistry<unknown>((v) => {
    weakRefs.delete(v);
    reflect(UNREF, v);
  });

  // `direct()`가 처음 호출될 때만 WeakSet을 만든다(한 번도 안 쓰면 생성 비용을 아낀다).
  let hasDirect = false;
  let direct!: WeakSet<WeakKey>;

  return {
    assign,
    gather,
    query,

    // 로컬 참조를 (heap을 거치지 않고) 원격 리시버에 직접 넘길 수 있게 등록한다.
    direct<T extends WeakKey>(value: T): T {
      if (!hasDirect) {
        hasDirect = true;
        direct = new WeakSet();
      }
      direct.add(value);
      return value;
    },

    // 주어진 콜백을 주어진 인자로 호출해주는, 이식성 있는 API.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 임의의 콜백을 받아 그대로 apply한다.
    evaluate: (callback: Function, ...args: unknown[]): unknown =>
      apply(callback, null, args),

    // 원격에서 온 모든 호출을 로컬에서 실제로 처리하는 콜백.
    reflect(method: number, uid: unknown, ...args: unknown[]): unknown {
      const isGlobal = uid === null;
      const target = (isGlobal ? globalThis : ref(uid as number)) as Record<
        PropertyKey,
        unknown
      >;
      // 가장 흔히 쓰이는 경우부터 순서대로 배치했다.
      switch (method) {
        case GET: {
          const key = fromKey(args[0] as TypeValue);
          // 전역 대상에서 "import"를 조회하면 실제 프로퍼티 대신 module() 콜백을 넘긴다.
          const asModule = isGlobal && key === "import";
          const value = asModule ? module : get(target, key);
          // remote가 이 값을 캐싱해도 되는지는 remote의 timeout 설정과 무관하게
          // 항상 계산해서 함께 보낸다 — GET 응답 모양이 local 쪽 설정에 좌우되면
          // peer 간 설정이 어긋날 때 wire가 깨진다(ADR-0007).
          return [shouldCache(target, key, asModule), toValue(value)];
        }
        case APPLY: {
          const map = new Map();
          return toValue(
            apply(
              target as unknown as (...a: unknown[]) => unknown,
              fromValue(args[0], map),
              fromValues(args[1] as unknown[], map) as unknown[],
            ),
          );
        }
        case SET:
          return set(target, fromKey(args[0] as TypeValue), fromValue(args[1]));
        case HAS:
          return has(target, fromKey(args[0] as TypeValue));
        case OWN_KEYS:
          return toKeys(ownKeys(target), weakRefs);
        case CONSTRUCT:
          return toValue(
            construct(
              target as unknown as new (...a: unknown[]) => unknown,
              fromValues(args[0] as unknown[]),
            ),
          );
        case GET_OWN_PROPERTY_DESCRIPTOR: {
          const descriptor = getOwnPropertyDescriptor(
            target,
            fromKey(args[0] as TypeValue),
          );
          if (descriptor) {
            for (const k in descriptor)
              (descriptor as Record<string, unknown>)[k] = toValue(
                (descriptor as Record<string, unknown>)[k],
              );
          }
          return descriptor;
        }
        case DEFINE_PROPERTY:
          return defineProperty(
            target,
            fromKey(args[0] as TypeValue),
            fromValue(args[1]) as PropertyDescriptor,
          );
        case DELETE_PROPERTY:
          return deleteProperty(target, fromKey(args[0] as TypeValue));
        case GET_PROTOTYPE_OF:
          return toValue(getPrototypeOf(target));
        case SET_PROTOTYPE_OF:
          return setPrototypeOf(target, fromValue(args[0]) as object | null);
        case ASSIGN: {
          assign(target, fromValue(args[0]) as object);
          return;
        }
        // 원격이 준 소스를 아무 제약 없이 실행한다 — 신뢰할 수 없는 peer라면
        // 브리지 레이어에서 걸러야 한다는 내용은 위 default export의 설명 참고.
        case EVALUATE: {
          const body = fromValue(args[0]);
          const fn = Function(`return(${body}).apply(null,arguments)`);
          return toValue(apply(fn, null, fromValues(args[1] as unknown[])));
        }
        // 여러 키(경로 포함 가능)를 한 번에 조회해 결과 배열로 돌려준다.
        // 키 해석 규칙(문자열→query, symbol→bracket)은 utils/gather.ts가 갖고
        // 있다 — 여기서는 wire 변환(fromKeys/toValue)만 감싼다.
        case GATHER: {
          const keys = fromKeys(args[0] as TypeValue[], weakRefs);
          return gather(target, ...keys).map(toValue);
        }
        case QUERY:
          return toValue(query(target, args[0] as string));
        case UNREF:
          return unref(uid as number);
        case IS_EXTENSIBLE:
          return isExtensible(target);
      }
    },

    // 통신의 로컬 쪽을 종료한다.
    terminate(): void {
      for (const wr of weakRefs.values()) fr.unregister(wr);
      weakRefs.clear();
      clear();
    },
  };
};
