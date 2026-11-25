// Seed a realistic demo wedding through the app's REAL, permission-checked paths
// (anonymous users, invites, RPCs and the wedora Edge Function) — no service key, no direct table writes.
// Usage: node --env-file=.env scripts/seed-demo.mjs <out.json>
// The illustrative Mohanty family: Priya & Rahul, Cuttack, 12 Dec 2026, budget ₹18 lakh.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const FN = `${URL}/functions/v1/wedora`;
const out = process.argv[2];

async function user(label) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`${label}: ${error.message}`);
  return { label, c, session: data.session, token: data.session.access_token };
}
const rpc = async (u, name, args) => {
  const { data, error } = await u.c.rpc(name, args);
  if (error) throw new Error(`${u.label} ${name}: ${error.message}`);
  return data;
};
const fn = async (u, body) => {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${u.label} ${body.op}: ${j.error}`);
  return j;
};
const log = (...a) => console.log(...a);

// ---------- admin + wedding ----------
const papa = await user('Papa');
const W = await rpc(papa, 'create_wedding', { p_name: 'Priya & Rahul', p_date: '2026-12-12', p_admin_name: 'Papa (Ramesh Mohanty)', p_language: 'od-IN' });
await rpc(papa, 'update_wedding_details', { p_wedding: W, p_bride: 'Priya', p_groom: 'Rahul', p_date: '2026-12-12', p_city: 'Cuttack', p_budget: 1800000, p_language: 'od-IN' });
await rpc(papa, 'set_events', {
  p_wedding: W,
  p_events: [
    { key: 'nirbandha', en: 'Nirbandha', local: 'ନିର୍ବନ୍ଧ', date: '2026-11-28' },
    { key: 'mangana', en: 'Mangana', local: 'ମାଙ୍ଗଣ', date: '2026-12-10' },
    { key: 'diya_mangala', en: 'Diya Mangala', local: 'ଦିଅ ମଙ୍ଗଳା', date: '2026-12-11' },
    { key: 'barajatri', en: 'Barajatri', local: 'ବରଯାତ୍ରୀ', date: '2026-12-12' },
    { key: 'kanyadaan', en: 'Kanyadaan', local: 'କନ୍ୟାଦାନ', date: '2026-12-12' },
    { key: 'hatagranthi', en: 'Hatagranthi', local: 'ହାତଗଣ୍ଠି', date: '2026-12-12' },
    { key: 'chauthi', en: 'Chauthi', local: 'ଚଉଠି', date: '2026-12-15' },
  ],
});
const { data: depts } = await papa.c.from('departments').select('id, name').eq('wedding_id', W);
const D = Object.fromEntries(depts.map((d) => [d.name, d.id]));
log('wedding', W);

// ---------- heads (each joins through a personal single-use invite) ----------
const HEADS = [
  ['Finance', 'Bapa (Sanjay Mohanty)', 'od-IN'],
  ['Logistics', 'Chhotu (Amit)', 'hi-IN'],
  ['Food & Catering', 'Mausi (Sunita)', 'od-IN'],
  ['Decoration', 'Mamu (Subhash)', 'bn-IN'],
  ['Guest Management', 'Didi (Ananya)', 'en-IN'],
  ['Events & Ceremony', 'Bou (Mamata)', 'od-IN'],
];
const heads = {};
for (const [dept, name, lang] of HEADS) {
  const tok = await rpc(papa, 'create_invite', { p_department: D[dept], p_role: 'head', p_max_uses: 1, p_invitee_name: name, p_invitee_phone: null });
  const u = await user(name);
  await rpc(u, 'accept_invite', { p_token: tok, p_name: name, p_language: lang });
  await rpc(u, 'complete_onboarding', { p_wedding: W });
  heads[dept] = u;
}
log('heads joined', Object.keys(heads).length);

// ---------- Decoration sub-team "Flowers" with a sub-head, and members ----------
const mamu = heads['Decoration'];
const flowers = await rpc(mamu, 'create_minor_department', { p_parent: D['Decoration'], p_name: 'Flowers' });
const subTok = await rpc(mamu, 'create_invite', { p_department: flowers, p_role: 'sub_head', p_max_uses: 1, p_invitee_name: 'Bapi', p_invitee_phone: null });
const bapi = await user('Bapi');
await rpc(bapi, 'accept_invite', { p_token: subTok, p_name: 'Bapi', p_language: 'od-IN' });
await rpc(bapi, 'complete_onboarding', { p_wedding: W });

async function member(inviter, dept, name, lang) {
  const tok = await rpc(inviter, 'create_invite', { p_department: dept, p_role: 'member', p_max_uses: 1, p_invitee_name: name, p_invitee_phone: null });
  const u = await user(name);
  await rpc(u, 'accept_invite', { p_token: tok, p_name: name, p_language: lang });
  await rpc(u, 'complete_onboarding', { p_wedding: W });
  return u;
}
const rinku = await member(mamu, D['Decoration'], 'Rinku', 'od-IN');
const tuku = await member(bapi, flowers, 'Tuku', 'od-IN');
const lipi = await member(heads['Food & Catering'], D['Food & Catering'], 'Lipi', 'od-IN');
const raju = await member(heads['Logistics'], D['Logistics'], 'Raju', 'hi-IN');
const meera = await member(heads['Guest Management'], D['Guest Management'], 'Meera', 'en-IN');
// a group link with a few uses left (shows "uses 2/20" in the Team screen)
const groupTok = await rpc(mamu, 'create_invite', { p_department: D['Decoration'], p_role: 'member', p_max_uses: 20, p_invitee_name: null, p_invitee_phone: null });
await (async () => {
  const u = await user('Sonu');
  await rpc(u, 'accept_invite', { p_token: groupTok, p_name: 'Sonu', p_language: 'od-IN' });
  await rpc(u, 'complete_onboarding', { p_wedding: W });
})();
log('team built');

// ---------- tasks ----------
const T = (dept, title, event_key = '') => ({ department_id: D[dept], title, event_key });
await rpc(papa, 'create_tasks_bulk', {
  p_wedding: W,
  p_tasks: [
    T('Finance', 'Open a joint wedding account'),
    T('Finance', 'Pay caterer advance (40%)', 'barajatri'),
    T('Logistics', 'Book 2 buses for Barajatri', 'barajatri'),
    T('Logistics', 'Arrange guest rooms at Hotel Mayfair'),
    T('Food & Catering', 'Finalise Barajatri dinner menu', 'barajatri'),
    T('Food & Catering', 'Order sweets: rasagola and chhena poda', 'kanyadaan'),
    T('Decoration', 'Design mandap for Saptapadi', 'kanyadaan'),
    T('Decoration', 'Order marigold garlands for Mangana', 'mangana'),
    T('Guest Management', 'Send invitation cards to 450 guests', 'nirbandha'),
    T('Guest Management', 'Collect RSVPs from Kolkata relatives'),
    T('Events & Ceremony', 'Book the priest for Hatagranthi', 'hatagranthi'),
    T('Events & Ceremony', 'Arrange items for Diya Mangala puja', 'diya_mangala'),
  ],
});
// leaders assign specific work
await rpc(mamu, 'create_task', { p_department: D['Decoration'], p_title: 'Get tent and lighting quotes', p_assigned_to: (await papa.c.from('members').select('id').eq('wedding_id', W).eq('display_name', 'Rinku').single()).data.id, p_due: '2026-12-01', p_source: 'form' });
await rpc(bapi, 'create_task', { p_department: flowers, p_title: 'Buy jasmine strings for the bride', p_assigned_to: (await papa.c.from('members').select('id').eq('wedding_id', W).eq('display_name', 'Tuku').single()).data.id, p_due: '2026-12-11', p_source: 'form' });
// progress
const { data: tasks } = await papa.c.from('tasks').select('id, title').eq('wedding_id', W);
const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t.id]));
const setS = (title, s) => rpc(papa, 'update_task_status', { p_task: byTitle[title], p_status: s });
await setS('Open a joint wedding account', 'completed');
await setS('Send invitation cards to 450 guests', 'completed');
await setS('Book the priest for Hatagranthi', 'completed');
await setS('Book 2 buses for Barajatri', 'in_progress');
await setS('Finalise Barajatri dinner menu', 'in_progress');
await setS('Design mandap for Saptapadi', 'in_progress');
await setS('Collect RSVPs from Kolkata relatives', 'blocked');
log('tasks', tasks.length);

// ---------- expenses at every approval level (routed by the Flagsmith limits on the server) ----------
const spend = (u, amount, description, paid_to) => fn(u, { op: 'submit_expense', wedding_id: W, amount, description, paid_to, source: 'form' });
const decide = (u, e, ok, note) => rpc(u, 'decide_expense', { p_expense: e.expense.id, p_approve: ok, p_note: note ?? null });
const fin = heads['Finance'];

const e1 = await spend(tuku, 3500, 'Marigold and jasmine for Mangana', 'Cuttack flower market'); // → Bapi (sub-head)
await decide(bapi, e1, true);
const e2 = await spend(rinku, 18000, 'Mandap frame advance', 'Jagannath Tent House'); // → Mamu (head)
await decide(mamu, e2, true);
const e3 = await spend(lipi, 240000, 'Caterer advance, 40 percent', 'Maa Tarini Caterers'); // → Finance head
await decide(fin, e3, true);
const e4 = await spend(raju, 65000, 'Two buses for Barajatri', 'Kalinga Travels'); // → Finance head
await decide(fin, e4, true);
const e5 = await spend(meera, 9500, 'Invitation card printing', 'Shree Printers'); // → Didi (head)
await decide(heads['Guest Management'], e5, true);
const e6 = await spend(raju, 7800, 'Extra hotel room for Kolkata guests', 'Hotel Mayfair'); // → Chhotu
await decide(heads['Logistics'], e6, false, 'Use the rooms we already booked');
// still waiting (shown in approval inboxes and the dashboard's "waiting")
await spend(tuku, 2800, 'Banana leaves and mango leaves', 'Local vendor'); // → Bapi
await spend(lipi, 14500, 'Sweets order deposit', 'Kar Sweets'); // → Mausi
await spend(heads['Events & Ceremony'], 31000, 'Priest dakshina and puja items', 'Pandit Mishra'); // head → Finance
log('expenses seeded');

await rpc(papa, 'complete_onboarding', { p_wedding: W });

// sessions for the demo browsers (TEST accounts in this project; file kept private, never committed)
const pick = (u) => ({ label: u.label, session: u.session });
writeFileSync(out, JSON.stringify({ wedding: W, admin: pick(papa), mamu: pick(mamu), rinku: pick(rinku), finance: pick(fin), bapi: pick(bapi) }, null, 2), { mode: 0o600 });
log('done →', out);
