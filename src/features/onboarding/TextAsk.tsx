import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { S } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  sendLabel: string;
  onSend: () => void;
  busy?: boolean;
  multiline?: boolean;
};

/** A free-text answer box with a Send button. */
export function TextAsk({ value, onChangeText, placeholder, sendLabel, onSend, busy, multiline }: Props) {
  return (
    <View style={styles.wrap}>
      <Field
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        autoFocus
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
