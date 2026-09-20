// `a['b']`, `a["b"]` 같은 대괄호 표기를 `.b` 형태의 점 표기로 바꾸기 위한 정규식.
const brackets = /\[('|")?(.+?)\1\]/g;

/** `target[key]`를 조회한다. `target`이 null/undefined면 `undefined`를 반환한다. */
const keys = (target: unknown, key: string): unknown =>
  (target as Record<string, unknown> | null | undefined)?.[key];

/**
 * `path`(예: `"a.b[0].c"`)를 점/대괄호 표기 조각으로 나눠 `target`부터
 * 차례로 조회한 값을 반환한다.
 */
export default (target: unknown, path: string): unknown =>
  path.replace(brackets, ".$2").split(".").reduce<unknown>(keys, target);
