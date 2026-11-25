import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatINR, LANGS } from '@/components/ui';
import {
  completeOnboarding,
  createInvite,
  createTasksBulk,
  createWedding,
  getDepartments,
  parseBudget,
  parseWedding,
  setEvents,
  suggestTasks,
  updateWeddingDetails,
} from '@/lib/api';
import { inviteMessage, inviteUrl, openWhatsApp, pickContact } from '@/lib/invite';
import { sayNow } from '@/lib/say';
import type { Ceremony, Department, Lang } from '@/lib/types';
import { useFlagValue, useWedding } from '@/lib/wedding';

import {
  ceremonyTitle,
  EMPTY_DRAFT,
  errMsg,
  FALLBACK_CEREMONIES,
  isDate,
  parseCeremonies,
  slug,
  type CeremonyItem,
  type HeadDraft,
  type Msg,
  type SentInvite,
  type Step,
  type TaskItem,
  type WeddingDraft,
} from './model';

const Q = {
  greet: "Namaste! I'm Wedora. I'll help you set up your family's wedding. Which language should we talk in?",
  greetNative: 'ଆପଣ କେଉଁ ଭାଷାରେ କଥା ହେବେ? · आप किस भाषा में बात करेंगे? · আপনি কোন ভাষায় কথা বলবেন?',
  about: 'Tell me about the wedding — whose wedding is it, when, and where? And what is your name?',
  confirm: "Here's what I understood. Please check and fix anything that's wrong.",
  budget: 'What is the total budget?',
  budgetUnclear: 'Sorry, I could not understand the amount. Try something like "18 lakh".',
  budgetRight: 'Is that right?',
  ceremonies: "Which ceremonies are you planning? I've suggested the usual ones for your tradition — untick any you don't need.",
  ceremoniesNone: 'Please keep at least one ceremony.',
  tasks: 'Here are starter tasks for each department. Untick any you don\'t want.',
  tasksFailed: 'I could not suggest tasks right now.',
  heads: 'Who will head each department? Pick from your contacts or type a name and number.',
  invites: 'Send each head their personal link on WhatsApp.',
  noInvites: 'No heads chosen yet — you can invite people later from the dashboard.',
  resume: "Welcome back! Let's continue setting up your wedding.",
  error: "Sorry, that didn't work. Please try again.",
};

export function useAdminOnboarding() {
  const { ready, member, wedding, refresh } = useWedding();
  const suggestions = parseCeremonies(useFlagValue<unknown>('ceremony_suggestions', []));

  const [step, setStep] = useState<Step>('lang');
  const [lang, setLangState] = useState<Lang>('en-IN');
  const langRef = useRef<Lang>('en-IN');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const idRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [thinking, setThinking] = useState(false);
  const wRef = useRef<string | null>(null);

  const [aboutText, setAboutText] = useState('');
  const [draft, setDraft] = useState<WeddingDraft>(EMPTY_DRAFT);
  const [budgetText, setBudgetText] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [ceremonies, setCeremonies] = useState<CeremonyItem[]>([]);
  const [fromFlag, setFromFlag] = useState(false);
  const [customCeremony, setCustomCeremony] = useState('');
  const [events, setEventList] = useState<Ceremony[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [heads, setHeads] = useState<Record<string, HeadDraft>>({});
  const [invites, setInvites] = useState<SentInvite[]>([]);
  const invitesRef = useRef<SentInvite[]>([]);

  // ---------- chat helpers ----------
  const push = useCallback((from: Msg['from'], text: string) => {
    const id = ++idRef.current;
    setMsgs((m) => [...m, { id, from, text }]);
    return id;
  }, []);

  /** Add an AI line written in English; it is translated into the chosen language. */
  const ai = useCallback(
    async (en: string, opts: { prefix?: string; suffix?: string } = {}) => {
      const l = langRef.current;
      const wrap = (t: string) => `${opts.prefix ?? ''}${t}${opts.suffix ?? ''}`;
      if (l === 'en-IN') {
        push('ai', wrap(en));
        return;
      }
      const id = push('ai', '…');
      const t = await sayNow(l, en);
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: wrap(t) } : x)));
    },
    [push],
  );

  const fail = useCallback((e: unknown) => ai(Q.error, { suffix: `\n(${errMsg(e)})` }), [ai]);

  /** Run an async step with the spinner on; errors become an AI bubble (typed input is kept). */
  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        await fail(e);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fail],
  );

  const setLang = (l: Lang) => {
    langRef.current = l;
    setLangState(l);
  };

  const majors = useCallback(async () => {
    if (departments.length) return departments;
    const w = wRef.current;
    if (!w) throw new Error('No wedding yet');
    const ds = (await getDepartments(w)).filter((d) => !d.parent_id);
    setDepartments(ds);
    return ds;
  }, [departments]);

  // ---------- start / resume ----------
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (member?.role === 'admin' && !member.onboarding_done) {
      wRef.current = member.wedding_id;
      setLang(member.language);
      setStep('budget');
      (async () => {
        await ai(Q.resume, { suffix: wedding?.name ? ` (${wedding.name})` : '' });
        await ai(Q.budget);
      })();
      return;
    }
    push('ai', Q.greet);
    push('ai', Q.greetNative);
  }, [ready, member, wedding, ai, push]);

  // Flags can land a moment after the wedding is created: swap fallback suggestions for Flagsmith's.
  const suggestionsKey = suggestions.map((s) => s.key).join(',');
  useEffect(() => {
    if (step !== 'ceremonies' || fromFlag || !suggestions.length) return;
    setFromFlag(true);
    setCeremonies((cur) => [...suggestions.map((c) => ({ ...c, checked: true })), ...cur.filter((c) => c.custom)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fromFlag, suggestionsKey]);

  // ---------- step 1: language ----------
  const chooseLang = (l: Lang) => {
    if (busyRef.current) return;
    push('me', LANGS.find((x) => x.code === l)?.native ?? l);
    setLang(l);
    setStep('about');
    ai(Q.about);
  };

  // ---------- step 2: about the wedding ----------
  const sendAbout = () =>
    guard(async () => {
      const text = aboutText.trim();
      if (!text) return;
      const r = await parseWedding(text);
      push('me', text);
      setDraft({
        bride: r.bride ?? '',
        groom: r.groom ?? '',
        date: r.date ?? '',
        city: r.city ?? '',
        adminName: r.admin_name ?? '',
      });
      setStep('confirm');
      await ai(Q.confirm);
    });

  const confirmWedding = (label: string) =>
    guard(async () => {
      const d = {
        bride: draft.bride.trim(),
        groom: draft.groom.trim(),
        date: isDate(draft.date) ? draft.date.trim() : '',
        city: draft.city.trim(),
        adminName: draft.adminName.trim(),
      };
      let w = wRef.current;
      if (!w) {
        const name = d.bride || d.groom ? `${d.bride || '?'} & ${d.groom || '?'}` : 'Our Wedding';
        w = await createWedding(name, d.date || null, d.adminName || 'Admin', langRef.current);
        wRef.current = w;
        await refresh(w);
      }
      await updateWeddingDetails(w, {
        bride: d.bride || null,
        groom: d.groom || null,
        date: d.date || null,
        city: d.city || null,
        lang: langRef.current,
      });
      push('me', label);
      setStep('budget');
      await ai(Q.budget);
    });

  // ---------- step 3: budget ----------
  const sendBudget = () =>
    guard(async () => {
      const text = budgetText.trim();
      if (!text) return;
      const r = await parseBudget(text);
      push('me', text);
      if (r.budget == null || !Number.isFinite(r.budget)) {
        await ai(Q.budgetUnclear);
        return;
      }
      setBudget(r.budget);
      setStep('budgetConfirm');
      await ai(Q.budgetRight, { prefix: `${formatINR(r.budget)} — ` });
    });

  const changeBudget = () => setStep('budget');

  const confirmBudget = (label: string) =>
    guard(async () => {
      const w = wRef.current;
      if (!w || budget == null) return;
      await updateWeddingDetails(w, { budget });
      push('me', `${label} · ${formatINR(budget)}`);
      const base = suggestions.length ? suggestions : FALLBACK_CEREMONIES;
      setFromFlag(suggestions.length > 0);
      setCeremonies(base.map((c) => ({ ...c, checked: true })));
      setStep('ceremonies');
      await ai(Q.ceremonies);
    });

  // ---------- step 4: ceremonies ----------
  const toggleCeremony = (key: string) =>
    setCeremonies((cs) => cs.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c)));

  const addCeremony = () => {
    const t = customCeremony.trim();
    if (!t) return;
    let key = slug(t);
    if (ceremonies.some((c) => c.key === key)) key = `${key}_${ceremonies.length}`;
    setCeremonies((cs) => [...cs, { key, en: t, local: t, checked: true, custom: true }]);
    setCustomCeremony('');
  };

  const loadTasks = useCallback(
    async (evs: Ceremony[]) => {
      const w = wRef.current;
      if (!w) return;
      setThinking(true);
      setTaskError(null);
      try {
        const ds = await majors();
        const r = await suggestTasks(
          w,
          evs.map((e) => ({ key: e.key, en: e.en })),
          ds.map((d) => ({ id: d.id, name: d.name })),
          langRef.current,
        );
        setTasks((r.tasks ?? []).map((t, i) => ({ ...t, id: `${i}`, checked: true })));
      } catch (e) {
        setTaskError(errMsg(e));
        await ai(Q.tasksFailed, { suffix: `\n(${errMsg(e)})` });
      } finally {
        setThinking(false);
      }
    },
    [majors, ai],
  );

  const continueCeremonies = () =>
    guard(async () => {
      const w = wRef.current;
      if (!w) return;
      const sel = ceremonies.filter((c) => c.checked);
      if (!sel.length) {
        await ai(Q.ceremoniesNone);
        return;
      }
      const evs: Ceremony[] = sel.map(({ key, en, local, note }) => ({ key, en, local, note }));
      await setEvents(w, evs);
      setEventList(evs);
      push('me', sel.map(ceremonyTitle).join(', '));
      setTasks([]);
      setStep('tasks');
      await ai(Q.tasks);
      loadTasks(evs);
    });

  // ---------- step 5: tasks ----------
  const toggleTask = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t)));
  const retryTasks = () => loadTasks(events);

  const goHeads = async () => {
    await majors();
    setStep('heads');
    await ai(Q.heads);
  };

  const continueTasks = (label: string) =>
    guard(async () => {
      const w = wRef.current;
      if (!w) return;
      const picked = tasks.filter((t) => t.checked);
      if (picked.length) {
        await createTasksBulk(
          w,
          picked.map((t) => ({ department_id: t.department_id, title: t.title, event_key: t.event_key })),
        );
      }
      push('me', `${label} · ${picked.length} ✓`);
      setTasks([]);
      await goHeads();
    });

  const skipTasks = (label: string) =>
    guard(async () => {
      push('me', label);
      await goHeads();
    });

  // ---------- step 6: heads ----------
  const headOf = (id: string): HeadDraft => heads[id] ?? { name: '', phone: '', skip: false };
  const setHead = (id: string, patch: Partial<HeadDraft>) =>
    setHeads((h) => ({ ...h, [id]: { ...(h[id] ?? { name: '', phone: '', skip: false }), ...patch } }));

  const pickHead = async (id: string) => {
    try {
      const c = await pickContact();
      if (c) setHead(id, { name: c.name, phone: c.phone, skip: false });
    } catch (e) {
      await fail(e);
    }
  };

  const continueHeads = (label: string) =>
    guard(async () => {
      for (const d of departments) {
        const h = heads[d.id];
        if (!h || h.skip || !h.name.trim()) continue;
        if (invitesRef.current.some((i) => i.deptId === d.id)) continue; // already created (retry-safe)
        const name = h.name.trim();
        const phone = h.phone.trim();
        const token = await createInvite(d.id, 'head', { name, phone: phone || undefined });
        invitesRef.current = [...invitesRef.current, { deptId: d.id, dept: d.name, name, phone, token, sent: false }];
        setInvites(invitesRef.current);
      }
      push('me', `${label} · ${invitesRef.current.length}`);
      setStep('invites');
      await ai(invitesRef.current.length ? Q.invites : Q.noInvites);
    });

  // ---------- step 7: invites ----------
  const weddingName = wedding?.name ?? (draft.bride || draft.groom ? `${draft.bride} & ${draft.groom}` : 'our wedding');
  const inviter = member?.display_name ?? (draft.adminName || 'Family');

  const linkFor = (inv: SentInvite) => inviteUrl(inv.token);
  const sendInvite = async (inv: SentInvite) => {
    try {
      await openWhatsApp(
        inv.phone,
        inviteMessage({ name: inv.name, wedding: weddingName, department: inv.dept, role: 'head', inviter, url: linkFor(inv) }),
      );
      invitesRef.current = invitesRef.current.map((i) => (i.deptId === inv.deptId ? { ...i, sent: true } : i));
      setInvites(invitesRef.current);
    } catch (e) {
      await fail(e);
    }
  };

  const finish = () =>
    guard(async () => {
      const w = wRef.current;
      if (!w) return;
      await completeOnboarding(w);
      await refresh(w);
      router.replace('/home');
    });

  return {
    ready,
    step,
    lang,
    msgs,
    busy,
    thinking,
    fromFlag,
    // inputs
    aboutText,
    setAboutText,
    draft,
    setDraft,
    budgetText,
    setBudgetText,
    budget,
    ceremonies,
    customCeremony,
    setCustomCeremony,
    departments,
    tasks,
    taskError,
    invites,
    // actions
    chooseLang,
    sendAbout,
    confirmWedding,
    sendBudget,
    changeBudget,
    confirmBudget,
    toggleCeremony,
    addCeremony,
    continueCeremonies,
    toggleTask,
    retryTasks,
    continueTasks,
    skipTasks,
    headOf,
    setHead,
    pickHead,
    continueHeads,
    linkFor,
    sendInvite,
    finish,
  };
}

export type AdminOnboarding = ReturnType<typeof useAdminOnboarding>;
