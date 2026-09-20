// number/size/deflate, inflate 등이 공유하는 8바이트 스크래치 버퍼.
// DataView(dv)와 Uint8Array(u8a8)가 같은 메모리를 가리켜서, 멀티바이트 값을
// 바이트 단위로 옮기는 쪽과 DataView로 해석하는 쪽을 오갈 수 있다. 동기 실행
// 구조를 전제하므로, 완전히 처리하기 전에 재진입하면 값이 덮어써진다.
const buffer = new ArrayBuffer(8);
export const dv = new DataView(buffer);
export const u8a8 = new Uint8Array(buffer);
