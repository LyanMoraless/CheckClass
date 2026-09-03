import { sanitizeExamText, sanitizeOptionalExamText } from './exam-content-sanitizer';

const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

// Security control 7: exam content is free text written by one person and
// rendered to another, including on a screen whose JWT sits in
// sessionStorage.
describe('examContentSanitizer', () => {
  test('test_sanitizeExamText_scriptTag_removed', () => {
    expect(sanitizeExamText('Question <script>steal(document.cookie)</script> body')).toBe(
      'Question steal(document.cookie) body',
    );
  });

  test('test_sanitizeExamText_eventHandlerAttribute_removedWithTag', () => {
    expect(sanitizeExamText('<img src=x onerror="alert(1)">Describe the image')).toBe('Describe the image');
  });

  test('test_sanitizeExamText_unterminatedTag_removed', () => {
    expect(sanitizeExamText('trailing <iframe src="evil')).toBe('trailing');
  });

  test('test_sanitizeExamText_htmlComment_removed', () => {
    expect(sanitizeExamText('before <!-- hidden --> after')).toBe('before  after');
  });

  // The reason this sanitizer strips markup instead of escaping everything:
  // a mathematical "<" is legitimate exam content and must survive intact.
  test('test_sanitizeExamText_mathematicalLessThan_preserved', () => {
    expect(sanitizeExamText('For which x is 5 < 7 and 7 > 5 true?')).toBe('For which x is 5 < 7 and 7 > 5 true?');
  });

  test('test_sanitizeExamText_accentedContent_preserved', () => {
    expect(sanitizeExamText('Explique a função da fotossíntese.')).toBe('Explique a função da fotossíntese.');
  });

  // Line breaks are legitimate content in a paragraph question; an embedded
  // NUL is not.
  test('test_sanitizeExamText_lineBreaksKept_controlCharsDropped', () => {
    expect(sanitizeExamText(`first line${LF}second${NUL} line`)).toBe(`first line${LF}second line`);
  });

  test('test_sanitizeOptionalExamText_null_staysNull', () => {
    expect(sanitizeOptionalExamText(null)).toBeNull();
  });

  // "Answered with nothing" and "not answered" must not become two different
  // representations of the same state.
  test('test_sanitizeOptionalExamText_blankAfterStripping_becomesNull', () => {
    expect(sanitizeOptionalExamText('   <br>  ')).toBeNull();
  });

  test('test_sanitizeOptionalExamText_realContent_trimmed', () => {
    expect(sanitizeOptionalExamText('  my answer  ')).toBe('my answer');
  });
});
