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
      <Tabs.Screen name="warnings" options={{ title: 'Warnings' }} />
      <Tabs.Screen name="justifications" options={{ title: 'Justifications' }} />
      {/* Registered so router.push can reach them, but hidden from the tab bar (href: null) —
          this tab's list -> new/detail navigation is a flat sibling-route flow, not a nested
          Stack, so these need an explicit opt-out or Tabs would otherwise render them as their
          own (undesired) tab bar buttons. */}
      <Tabs.Screen name="justifications/new" options={{ href: null, title: 'New justification' }} />
      <Tabs.Screen name="justifications/[submissionId]" options={{ href: null, title: 'Request details' }} />
      <Tabs.Screen name="justification-queue" options={{ title: 'Justification queue' }} />
      <Tabs.Screen name="leadership-class-groups" options={{ title: 'Leadership' }} />
      {/* Same href: null idiom as justifications/[submissionId] above — a flat
          list -> detail navigation, not a nested Stack. */}
      <Tabs.Screen name="leadership-class-groups/[classGroupId]" options={{ href: null, title: 'Class group attendance' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
      {/* Same href: null idiom as justifications/[submissionId] above — reached from
          Account's "Location consent" button and from checkin's inline offer banner,
          never its own tab. */}
      <Tabs.Screen name="location-consent" options={{ href: null, title: 'Location consent' }} />
    </Tabs>
  );
}
