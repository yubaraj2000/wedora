import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { updateTaskStatus } from '@/lib/api';
import type { Member, Task, TaskStatus } from '@/lib/types';

import { TASK_NEXT } from './logic';

const OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

type Props = {
  task: Task;
  title: string;
  subtitle?: string;
  editable: boolean;
  onChanged?: () => void;
};

/** Tap to cycle pending → in progress → done. "⋯" shows all statuses (incl. blocked). */
export function TaskRow({ task, title, subtitle, editable, onChanged }: Props) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState(task.status);
  if (task.status !== lastSeen) {
    setLastSeen(task.status);
    setStatus(task.status);
  }

  const set = async (s: TaskStatus) => {
    const prev = status;
    setStatus(s);
    setOpen(false);
    setErr(null);
    try {
      await updateTaskStatus(task.id, s);
      onChanged?.();
    } catch (e) {
      setStatus(prev);
      setErr((e as Error).message);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        disabled={!editable}
        onPress={() => set(TASK_NEXT[status])}
        onLongPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${status}. Tap to change.`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Txt variant="h3" style={styles.check}>
          {status === 'completed' ? '✅' : status === 'blocked' ? '⛔' : status === 'in_progress' ? '🔄' : '⬜'}
        </Txt>
        <View style={styles.flex}>
          <Txt
            weight="600"
            numberOfLines={2}
            style={status === 'completed' ? styles.done : undefined}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="small" color={C.inkSoft} numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <Pill kind={status} />
        {editable ? (
          <Pressable hitSlop={10} onPress={() => setOpen((o) => !o)} accessibilityLabel="More statuses">
            <Txt variant="h3" color={C.inkSoft}>
              ⋯
            </Txt>
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <View style={styles.opts}>
          {OPTIONS.map((o) => (
            <Pressable key={o} onPress={() => set(o)} accessibilityRole="button">
              <Pill kind={o} style={o === status ? styles.sel : undefined} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {err ? (
        <Txt variant="small" color={C.danger}>
          {err}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 56 },
  pressed: { opacity: 0.7 },
  check: { width: 30 },
  flex: { flex: 1 },
  done: { textDecorationLine: 'line-through', color: C.inkSoft },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, paddingBottom: S.sm, paddingLeft: 38 },
  sel: { borderWidth: 2, borderColor: C.ink },
});
