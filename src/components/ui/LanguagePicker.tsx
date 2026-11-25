import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { S } from '@/constants/theme';

import { Chip } from './Chip';

export type Lang = 'od-IN' | 'hi-IN' | 'bn-IN' | 'en-IN';

export const LANGS: readonly { code: Lang; native: string; english: string }[] = [
  { code: 'od-IN', native: 'ଓଡ଼ିଆ', english: 'Odia' },
  { code: 'hi-IN', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn-IN', native: 'বাংলা', english: 'Bengali' },
  { code: 'en-IN', native: 'English', english: 'English' },
];

export type LanguagePickerProps = {
  value: Lang | null | undefined;
  onChange: (code: Lang) => void;
  style?: StyleProp<ViewStyle>;
};

export function LanguagePicker({ value, onChange, style }: LanguagePickerProps) {
  return (
    <View style={[styles.grid, style]}>
      {LANGS.map((l) => (
        <Chip
          key={l.code}
          big
          label={l.native}
          sublabel={l.code === 'en-IN' ? undefined : l.english}
          selected={value === l.code}
          onPress={() => onChange(l.code)}
          style={styles.cell}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, alignSelf: 'stretch' },
  cell: { flexBasis: '45%', flexGrow: 1 },
});
