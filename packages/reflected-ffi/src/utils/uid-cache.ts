// uid마다 wrapper(로컬 함수/원격 Proxy)를 하나만 만들어 WeakRef로 캐싱하고,
// wrapper가 GC되면 FinalizationRegistry로 상대에게 정리를 알리는 안무.
// local.ts(FUNCTION 분기)와 remote.ts(asProxy)가 감싸는 대상만 다를 뿐 이
// 규칙은 그대로 공유한다 — 여기서는 "언제 재사용/생성/등록 해제하는가"만
// 안다. weakRefs/fr은 호출부가 만들어 소유하고, 여기엔 참조로만 받는다.
export default function getOrBuild<T extends WeakKey>(
  weakRefs: Map<unknown, WeakRef<T>>,
  fr: FinalizationRegistry<unknown>,
  uid: unknown,
  build: () => T,
): T {
  let wr = weakRefs.get(uid);
  let value = wr?.deref();
  if (!value) {
    // wr은 있지만 deref가 undefined면 이미 GC됐으나 fr 콜백이 아직 안 돈
    // 상태다 — 결정적으로 재현하기 어려운 레이스라 커버리지에서 제외한다.
    /* c8 ignore start */
    if (wr) fr.unregister(wr);
    /* c8 ignore stop */
    value = build();
    wr = new WeakRef(value);
    weakRefs.set(uid, wr);
    fr.register(value, uid, wr);
  }
  return value;
}
