const TOKEN_REGEX = /{{\s*(location|service|keyword)\s*}}/gi;

type TokenMap = {
  location: string;
  service: string;
  keyword: string;
};

export function replaceCopyTokens(value: string, tokens: TokenMap) {
  return value.replace(TOKEN_REGEX, (_, token: keyof TokenMap) => tokens[token] ?? "");
}

export function applyTokenReplacement<T>(input: T, tokens: TokenMap): T {
  if (typeof input === "string") {
    return replaceCopyTokens(input, tokens) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => applyTokenReplacement(item, tokens)) as T;
  }

  if (input && typeof input === "object") {
    const replacedEntries = Object.entries(input).map(([key, value]) => [
      key,
      applyTokenReplacement(value, tokens),
    ]);
    return Object.fromEntries(replacedEntries) as T;
  }

  return input;
}
