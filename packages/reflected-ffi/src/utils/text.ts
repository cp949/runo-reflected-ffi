// 여러 모듈이 재사용하는 공유 TextDecoder/TextEncoder 싱글턴.
export const decoder = new TextDecoder();

export const encoder = new TextEncoder();
