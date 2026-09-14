import * as DocumentPicker from 'expo-document-picker';
import { ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES, ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES } from './absence-justification-api';

// RULE-JUST-11: the attachment is always PDF/JPEG/PNG — expo-image-picker alone cannot cover
// this (it only ever returns images), so expo-document-picker is the pick that lets a single
// picker cover both "atestado em PDF" and "foto do atestado" in one flow, matching the web
// dashboard's single <input type="file" accept="...">. New dependency, flagged in the Mobile
// Implementation Summary for retroactive ratification, same posture already used in this project
// for other obvious implementation-technical needs.
export interface AttachmentAsset {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export type AttachmentPickOutcome =
  | { kind: 'picked'; asset: AttachmentAsset }
  | { kind: 'canceled' }
  | { kind: 'unsupported-type' }
  | { kind: 'too-large' };

// Pure and separately unit-tested from the system-UI call below — mirrors the web dashboard's
// handleFileChange validation, which is UX-only (fail fast before a wasted multipart upload):
// the backend re-validates by magic-bytes regardless (RULE-JUST-11), this is never the last line
// of defense.
export function validatePickedAsset(asset: { mimeType?: string; size?: number }): 'unsupported-type' | 'too-large' | null {
  const allowedMimeTypes: readonly string[] = ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES;
  if (!asset.mimeType || !allowedMimeTypes.includes(asset.mimeType)) {
    return 'unsupported-type';
  }
  if (typeof asset.size === 'number' && asset.size > ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES) {
    return 'too-large';
  }
  return null;
}

export async function pickAttachment(): Promise<AttachmentPickOutcome> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { kind: 'canceled' };
  }

  const asset = result.assets[0];
  const validationError = validatePickedAsset(asset);
  if (validationError === 'unsupported-type') {
    return { kind: 'unsupported-type' };
  }
  if (validationError === 'too-large') {
    return { kind: 'too-large' };
  }

  // Safe: validatePickedAsset already rejected a missing/unsupported mimeType above.
  return { kind: 'picked', asset: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType as string, size: asset.size ?? 0 } };
}
