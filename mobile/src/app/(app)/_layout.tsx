import { Tabs } from 'expo-router';

// Both Aluno and Professor screens are shown to every authenticated person, in the same tab
// bar — see the Mobile Implementation Summary's "Flagged issues" for why: the backend
// contract has no role/actorType anywhere (JwtPayload is only { personId, tenantId }), so
// there is nothing to key an Aluno-vs-Professor UI split on without inventing one. The
// backend already enforces who can actually do what per endpoint (RULE-ATT-12's leadership
// chain for pending-review resolution; RULE-ATT-15's self-scoped access for attendance/
// schedule), so showing every tab to every authenticated user is safe — a student simply
// sees an empty pending-reviews list.
export default function AppTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="checkin" options={{ title: 'Check-in' }} />
      <Tabs.Screen name="pending-reviews" options={{ title: 'Pending reviews' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
