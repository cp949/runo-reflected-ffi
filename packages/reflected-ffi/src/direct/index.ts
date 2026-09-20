// direct 코덱의 공개 진입점 — decoder/encoder 모듈을 그대로 재노출한다.
import { decode, decoder } from "./decoder";
import { encode, encoder } from "./encoder";

export { decode, decoder, encode, encoder };
