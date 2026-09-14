import { validatePickedAsset } from '../attachment-picker';

test('validatePickedAsset_withAllowedMimeTypeAndSizeUnderLimit_returnsNull', () => {
  expect(validatePickedAsset({ mimeType: 'application/pdf', size: 1024 })).toBeNull();
});

test('validatePickedAsset_withMissingMimeType_returnsUnsupportedType', () => {
  expect(validatePickedAsset({ size: 1024 })).toBe('unsupported-type');
});

test('validatePickedAsset_withDisallowedMimeType_returnsUnsupportedType', () => {
  expect(validatePickedAsset({ mimeType: 'text/html', size: 1024 })).toBe('unsupported-type');
});

test('validatePickedAsset_withSizeOverTenMegabytes_returnsTooLarge', () => {
  expect(validatePickedAsset({ mimeType: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe('too-large');
});

test('validatePickedAsset_withSizeExactlyAtLimit_returnsNull', () => {
  expect(validatePickedAsset({ mimeType: 'image/jpeg', size: 10 * 1024 * 1024 })).toBeNull();
});

test('validatePickedAsset_withUndefinedSize_skipsSizeCheck', () => {
  expect(validatePickedAsset({ mimeType: 'application/pdf' })).toBeNull();
});
