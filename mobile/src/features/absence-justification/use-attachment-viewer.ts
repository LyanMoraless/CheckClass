import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../lib/api-client';
import { deleteDownloadedAttachment, downloadAbsenceJustificationAttachment, type DownloadedAttachment } from './absence-justification-api';

// RULE-JUST-11 lifecycle: download the attachment into FileSystem.cacheDirectory, hand it to the
// OS share sheet so the caller can view it in a native PDF/image viewer, then delete the local
// copy — either once sharing/viewing finishes OR when the calling screen unmounts, whichever
// comes first. There is no permanent copy of this file anywhere on the backend either
// (RULE-JUST-11.5), so the app must never let one linger on the device.
//
// Extracted out of justification-detail-screen.tsx (the student's own screen) so the professor's
// justification-queue-screen.tsx can reuse the exact same download/share/cleanup lifecycle
// (RULE-JUST-08: the subject's teacher is who opens the attachment) instead of duplicating it —
// same download endpoint (by submissionId), same reauthorize-on-every-open contract, only the
// submissionId passed in (and whether the caller cares about onAccessGranted) differs.
export function useAttachmentViewer(submissionId: string, onAccessGranted?: () => void) {
  const [isViewing, setIsViewing] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  // The only state this hook actually needs to persist between renders is which temp file (if
  // any) currently exists on disk — a ref, not useState, since the unmount effect below must
  // read its LATEST value from a closure created once at mount time.
  const localUriRef = useRef<string | null>(null);

  async function cleanup(): Promise<void> {
    const localUri = localUriRef.current;
    if (!localUri) {
      return;
    }
    localUriRef.current = null;
    await deleteDownloadedAttachment(localUri);
  }

  useEffect(() => {
    return () => {
      // Fire-and-forget: the component is already unmounting, nothing left to update.
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup() only ever reads the ref, not any prop/state.
  }, []);

  async function viewAttachment(): Promise<void> {
    setViewError(null);
    setIsViewing(true);
    try {
      await cleanup(); // A previous download left over from an earlier tap never lingers.

      const downloaded: DownloadedAttachment = await downloadAbsenceJustificationAttachment(submissionId);
      localUriRef.current = downloaded.localUri;
      onAccessGranted?.(); // The download just produced a new "granted" row in the access log.

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloaded.localUri, { mimeType: downloaded.mimeType ?? undefined, dialogTitle: 'Absence justification attachment' });
      } else {
        setViewError('No app is available on this device to open this file.');
      }
    } catch (error) {
      setViewError(errorMessage(error));
    } finally {
      await cleanup();
      setIsViewing(false);
    }
  }

  return { isViewing, viewError, viewAttachment };
}
