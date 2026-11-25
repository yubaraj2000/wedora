import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, LanguagePicker, Screen } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { CeremonyPanel } from '@/features/onboarding/CeremonyPanel';
import { ConfirmWeddingCard } from '@/features/onboarding/ConfirmWeddingCard';
import { HeadsPanel } from '@/features/onboarding/HeadsPanel';
import { InvitesPanel } from '@/features/onboarding/InvitesPanel';
import { useLabels } from '@/features/onboarding/labels';
import { STEP_NUM } from '@/features/onboarding/model';
import { OnboardingChat } from '@/features/onboarding/OnboardingChat';
import { TasksPanel } from '@/features/onboarding/TasksPanel';
import { TextAsk } from '@/features/onboarding/TextAsk';
import { useAdminOnboarding, type AdminOnboarding } from '@/features/onboarding/useAdminOnboarding';

export default function AdminOnboardingScreen() {
  const o = useAdminOnboarding();
  const L = useLabels(o.lang);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Set up your wedding' }} />
      {!o.ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.maroon} size="large" />
        </View>
      ) : (
        <OnboardingChat
          stepNum={STEP_NUM[o.step]}
          msgs={o.msgs}
          thinking={o.thinking}
          thinkingLabel={L.thinking}
          scrollKey={`${o.step}|${o.tasks.length}|${o.taskError ?? ''}`}>
          <StepPanel o={o} L={L} />
        </OnboardingChat>
      )}
    </Screen>
  );
}

function StepPanel({ o, L }: { o: AdminOnboarding; L: ReturnType<typeof useLabels> }) {
  switch (o.step) {
    case 'lang':
      return <LanguagePicker value={null} onChange={o.chooseLang} />;
    case 'about':
      return (
        <TextAsk
          value={o.aboutText}
          onChangeText={o.setAboutText}
          placeholder="My daughter Priya is marrying Rahul on 12 December in Cuttack. I am Papa."
          sendLabel={L.send}
          onSend={o.sendAbout}
          busy={o.busy}
          multiline
        />
      );
    case 'confirm':
      return <ConfirmWeddingCard draft={o.draft} onChange={o.setDraft} onConfirm={() => o.confirmWedding(L.looksRight)} busy={o.busy} L={L} />;
    case 'budget':
      return (
        <TextAsk
          value={o.budgetText}
          onChangeText={o.setBudgetText}
          placeholder="18 lakh"
          sendLabel={L.send}
          onSend={o.sendBudget}
          busy={o.busy}
        />
      );
    case 'budgetConfirm':
      return (
        <View style={styles.row}>
          <Button title={L.change} onPress={o.changeBudget} variant="secondary" disabled={o.busy} style={styles.flex} />
          <Button title={L.yes} icon="✓" onPress={() => o.confirmBudget(L.yes)} loading={o.busy} style={styles.flex} />
        </View>
      );
    case 'ceremonies':
      return (
        <CeremonyPanel
          items={o.ceremonies}
          fromFlag={o.fromFlag}
          onToggle={o.toggleCeremony}
          custom={o.customCeremony}
          onCustom={o.setCustomCeremony}
          onAdd={o.addCeremony}
          onContinue={o.continueCeremonies}
          busy={o.busy}
          L={L}
        />
      );
    case 'tasks':
      return (
        <TasksPanel
          tasks={o.tasks}
          thinking={o.thinking}
          error={o.taskError}
          onToggle={o.toggleTask}
          onContinue={() => o.continueTasks(L.continue)}
          onSkip={() => o.skipTasks(L.skip)}
          onRetry={o.retryTasks}
          busy={o.busy}
          L={L}
        />
      );
    case 'heads':
      return (
        <HeadsPanel
          departments={o.departments}
          headOf={o.headOf}
          setHead={o.setHead}
          onPick={o.pickHead}
          onContinue={() => o.continueHeads(L.continue)}
          busy={o.busy}
          L={L}
        />
      );
    case 'invites':
      return <InvitesPanel invites={o.invites} linkFor={o.linkFor} onSend={o.sendInvite} onFinish={o.finish} busy={o.busy} L={L} />;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: S.sm },
  flex: { flex: 1 },
});
