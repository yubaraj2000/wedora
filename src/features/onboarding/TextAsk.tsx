import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { S } from '@/constants/theme';
import { MicAnswer } from '@/features/voice/MicAnswer';
import type { Lang } from '@/lib/types';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  sendLabel: string;
  onSend: () => void;
  busy?: boolean;
  multiline?: boolean;
  /** When set, a big mic lets the person speak the answer; it is sent automatically. */
  voiceLang?: Lang | null;
  micLabels?: { tap?: string; listening?: string; working?: string };
};

/** A free-text answer box with a Send button — and a mic, so nobody has to type. */
export function TextAsk({ value, onChangeText, placeholder, sendLabel, onSend, busy, multiline, voiceLang, micLabels }: Props) {
  // After a spoken answer fills the box, send it on the next render (when onSend sees the new value).
  const autoSend = useRef<string | null>(null);
  useEffect(() => {
    if (autoSend.current !== null && value === autoSend.current) {
      autoSend.current = null;
      onSend();
    }
  }, [value, onSend]);

  return (
    <View style={styles.wrap}>
      {voiceLang ? (
        <MicAnswer
          lang={voiceLang}
          labels={micLabels}
          onText={(text) => {
            autoSend.current = text;
            onChangeText(text);
          }}
        />
      ) : null}
      <Field
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        autoFocus={!voiceLang}
        onSubmitEditing={multiline ? undefined : onSend}
        style={styles.field}
      />
      <Button title={sendLabel} icon="➤" onPress={onSend} loading={busy} disabled={!value.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.sm },
  field: { marginBottom: 0 },
});
