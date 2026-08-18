const LETTER = /\p{L}/u;

/** The token's first character, when it's a letter (so "(Developer)" and
 *  stray punctuation never become an initial). */
const leadingLetter = (token: string): string | null => {
  const ch = [...token][0];
  return ch && LETTER.test(ch) ? ch.toUpperCase() : null;
};

/**
 * Up to two initials from any combination of name parts — first + last.
 *
 * Robust to what parents actually type: leading/trailing spaces (" Ethan"),
 * double-barrelled names ("Muldoon-Kinglum" → M), middle names, and a single
 * full-name string. Returns "?" when there's no usable letter, so an avatar
 * circle is never blank.
 */
export const initialsOf = (...parts: (string | null | undefined)[]): string => {
  const letters = parts
    .flatMap((p) => (p ?? "").split(/\s+/))
    .map(leadingLetter)
    .filter((c): c is string => c !== null);

  if (letters.length === 0) return "?";
  if (letters.length === 1) return letters[0];
  return letters[0] + letters[letters.length - 1];
};
