import { StyleSheet, View } from 'react-native';

import { Button, Card, CheckRow, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';

import type { Labels } from './labels';
import type { TaskItem } from './model';

type Props = {
  tasks: TaskItem[];
  thinking: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onRetry: () => void;
  busy?: boolean;
  L: Labels;
};

export function TasksPanel({ tasks, thinking, error, onToggle, onContinue, onSkip, onRetry, busy, L }: Props) {
  if (thinking) return null;
  if (error || !tasks.length) {
    return (
      <View style={styles.row}>
        {error ? <Button title={L.retry} onPress={onRetry} variant="secondary" style={styles.flex} /> : null}
        <Button title={L.skip} onPress={onSkip} loading={busy} variant={error ? 'primary' : 'secondary'} style={styles.flex} />
      </View>
    );
  }
  const groups = new Map<string, { name: string; items: TaskItem[] }>();
  for (const t of tasks) {
    const g = groups.get(t.department_id) ?? { name: t.department, items: [] };
    g.items.push(t);
    groups.set(t.department_id, g);
  }
  return (
    <>
      {[...groups.entries()].map(([id, g]) => (
        <Card key={id}>
          <Txt variant="h3" color={C.maroon}>
            {g.name}
          </Txt>
          {g.items.map((t) => (
            <CheckRow
              key={t.id}
              checked={t.checked}
              onToggle={() => onToggle(t.id)}
              title={t.local || t.title}
              note={t.local && t.local !== t.title ? t.title : undefined}
            />
          ))}
        </Card>
      ))}
      <Button title={`${L.continue} (${tasks.filter((t) => t.checked).length})`} onPress={onContinue} loading={busy} />
      <Button title={L.skip} onPress={onSkip} variant="ghost" size="md" disabled={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.sm },
  flex: { flex: 1 },
});
