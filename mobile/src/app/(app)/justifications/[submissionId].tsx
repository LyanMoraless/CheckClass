import { useLocalSearchParams } from 'expo-router';
import { ErrorBanner } from '../../../components/error-banner';
import { ScreenContainer } from '../../../components/screen-container';
import { JustificationDetailScreen } from '../../../features/absence-justification/justification-detail-screen';

export default function JustificationDetailRoute() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();

  if (!submissionId) {
    return (
      <ScreenContainer>
        <ErrorBanner message="Missing request id in the URL" />
      </ScreenContainer>
    );
  }

  return <JustificationDetailScreen submissionId={submissionId} />;
}
