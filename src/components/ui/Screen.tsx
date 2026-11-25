import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { C, MaxWidth, S } from '@/constants/theme';

export type ScreenProps = {
  children?: ReactNode;
  scroll?: boolean;
  /** Safe-area edges to pad. Default: top + bottom. */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll, edges = ['top', 'bottom'], style, contentStyle }: ScreenProps) {
  const inner = <View style={[styles.inner, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {inner}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.fixedContent]}>{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingVertical: S.lg },
  fixedContent: { alignItems: 'center', paddingVertical: S.lg },
  inner: { flex: 1, width: '100%', maxWidth: MaxWidth, paddingHorizontal: S.lg },
});
