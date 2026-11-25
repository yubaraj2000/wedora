import { Stack } from 'expo-router';

import { TeamOnboarding } from '@/features/team/TeamOnboarding';

export default function TeamOnboardingScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Welcome' }} />
      <TeamOnboarding />
    </>
  );
}
