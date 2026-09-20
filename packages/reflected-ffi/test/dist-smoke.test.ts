import { describe, expect, it } from "vitest";

const ENTRIES = [
  "array",
  "buffer",
  "decoder",
  "direct/index",
  "encoder",
  "gather",
  "local",
  "query",
  "remote",
  "to-json-callback",
  "traps",
  "types",
  "utils/index",
  "utils/events",
  "utils/global",
  "utils/heap",
  "utils/symbol",
] as const;

describe("dist 빌드 산출물 스모크 테스트 (pnpm build 이후에만 통과)", () => {
  it.each(ENTRIES)("dist/%s.js를 에러 없이 import할 수 있다", async (entry) => {
    const mod: Record<string, unknown> = await import(
      /* @vite-ignore */ `../dist/${entry}.js`
    );
    expect(mod).toBeDefined();
  });

  it("array와 buffer 엔트리는 서로 다른 export를 가진다 (subpath별 파일이 실제로 분리됐는지 확인)", async () => {
    // @ts-expect-error dist/*.js는 flat 경로라 옆에 나란한 .d.ts가 없다 (실제 타입 선언은 dist/direct/*.d.ts에 중첩)
    const arrayMod = await import("../dist/array.js");
    // @ts-expect-error 위와 동일한 사유
    const bufferMod = await import("../dist/buffer.js");
    expect(typeof arrayMod.default).toBe("function"); // Stack
    expect(typeof bufferMod.Array).toBe("function");
    expect(typeof bufferMod.Buffer).toBe("function");
  });
});
