import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import {
  ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES,
  createAbsenceJustification,
  EXCLUSION_REASON_LABELS,
  ITEM_STATUS_BADGE,
  LEGAL_CATEGORY_LABELS,
  type AbsenceJustificationLegalCategory,
  type CreateAbsenceJustificationResult,
} from './absence-justification-api';
import { pickAttachment, type AttachmentAsset } from './attachment-picker';
import { StatusBadge } from './status-badge';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FILE_PICK_ERROR_MESSAGE: Record<'unsupported-type' | 'too-large', string> = {
  'unsupported-type': 'Unsupported file type — choose a PDF, JPEG or PNG file.',
  'too-large': 'File is larger than the 10 MB limit.',
};

// Aluno-only screen — RULE-JUST-01 addendum: the student informs a DATE RANGE and NEVER picks a
// subject — the system derives which sessions/subjects are affected (RULE-JUST-06/13/14). The
// attachment is always required (no request without a file). Native port of the web dashboard's
// new-justification-page.tsx: one submit that already returns the full result (items included +
// excluded, with reasons) — there is no separate preview/confirmation step.
//
// Date fields are plain text inputs in "YYYY-MM-DD" format rather than a native date picker: the
// task authorized adding expo-document-picker/expo-file-system/expo-sharing for the
// upload/download flow, but not a date-picker dependency, so this stays dependency-free at the
// cost of a less friendly input than the web dashboard's <input type="date"> — flagged in the
// Mobile Implementation Summary.
export function NewJustificationScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [legalCategory, setLegalCategory] = useState<AbsenceJustificationLegalCategory>(ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<AttachmentAsset | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);

  const mutation = useMutation({ mutationFn: createAbsenceJustification });

  async function handlePickFile(): Promise<void> {
    setIsPickingFile(true);
    try {
      const outcome = await pickAttachment();
      if (outcome.kind === 'canceled') {
        return;
      }
      if (outcome.kind === 'picked') {
        setFile(outcome.asset);
        setFileError(null);
        return;
      }
      setFile(null);
      setFileError(FILE_PICK_ERROR_MESSAGE[outcome.kind]);
    } finally {
      setIsPickingFile(false);
    }
  }

  function handleSubmit(): void {
    if (!file) {
      setFileError('An attachment is required — a request cannot be submitted without a file.');
      return;
    }
    mutation.mutate({ startDate, endDate, legalCategory, description, file });
  }

  const datesAreValid = DATE_ONLY_PATTERN.test(startDate) && DATE_ONLY_PATTERN.test(endDate) && endDate >= startDate;
  const canSubmit = datesAreValid && description.trim().length > 0 && Boolean(file) && !fileError && !mutation.isPending;

  if (mutation.isSuccess) {
    return (
      <ScreenContainer>
        <SubmissionResult result={mutation.data} onViewMyRequests={() => router.replace('/justifications')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Justify an absence</Text>
        <Text style={styles.hint}>
          Inform the period of the absence — the system figures out on its own which classes and subjects enter the
          request, one decision per class.
        </Text>

        {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}

        <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-09-01"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          maxLength={10}
        />

        <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2026-09-01"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          maxLength={10}
        />
        {startDate && endDate && !datesAreValid && (
          <Text style={styles.fieldError}>Use YYYY-MM-DD for both dates, with the end date on or after the start date.</Text>
        )}

        <Text style={styles.label}>Legal category of the absence</Text>
        <View style={styles.categoryList}>
          {ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES.map((category) => (
            <Pressable
              key={category}
              style={[styles.categoryOption, legalCategory === category && styles.categoryOptionSelected]}
              onPress={() => setLegalCategory(category)}
            >
              <Text style={styles.categoryOptionText}>{LEGAL_CATEGORY_LABELS[category]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={(text) => setDescription(text.slice(0, 4000))}
          placeholder="Describe the reason for the absence — complements the category selected above."
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Supporting document (PDF, JPEG or PNG, up to 10 MB)</Text>
        <Pressable style={styles.pickButton} onPress={handlePickFile} disabled={isPickingFile}>
          {isPickingFile ? <ActivityIndicator /> : <Text style={styles.pickButtonText}>{file ? 'Replace file' : 'Choose file'}</Text>}
        </Pressable>
        {file && <Text style={styles.fileName}>{file.name}</Text>}
        {fileError && <Text style={styles.fieldError}>{fileError}</Text>}
        <Text style={styles.fileHint}>
          Only the subject's teacher decides the request — the system does not verify the authenticity of the
          document, it only records that it was submitted by you.
        </Text>

        <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit request</Text>}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function SubmissionResult({ result, onViewMyRequests }: { result: CreateAbsenceJustificationResult; onViewMyRequests: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.successBanner}>
        Request submitted — {result.items.length} {result.items.length === 1 ? 'class entered' : 'classes entered'} under review.
      </Text>

      {result.items.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Classes included in the request</Text>
          {result.items.map((item) => (
            <View key={item.id} style={styles.resultRow}>
              <Text style={styles.resultRowText}>Class {item.classSessionId}</Text>
              <StatusBadge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />
            </View>
          ))}
        </>
      )}

      {result.excluded.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Classes from the period that did not enter the request</Text>
          {result.excluded.map((excluded) => (
            <Text key={excluded.classSessionId} style={styles.excludedRow}>
              Class {excluded.classSessionId} — {EXCLUSION_REASON_LABELS[excluded.reason]}
            </Text>
          ))}
        </>
      )}

      <Pressable style={styles.submitButton} onPress={onViewMyRequests}>
        <Text style={styles.submitButtonText}>View my requests</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingBottom: 32,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: '#777',
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: '#611a15',
    fontSize: 12,
    marginTop: 4,
  },
  categoryList: {
    gap: 6,
  },
  categoryOption: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryOptionSelected: {
    borderColor: '#208aef',
    backgroundColor: '#eaf4ff',
  },
  categoryOptionText: {
    fontSize: 13,
  },
  pickButton: {
    borderWidth: 1,
    borderColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#208aef',
    fontWeight: '600',
  },
  fileName: {
    marginTop: 6,
    color: '#333',
    fontSize: 13,
  },
  fileHint: {
    color: '#777',
    fontSize: 11,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#e7f6ec',
    color: '#1e7e34',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultRowText: {
    color: '#333',
  },
  excludedRow: {
    color: '#777',
    fontSize: 12,
    paddingVertical: 4,
  },
});
