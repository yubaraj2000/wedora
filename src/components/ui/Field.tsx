import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Txt } from './Txt';

export type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  error?: string | null;
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  error,
  secureTextEntry,
  autoFocus,
  maxLength,
  autoCapitalize,
  onSubmitEditing,
  style,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Txt variant="small" weight="700" style={styles.label}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.inkSoft}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={label ?? placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      />
      {error ? (
        <Txt variant="small" color={C.danger} style={styles.error}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginBottom: S.md },
  label: { marginBottom: S.xs + 2 },
  input: {
    minHeight: 52,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: S.md,
    fontSize: 17,
    color: C.ink,
  },
  multiline: { minHeight: 104, paddingTop: S.md, paddingBottom: S.md },
  focused: { borderColor: C.maroon },
  errored: { borderColor: C.danger },
  error: { marginTop: S.xs },
});
