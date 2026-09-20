type Resolve = (value: unknown) => void;
type Reject = (reason: unknown) => void;

/**
 * postMessage처럼 순서를 보장하지 않는 비동기 채널에서, 보낸 요청(id)마다
 * 그에 대응하는 응답이 왔을 때 완료할 Promise를 관리하는 유틸리티를 만든다.
 * @returns [next, settle] 튜플 — next()는 새 요청 id를 발급하고 그 결과를
 * 기다리는 Promise를 함께 반환하며, settle(id, ok, value)는 해당 id로 대기
 * 중인 Promise를 ok에 따라 resolve(true) 또는 reject(false)로 완료한다.
 */
export default function nextResolver(): [
  next: () => [id: number, promise: Promise<unknown>],
  settle: (id: number, ok: boolean, value: unknown) => void,
] {
  let uid = 0;
  // 아직 응답을 받지 못한 요청의 id -> [resolve, reject] 콜백 매핑.
  const pending = new Map<number, [Resolve, Reject]>();

  // 새 요청 id를 발급하고, 그 응답을 기다리는 Promise를 만들어 함께 반환한다.
  const next = (): [number, Promise<unknown>] => {
    const id = uid++;
    const promise = new Promise<unknown>((res, rej) =>
      pending.set(id, [res, rej]),
    );
    return [id, promise];
  };

  // id에 대응하는 pending Promise를 ok 여부에 따라 resolve/reject하고 매핑에서 지운다.
  const settle = (id: number, ok: boolean, value: unknown): void => {
    const entry = pending.get(id);
    entry?.[ok ? 0 : 1](value);
    pending.delete(id);
  };

  return [next, settle];
}
