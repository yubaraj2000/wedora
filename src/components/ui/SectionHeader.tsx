import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { S } from '@/constants/theme';

import { Button } from './Button';
import { Txt } from './Txt';

export type SectionHeaderProps = {
  title: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionTitle, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Txt variant="h3" style={styles.title} accessibilityRole="header">
        {title}
      </Txt>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="ghost" size="sm" inline />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.lg,
    marginBottom: S.sm,
    minHeight: 40,
  },
  title: { flex: 1 },
});
