// 심볼을 와이어로 보낼 문자열로 인코딩/디코딩한다. 접두사로 종류를 구분한다:
// `@name`  Symbol.iterator 같은 well-known 심볼
// `#desc`  Symbol.for(desc)로 등록된 전역 심볼
// `!desc`  설명이 있는 일반(로컬) 심볼
// `?`      설명이 없는 일반 심볼

// well-known 심볼 값 -> `@name` 문자열 매핑 (Symbol.iterator -> "@iterator" 등).
const symbols = new Map<symbol, string>(
  (Reflect.ownKeys(Symbol) as (keyof SymbolConstructor)[]).map((key) => [
    Symbol[key] as symbol,
    `@${String(key)}`,
  ]),
);

// well-known이 아닌 심볼을 설명 유무·전역 등록 여부에 따라 `#`/`!`/`?` 문자열로 인코딩한다.
const asSymbol = (value: symbol, description: string | undefined): string =>
  description === void 0
    ? "?"
    : Symbol.keyFor(value) === void 0
      ? `!${description}`
      : `#${description}`;

/** 와이어에서 받은 인코딩 문자열을 원래의 심볼로 되돌린다. */
export const fromSymbol = (name: string): symbol => {
  switch (name[0]) {
    case "@":
      return (Symbol as unknown as Record<string, symbol>)[name.slice(1)]!;
    case "#":
      return Symbol.for(name.slice(1));
    case "!":
      return Symbol(name.slice(1));
    default:
      return Symbol();
  }
};

/** 심볼을 와이어로 보낼 인코딩 문자열로 만든다. */
export const toSymbol = (value: symbol): string =>
  symbols.get(value) || asSymbol(value, value.description);
