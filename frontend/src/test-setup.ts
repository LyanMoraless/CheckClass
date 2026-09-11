import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's automatic post-test cleanup only self-registers
// when `afterEach` exists as a global (i.e. when `test.globals: true` is
// set). This project's specs import test functions explicitly from
// 'vitest' instead of relying on globals, so cleanup must be wired up
// here explicitly — otherwise each render() leaves its DOM tree mounted
// for the next test in the same file, causing "found multiple elements"
// failures.
afterEach(() => {
  cleanup();
});
