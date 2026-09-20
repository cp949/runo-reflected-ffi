// main↔worker 동기 채널이 공유하는 SharedArrayBuffer는 앞 8바이트(Int32Array
// 2칸: ready 플래그, 인코딩된 결과의 길이)를 헤더로 쓴다. encoder/decoder는
// 이 오프셋 이후부터 실제 payload를 읽고 쓴다.
export const PAYLOAD_BYTE_OFFSET = 8;
