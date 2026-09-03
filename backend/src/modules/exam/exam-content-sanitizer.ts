// Security control 7: stored-XSS defence for the free-text content of an
// exam (question prompts, option labels, written answers). It matters here
// specifically because the teacher's JWT lives in sessionStorage (see
// "Decisão de tecnologia — Frontend Web"), so a script stored in an answer
// and rendered on a grading screen would be reading that token.
//
// Deliberately NOT a new sanitizer dependency: the approved technology
// decision for this feature introduces no new library, and exam content is
// plain text — there is no rich-text feature to preserve, so no HTML has to
// survive.
//
// Strategy: strip anything that could open an element, keep everything else
// byte-for-byte. Escaping (&lt;) was rejected because the frontend renders
// this content as text, where an escaped entity would show up literally to
// the student as "5 &lt; 7".

// Matches an opening/closing tag, or a comment/doctype/processing block —
// i.e. a "<" immediately followed by something that can actually start
// markup. A bare "<" used as a mathematical operator ("5 < 7") is
// intentionally left alone: it cannot start an element, and mangling it
// would corrupt legitimate exam content. The trailing ">?" also catches an
// unterminated tag at the end of the input, which browsers happily complete
// on their own.
const MARKUP_PATTERN = /<!--[\s\S]*?(?:-->|$)|<[/!?]?[a-zA-Z][^>]*>?/g;

// Written as a code-point test instead of a regex literal: a control-char
// regex needs those characters spelled out in the source, which is exactly
// the kind of invisible content this function exists to remove.
function stripControlChars(value: string): string {
  let stripped = '';
  for (const char of value) {
    const code = char.codePointAt(0) as number;
    const isControl = code < 0x20 || (code >= 0x7f && code <= 0x9f);
    const isTextWhitespace = char === '\t' || char === '\n' || char === '\r';
    if (!isControl || isTextWhitespace) {
      stripped += char;
    }
  }
  return stripped;
}

export function sanitizeExamText(value: string): string {
  return stripControlChars(value.replace(MARKUP_PATTERN, '')).trim();
}

// Optional free-text fields (exam description, written answer): a blank
// value stays null instead of becoming an empty string, so "not answered"
// and "answered with nothing" do not become two different representations
// of the same thing in the database.
export function sanitizeOptionalExamText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const sanitized = sanitizeExamText(value);
  return sanitized.length > 0 ? sanitized : null;
}
