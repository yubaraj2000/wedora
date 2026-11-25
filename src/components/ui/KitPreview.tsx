import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { C, S } from '@/constants/theme';

import { Button } from './Button';
import { Card } from './Card';
import { ChatBubble } from './ChatBubble';
import { CheckRow } from './CheckRow';
import { Chip } from './Chip';
import { EMPTY_IMAGES, EmptyState } from './EmptyState';
import { Field } from './Field';
import { formatINR } from './format';
import { LanguagePicker, type Lang } from './LanguagePicker';
import { ListRow } from './ListRow';
import { Pill, type PillKind } from './Pill';
import { Screen } from './Screen';
import { SectionHeader } from './SectionHeader';
import { Txt } from './Txt';

const KINDS: PillKind[] = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'cancelled',
  'approved',
  'rejected',
  'level',
  'neutral',
];

/** Renders one of each UI kit component. Mount temporarily to eyeball the kit. */
export function KitPreview() {
  const [lang, setLang] = useState<Lang>('od-IN');
  const [name, setName] = useState('');
  const [checked, setChecked] = useState(true);
  const [chip, setChip] = useState(true);
  const [loading, setLoading] = useState(false);

  return (
    <Screen scroll>
      <Txt variant="title">Wedora UI kit</Txt>
      <Txt variant="h2">Heading 2</Txt>
      <Txt variant="h3">Heading 3</Txt>
      <Txt>Body text — ଓଡ଼ିଆ हिन्दी বাংলা</Txt>
      <Txt variant="small" color={C.inkSoft}>
        Small text
      </Txt>
      <Txt variant="caption" color={C.inkSoft}>
        Caption · {formatINR(12000)} · {formatINR(1800000)} · {formatINR(999)}
      </Txt>

      <SectionHeader title="Buttons" actionTitle="See all" onAction={() => {}} />
      <View style={styles.stack}>
        <Button title="Primary" icon="🪔" onPress={() => setLoading((v) => !v)} />
        <Button title="Secondary" variant="secondary" size="md" />
        <Button title="Success" variant="success" size="md" loading={loading} />
        <Button title="Danger" variant="danger" size="sm" inline />
        <Button title="Ghost" variant="ghost" inline />
        <Button title="Disabled" disabled />
      </View>

      <SectionHeader title="Pills" />
      <View style={styles.wrap}>
        {KINDS.map((k) => (
          <Pill key={k} kind={k} label={k === 'neutral' ? 'Neutral' : undefined} />
        ))}
      </View>

      <SectionHeader title="Card + list" />
      <Card onPress={() => {}}>
        <ListRow title="Book the pandit" subtitle="Assigned to Mamu" right={<Pill kind="pending" />} />
        <ListRow title="Flowers" subtitle="Paid by Bapa" right={formatINR(4500)} onPress={() => {}} divider={false} />
      </Card>

      <SectionHeader title="Field" />
      <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Sunita" />
      <Field label="Phone" value="" onChangeText={() => {}} keyboardType="phone-pad" error="Enter a valid number" />

      <SectionHeader title="Chips & checks" />
      <View style={styles.wrap}>
        <Chip label="Haldi" selected={chip} onPress={() => setChip((v) => !v)} />
        <Chip label="Sangeet" sublabel="Evening" selected={!chip} onPress={() => setChip((v) => !v)} />
      </View>
      <CheckRow checked={checked} onToggle={() => setChecked((v) => !v)} title="Order sweets" note="2 weeks before" />

      <SectionHeader title="Language" />
      <LanguagePicker value={lang} onChange={setLang} />

      <SectionHeader title="Chat" />
      <ChatBubble from="ai" text="Namaskar! Whose wedding are we planning?" />
      <ChatBubble from="me" text="My daughter Priya's" />

      <EmptyState source={EMPTY_IMAGES.tasks} title="No tasks yet" body="Tasks you are given will show here." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: S.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
});
