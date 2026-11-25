import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, ChatBubble, CheckRow, Screen, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import {
  completeOnboarding,
  createInvite,
  createMinorDepartment,
  createTasksBulk,
  getDepartments,
  getEvents,
  getTasks,
  suggestTasks,
} from '@/lib/api';
import type { Department, SuggestedTask, Task, WeddingEvent } from '@/lib/types';
import { useFlag, useWedding } from '@/lib/wedding';
import { SpeakToggle, useSpeakQueue, type SpeakLine } from '@/features/onboarding/speakQueue';

import { INVITE_LINES, InviteList, type CreatedInvite } from './InviteList';
import { emptyPerson, emptySubHead, filled, PEOPLE_LINES, PeopleForm, type PersonRow, type SubHeadRow } from './PeopleForm';
import { useT, type T } from './useT';

type Step = 'greet' | 'tasks' | 'team' | 'invites';
type Msg = { from: 'ai' | 'me'; text: string };
type Err = { msg: string; id: string; n: number };

/** Chat-style onboarding for heads, sub-heads and members (in the member's own language). */
export function TeamOnboarding() {
  const { member, wedding, refresh } = useWedding();
  const aiOn = useFlag('ai_task_planner');
  const lang = member?.language ?? 'en-IN';
  const w = wedding?.id ?? null;
  const role = member?.role ?? 'member';
  const isMember = role === 'member';
  const isHead = role === 'head' || role === 'admin';

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<WeddingEvent[]>([]);

  const [step, setStep] = useState<Step>('greet');
  const [history, setHistory] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Err | null>(null);

  const [suggested, setSuggested] = useState<SuggestedTask[] | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [subHeads, setSubHeads] = useState<SubHeadRow[]>([emptySubHead()]);
  const [members, setMembers] = useState<PersonRow[]>([emptyPerson()]);
  const [groupLink, setGroupLink] = useState(false);
  const [groupToken, setGroupToken] = useState<string | null>(null);
  const [invites, setInvites] = useState<CreatedInvite[]>([]);

  const dept = departments.find((d) => d.id === member?.department_id) ?? null;
  const deptName = dept?.name ?? 'your team';
  const name = member?.display_name ?? '';
  const wedName = wedding?.name ?? 'the wedding';
  const myTasks = useMemo(() => tasks.filter((x) => x.department_id === member?.department_id), [tasks, member?.department_id]);

  const L = {
    member: `Welcome, ${name}. You are a member of ${deptName}. Your head assigns tasks; you can record expenses and update task status.`,
    greetHead: `Namaste, ${name}. You are the head of ${deptName} for ${wedName}. We will set up your department in two short steps.`,
    greetSub: `Namaste, ${name}. You lead the ${deptName} sub-team for ${wedName}. We will set up your team in two short steps.`,
    tasksHave: `Here are the tasks for ${deptName} so far:`,
    tasksNone: `There are no tasks for ${deptName} yet.`,
    wantMore: 'Shall I prepare more tasks for your department?',
    pickTasks: 'Tick the ones you want to add.',
    team: isHead
      ? 'Add people to your team. Sub-heads lead a small sub-team; members do the work.'
      : 'Add the members of your sub-team. They will do the work and can add expenses.',
    invites: 'Your invites are ready. Send each one on WhatsApp.',
    noInvites: 'No invitations yet. You can invite people later from the Team screen.',
    oops: 'Something went wrong:',
  };
  const t = useT(lang, [
    ...Object.values(L),
    ...PEOPLE_LINES,
    ...INVITE_LINES,
    "Let's go",
    "Let's start",
    'Next',
    'Suggest tasks',
    'Skip',
    'Add selected tasks',
    'Create invites',
    "Skip — I'll invite later",
    'Finish',
    'Try again',
    'Suggest more tasks',
    'Added tasks',
    'Skipped',
    'Done',
  ]);

  const load = useCallback(async () => {
    if (!w) return;
    setLoading(true);
    setErr(null);
    try {
      const [d, tk, ev] = await Promise.all([getDepartments(w), getTasks(w), getEvents(w)]);
      setDepartments(d);
      setTasks(tk);
      setEvents(ev);
    } catch (e) {
      setErr({ msg: (e as Error).message, id: 'load', n: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [w]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const say = (from: 'ai' | 'me', text: string) => setHistory((h) => [...h, { from, text }]);

  /** Run an action with a spinner on `id`; errors show as an AI bubble with retry. */
  const run = (id: string, fn: () => Promise<void>) => {
    (async () => {
      setBusy(id);
      setErr(null);
      try {
        await fn();
      } catch (e) {
        setErr({ msg: (e as Error).message, id, n: Date.now() });
      } finally {
        setBusy(null);
      }
    })();
  };

  const finish = () =>
    run('finish', async () => {
      if (!w) return;
      await completeOnboarding(w);
      await refresh(w);
      router.replace('/home');
    });

  // ---------- head / sub-head steps ----------
  const toTasks = () => {
    say('ai', isHead ? L.greetHead : L.greetSub);
    say('me', "Let's start");
    setStep('tasks');
  };

  const toTeam = (answer: string) => {
    say('ai', myTasks.length ? L.tasksHave : L.tasksNone);
    say('me', answer);
    setStep('team');
  };

  const suggest = () =>
    run('suggest', async () => {
      if (!w || !dept) return;
      const r = await suggestTasks(
        w,
        events.map((e) => ({ key: e.key, en: e.name })),
        [{ id: dept.id, name: dept.name }],
        lang,
      );
      setSuggested(r.tasks);
      setChecked(Object.fromEntries(r.tasks.map((_, i) => [i, true])));
    });

  const addTasks = () =>
    run('addTasks', async () => {
      if (!w || !suggested) return;
      const pick = suggested.filter((_, i) => checked[i]);
      if (pick.length) {
        await createTasksBulk(
          w,
          pick.map((x) => ({ department_id: x.department_id || dept!.id, title: x.title, event_key: x.event_key })),
        );
        setTasks(await getTasks(w));
      }
      toTeam(`${'Added tasks'}: ${pick.length}`);
    });

  const createInvites = () =>
    run('invites', async () => {
      if (!dept) return;
      // Retry-safe: rows that already got a token are skipped.
      const subs = [...subHeads];
      const mems = [...members];
      const out: CreatedInvite[] = [...invites];
      try {
        if (isHead) {
          for (let i = 0; i < subs.length; i++) {
            const r = subs[i];
            if (!filled(r) || r.token) continue;
            const team = r.team.trim() || `${r.name.trim() || 'New'}'s team`;
            const deptId = r.deptId ?? (await createMinorDepartment(dept.id, team));
            subs[i] = { ...r, deptId };
            const token = await createInvite(deptId, 'sub_head', { name: r.name.trim() || undefined, phone: r.phone.trim() || undefined });
            subs[i] = { ...subs[i], token };
            out.push({ key: token, token, name: r.name.trim() || null, phone: r.phone.trim() || null, role: 'sub_head', department: team });
          }
        }
        for (let i = 0; i < mems.length; i++) {
          const r = mems[i];
          if (!filled(r) || r.token) continue;
          const token = await createInvite(dept.id, 'member', { name: r.name.trim() || undefined, phone: r.phone.trim() || undefined });
          mems[i] = { ...r, token };
          out.push({ key: token, token, name: r.name.trim() || null, phone: r.phone.trim() || null, role: 'member', department: dept.name });
        }
        if (groupLink && !groupToken) {
          const token = await createInvite(dept.id, 'member', { maxUses: 20 });
          setGroupToken(token);
          out.push({ key: token, token, name: null, phone: null, role: 'member', department: dept.name, group: true });
        }
      } finally {
        setSubHeads(subs);
        setMembers(mems);
        setInvites(out);
      }
      say('ai', L.team);
      say('me', `${'Create invites'} (${out.length})`);
      setStep('invites');
    });

  // Retry uses the latest handler (fresh state), so partially-created invites are not duplicated.
  const retryFns: Record<string, () => void> = { load, suggest, addTasks, invites: createInvites, finish };
  const retry = () => err && retryFns[err.id]?.();

  const nothingToInvite = !subHeads.some(filled) && !members.some(filled) && !groupLink;

  // ---------- voice: every AI line on screen is also spoken (typed or spoken answers alike) ----------
  const showing = !!member && !!wedding && !loading;
  const aiLines: { key: string; en: string; extra?: string }[] = [];
  const add = (en: string) => aiLines.push({ key: en, en }); // keyed by English text: spoken once
  if (showing) {
    history.forEach((m) => m.from === 'ai' && add(m.text));
    if (isMember) add(L.member);
    else if (step === 'greet') add(isHead ? L.greetHead : L.greetSub);
    else if (step === 'tasks') {
      add(myTasks.length ? L.tasksHave : L.tasksNone);
      if (aiOn && dept) add(suggested ? L.pickTasks : L.wantMore);
    } else if (step === 'team') add(L.team);
    else add(invites.length ? L.invites : L.noInvites);
  }
  if (err) aiLines.push({ key: `oops:${err.n}`, en: L.oops, extra: 'Try again' });
  const speakLines = useTranslatedLines(t, lang, aiLines);
  const { soundOn, toggleSound } = useSpeakQueue(speakLines, member ? lang : null, w);

  // ---------- render ----------
  if (!member || !wedding || loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.center}>
          {err ? (
            <ErrorBubble t={t} msg={err.msg} onRetry={retry} />
          ) : (
            <ActivityIndicator color={C.maroon} size="large" />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['bottom']} contentStyle={styles.content}>
      <View style={styles.top}>
        <SpeakToggle on={soundOn} onToggle={toggleSound} />
      </View>
      {history.map((m, i) => (
        <ChatBubble key={i} from={m.from} text={translateAnswer(t, m.text)} />
      ))}

      {isMember ? (
        <>
          <ChatBubble from="ai" text={t(L.member)} />
          <Button title={t("Let's go")} icon="🪔" loading={busy === 'finish'} onPress={finish} />
        </>
      ) : step === 'greet' ? (
        <>
          <ChatBubble from="ai" text={t(isHead ? L.greetHead : L.greetSub)} />
          <Button title={t("Let's start")} icon="🪔" onPress={toTasks} />
        </>
      ) : step === 'tasks' ? (
        <>
          <ChatBubble from="ai" text={t(myTasks.length ? L.tasksHave : L.tasksNone)}>
            {myTasks.slice(0, 12).map((x) => (
              <Txt key={x.id} variant="small" style={styles.taskLine}>
                • {x.title_i18n?.[lang] ?? x.title}
              </Txt>
            ))}
          </ChatBubble>
          {aiOn && dept ? (
            suggested ? (
              <>
                <ChatBubble from="ai" text={t(L.pickTasks)} />
                <View style={styles.block}>
                  {suggested.map((s, i) => (
                    <CheckRow
                      key={i}
                      checked={!!checked[i]}
                      onToggle={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                      title={s.local || s.title}
                      note={s.local && s.local !== s.title ? s.title : undefined}
                    />
                  ))}
                </View>
                <Button title={t('Add selected tasks')} loading={busy === 'addTasks'} onPress={addTasks} />
                <Button title={t('Skip')} variant="ghost" onPress={() => toTeam('Skipped')} />
              </>
            ) : (
              <>
                <ChatBubble from="ai" text={t(L.wantMore)} />
                <Button title={t('Suggest tasks')} icon="✨" loading={busy === 'suggest'} onPress={suggest} />
                <Button title={t('Skip')} variant="ghost" onPress={() => toTeam('Skipped')} />
              </>
            )
          ) : (
            <Button title={t('Next')} onPress={() => toTeam('Next')} />
          )}
        </>
      ) : step === 'team' ? (
        <>
          <ChatBubble from="ai" text={t(L.team)} />
          <PeopleForm
            t={t}
            showSubHeads={isHead}
            subHeads={subHeads}
            setSubHeads={setSubHeads}
            members={members}
            setMembers={setMembers}
            groupLink={groupLink}
            setGroupLink={setGroupLink}
          />
          <Button
            title={t('Create invites')}
            icon="💌"
            disabled={nothingToInvite}
            loading={busy === 'invites'}
            onPress={createInvites}
          />
          <Button title={t("Skip — I'll invite later")} variant="ghost" loading={busy === 'finish'} onPress={finish} />
        </>
      ) : (
        <>
          <ChatBubble from="ai" text={t(invites.length ? L.invites : L.noInvites)} />
          <InviteList t={t} invites={invites} wedding={wedding.name} inviter={member.display_name} />
          <Button title={t('Finish')} icon="✓" loading={busy === 'finish'} onPress={finish} />
        </>
      )}

      {err ? <ErrorBubble t={t} msg={err.msg} onRetry={retry} /> : null}
    </Screen>
  );
}

/**
 * Turn English AI lines into speakable lines. A line is ready once its translation has arrived
 * (or right away in English); if translation never comes, it is spoken as is after 3 s.
 * Keys: history lines use their English text, so a line already spoken in the step is not repeated
 * when it moves into the history.
 */
function useTranslatedLines(t: T, lang: string, rows: { key: string; en: string; extra?: string }[]): SpeakLine[] {
  const base = rows.map((r) => {
    const text = t(r.en);
    const tail = r.extra ? ` ${t(r.extra)}` : '';
    return { key: r.key, text: text + tail, ready: lang === 'en-IN' || text !== r.en };
  });
  const pendingKey = base
    .filter((l) => !l.ready)
    .map((l) => l.key)
    .join('\u0001');
  const [graced, setGraced] = useState('');
  useEffect(() => {
    if (!pendingKey) return;
    const id = setTimeout(() => setGraced(pendingKey), 3000);
    return () => clearTimeout(id);
  }, [pendingKey]);
  const gracedSet = new Set(graced.split('\u0001'));
  const sig = base.map((l) => `${l.key}\u0002${l.text}\u0002${l.ready || gracedSet.has(l.key) ? 1 : 0}`).join('\u0001');
  // Stable array while nothing changed, so the speak effect does not re-run on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => base.map((l) => ({ ...l, ready: l.ready || gracedSet.has(l.key) })), [sig]);
}

/** "me" answers may carry a count suffix ("Added tasks: 3") — translate the label part. */
function translateAnswer(t: (en: string) => string, text: string) {
  const m = text.match(/^(.*?)(: \d+| \(\d+\))$/);
  return m ? t(m[1]) + m[2] : t(text);
}

function ErrorBubble({ t, msg, onRetry }: { t: (en: string) => string; msg: string; onRetry: () => void }) {
  return (
    <ChatBubble from="ai">
      <Txt variant="body">{t('Something went wrong:')}</Txt>
      <Txt variant="small" color={C.danger}>
        {msg}
      </Txt>
      <Button title={t('Try again')} size="sm" variant="secondary" inline onPress={onRetry} style={styles.retry} />
    </ChatBubble>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { alignItems: 'flex-end' },
  content: { gap: S.sm, paddingBottom: S.xxl },
  block: { alignSelf: 'stretch' },
  taskLine: { marginTop: 2 },
  retry: { marginTop: S.sm },
});
