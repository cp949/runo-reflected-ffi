// ImageData가 없는 런타임(Node/Vitest 등)을 위한 자리표시 클래스.
// 어떤 값도 이 클래스의 인스턴스가 될 수 없으므로 `instanceof ImageData`
// 검사가 그런 환경에서도 항상 안전하게 false를 반환한다.
class Never {}

// 브라우저에서는 네이티브 ImageData를 쓰고, 없는 환경에서는 Never로 대체한다.
export const ImageData =
  (globalThis as { ImageData?: typeof globalThis.ImageData }).ImageData ||
  (Never as unknown as typeof globalThis.ImageData);
