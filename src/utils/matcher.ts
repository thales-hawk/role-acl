function escapeStringRegexp(string) {
  if (typeof string !== "string") {
    throw new TypeError("Expected a string");
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

// Cache for regex patterns
const regexpCache = new Map<string, RegExp>();

// Type definition for options passed to makeRegexp
interface MakeRegexpOptions {
  caseSensitive?: boolean;
}

// Type definition for options passed to baseMatcher and matcher
interface BaseMatcherOptions {
  caseSensitive?: boolean;
  allPatterns?: boolean;
}

const sanitizeArray = (input: unknown, inputName: string): string[] => {
  if (!Array.isArray(input)) {
    switch (typeof input) {
      case "string":
        input = [input];
        break;
      case "undefined":
        input = [];
        break;
      default:
        throw new TypeError(
          `Expected '${inputName}' to be a string or an array, but got a type of '${typeof input}'`
        );
    }
  }

  return (input as string[]).filter((stringItem) => {
    if (typeof stringItem !== "string") {
      if (typeof stringItem === "undefined") {
        return false;
      }

      throw new TypeError(
        `Expected '${inputName}' to be an array of strings, but found a type of '${typeof stringItem}' in the array`
      );
    }

    return true;
  });
};

const makeRegexp = (pattern: string, options: MakeRegexpOptions): RegExp => {
  options = {
    caseSensitive: false,
    ...options,
  };

  const cacheKey = pattern + JSON.stringify(options);

  if (regexpCache.has(cacheKey)) {
    return regexpCache.get(cacheKey);
  }

  const negated = pattern.startsWith("!");

  if (negated) {
    pattern = pattern.slice(1);
  }

  pattern = escapeStringRegexp(pattern).replace(/\\\*/g, "[\\s\\S]*");

  const regexp = new RegExp(`^${pattern}$`, options.caseSensitive ? "" : "i");
  (regexp as any).negated = negated;
  regexpCache.set(cacheKey, regexp);

  return regexp;
};

const baseMatcher = (
  inputs: unknown[],
  patterns: string[],
  firstMatchOnly: boolean,
  options: BaseMatcherOptions = {}
): string[] => {
  inputs = sanitizeArray(inputs, "inputs");
  patterns = sanitizeArray(patterns, "patterns");

  if (patterns.length === 0) {
    return [];
  }

  // Map the patterns to RegExp objects
  const regExpPatterns: RegExp[] = patterns.map((pattern) =>
    makeRegexp(pattern, options)
  );

  const { allPatterns } = options;
  const result: string[] = [];

  // Use a boolean array to track whether the input matches the pattern
  const didFit: boolean[] = new Array(regExpPatterns.length).fill(false);

  for (const input of inputs) {
    let matches: boolean | undefined;

    for (const [index, pattern] of regExpPatterns.entries()) {
      // Test input against RegExp
      if (pattern.test(input as string)) {
        didFit[index] = true;
        matches = !(pattern as any).negated;

        if (!matches) {
          break;
        }
      }
    }

    if (
      !(
        matches === false ||
        (matches === undefined &&
          regExpPatterns.some((pattern) => !(pattern as any).negated)) ||
        (allPatterns &&
          didFit.some(
            (yes, index) => !yes && !(regExpPatterns[index] as any).negated
          ))
      )
    ) {
      result.push(input as string);

      if (firstMatchOnly) {
        break;
      }
    }
  }

  return result;
};

// Public matcher function
export function matcher(
  inputs: unknown[],
  patterns: string[],
  options: BaseMatcherOptions = {}
): string[] {
  return baseMatcher(inputs, patterns, false, options);
}
