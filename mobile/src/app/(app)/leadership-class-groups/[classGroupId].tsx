import { useLocalSearchParams } from 'expo-router';
import { ErrorBanner } from '../../../components/error-banner';
import { ScreenContainer } from '../../../components/screen-container';
import { ClassGroupAttendanceScreen } from '../../../features/leadership-class-groups/class-group-attendance-screen';

export default function ClassGroupAttendanceRoute() {
  const { classGroupId } = useLocalSearchParams<{ classGroupId: string }>();

  if (!classGroupId) {
    return (
      <ScreenContainer>
        <ErrorBanner message="Missing class group id in the URL" />
      </ScreenContainer>
    );
  }

  return <ClassGroupAttendanceScreen classGroupId={classGroupId} />;
}
