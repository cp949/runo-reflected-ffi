/** 참조(ref)와 uid를 양방향으로 매핑해 보관하는 heap. */
export type Heap<T> = {
  /** 보관 중인 모든 참조와 uid 매핑을 비운다. */
  clear: () => void;

  /** `ref`에 대응하는 uid를 반환한다. 등록된 적 없는 참조면 새 uid를 발급해 등록한다. */
  id: (ref: T) => number;

  /** `id`에 대응하는 참조를 반환한다. 등록돼 있지 않으면 `undefined`. */
  ref: (id: number) => T | undefined;

  /** `id`와 그에 대응하는 참조를 heap에서 제거한다. 실제로 제거했으면 `true`. */
  unref: (id: number) => boolean;
};

/**
 * int32 카운터 생성 (32bit 오버플로 시 wraparound).
 * 출처: @webreflection/utils/id (MIT, Andrea Giammarchi)
 * https://github.com/WebReflection/utils/blob/main/src/id.js
 */
const i32 = (start = 0) => {
  let id = start;
  return () => {
    const current = id;
    id = (id + 1) | 0;
    return current;
  };
};

/**
 * 참조를 메모리에 보관하는 `Heap`을 생성한다.
 * @param id 시작 uid(기본 0).
 * @param ids uid -> 참조 매핑. 기존 heap 상태를 이어받을 때 넘긴다.
 * @param refs 참조 -> uid 매핑. `ids`와 짝을 이뤄야 한다.
 */
export default (
  id = 0,
  ids: Map<number, unknown> = new Map(),
  refs: Map<unknown, number> = new Map(),
): Heap<unknown> => {
  const next = i32(id);
  return {
    clear: () => {
      ids.clear();
      refs.clear();
    },
    id: (ref) => {
      let uid = refs.get(ref);
      if (uid === void 0) {
        // 카운터가 wraparound돼 기존 uid와 충돌할 수 있으므로 빈 슬롯을 찾을 때까지 넘긴다.
        /* c8 ignore next */
        while (ids.has((uid = next())));
        ids.set(uid, ref);
        refs.set(ref, uid);
      }
      return uid;
    },
    ref: (id) => ids.get(id),
    unref: (id) => {
      refs.delete(ids.get(id));
      return ids.delete(id);
    },
  };
};
