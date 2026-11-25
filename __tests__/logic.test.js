/**
 * Pure-logic unit tests — no React, no Expo, no network.
 * Functions are copy-extracted from source; this tests the logic as-is.
 */

// ─────────────────────────────────────────────
// 1. parseIndianAmount  (from supabase/functions/wedora/index.ts)
// ─────────────────────────────────────────────
const DIGITS = {};
["०१२३४५६७८९", "০১২৩৪৫৬৭৮৯", "୦୧୨୩୪୫୬୭୮୯"].forEach((set) =>
  [...set].forEach((ch, i) => (DIGITS[ch] = String(i)))
);

function parseIndianAmount(input) {
  if (/^\s*-/.test(input)) return null;
  let s = [...input].map((ch) => DIGITS[ch] ?? ch).join("").toLowerCase().replace(/(\d),(?=\d)/g, "$1").replace(/₹/g, " ");
  s = s.replace(/rs\.?|rupees?|रुपये|रुपए|টাকা|ଟଙ୍କା/g, " ");
  const units = [
    [/(\bcrore\b|\bcr\b|(?<=\s|^)करोड़(?=\s|$)|(?<=\s|^)करोड(?=\s|$)|(?<=\s|^)কোটি(?=\s|$)|(?<=\s|^)କୋଟି(?=\s|$))/, 1e7],
    [/(lakh|lac|lakhs|लाख|লাখ|লক্ষ|ଲକ୍ଷ)/, 1e5],
    [/(thousand|hazaar|hazar|k\b|हज़ार|हजार|হাজার|ହଜାର)/, 1e3],
  ];
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  let value = parseFloat(num[1]);
  const after = s.slice(s.indexOf(num[1]) + num[1].length);
  for (const [re, mult] of units) {
    if (re.test(after)) { value *= mult; break; }
  }
  const n = Math.round(value);
  return n > 0 && n <= 1e9 ? n : null;
}

describe('parseIndianAmount', () => {
  // Happy-path: plain numbers
  test('plain integer', () => expect(parseIndianAmount('12000')).toBe(12000));
  test('with ₹ prefix', () => expect(parseIndianAmount('₹12000')).toBe(12000));
  test('with comma separators', () => expect(parseIndianAmount('1,20,000')).toBe(120000));
  test('with "Rs." prefix', () => expect(parseIndianAmount('Rs. 500')).toBe(500));
  test('with "rupees"', () => expect(parseIndianAmount('500 rupees')).toBe(500));

  // Lakh variants
  test('lakh', () => expect(parseIndianAmount('18 lakh')).toBe(1800000));
  test('lakhs', () => expect(parseIndianAmount('2 lakhs')).toBe(200000));
  test('lac', () => expect(parseIndianAmount('1.5 lac')).toBe(150000));
  test('Hindi लाख', () => expect(parseIndianAmount('18 लाख')).toBe(1800000));
  test('Bengali লাখ', () => expect(parseIndianAmount('18 লাখ')).toBe(1800000));
  test('Bengali লক্ষ', () => expect(parseIndianAmount('1 লক্ষ')).toBe(100000));
  test('Odia ଲକ୍ଷ', () => expect(parseIndianAmount('1 ଲକ୍ଷ')).toBe(100000));

  // Crore variants
  test('crore', () => expect(parseIndianAmount('1 crore')).toBe(10000000));
  test('cr', () => expect(parseIndianAmount('2 cr')).toBe(20000000));
  test('Hindi करोड़', () => expect(parseIndianAmount('1 करोड़')).toBe(10000000));
  test('Bengali কোটি', () => expect(parseIndianAmount('1 কোটি')).toBe(10000000));
  test('Odia କୋଟି', () => expect(parseIndianAmount('1 କୋଟି')).toBe(10000000));

  // Thousand variants
  test('k shorthand', () => expect(parseIndianAmount('12k')).toBe(12000));
  test('hazaar', () => expect(parseIndianAmount('12 hazaar')).toBe(12000));
  test('hazar', () => expect(parseIndianAmount('5 hazar')).toBe(5000));
  test('Hindi हज़ार', () => expect(parseIndianAmount('12 हज़ार')).toBe(12000));
  test('Bengali হাজার', () => expect(parseIndianAmount('12 হাজার')).toBe(12000));
  test('Odia ହଜାର', () => expect(parseIndianAmount('12 ହଜାର')).toBe(12000));

  // Devanagari/Bengali/Odia digit remapping
  test('Devanagari digits ९९ लाख', () => expect(parseIndianAmount('९९ लाख')).toBe(9900000));
  test('Bengali digits ১২০০০', () => expect(parseIndianAmount('১২০০০')).toBe(12000));
  test('Odia digits ୧୨୦୦୦', () => expect(parseIndianAmount('୧୨୦୦୦')).toBe(12000));
  test('Odia with टाका', () => expect(parseIndianAmount('1200 ଟଙ୍କା')).toBe(1200));
  test('Bengali টাকা', () => expect(parseIndianAmount('1200 টাকা')).toBe(1200));

  // Edge: boundary values
  test('₹1 (minimum positive)', () => expect(parseIndianAmount('1')).toBe(1));
  test('₹1,000,000,000 (max = 1e9)', () => expect(parseIndianAmount('1000000000')).toBe(1000000000));
  test('₹1,000,000,001 (over max → null)', () => expect(parseIndianAmount('1000000001')).toBeNull());
  test('10 crore = 1e8 (within range)', () => expect(parseIndianAmount('10 crore')).toBe(100000000));
  test('100 crore = 1e9 (at boundary)', () => expect(parseIndianAmount('100 crore')).toBe(1000000000));
  test('101 crore → null (over boundary)', () => expect(parseIndianAmount('101 crore')).toBeNull());

  // Edge: zero and negatives
  test('0 → null', () => expect(parseIndianAmount('0')).toBeNull());
  test('-500 → null', () => expect(parseIndianAmount('-500')).toBeNull());

  // Edge: non-numeric input
  test('empty string → null', () => expect(parseIndianAmount('')).toBeNull());
  test('no number → null', () => expect(parseIndianAmount('something')).toBeNull());
  test('alphabetic text → null', () => expect(parseIndianAmount('abc lakh')).toBeNull());

  // Edge: float inputs
  test('1.5 lakh = 150000', () => expect(parseIndianAmount('1.5 lakh')).toBe(150000));
  test('2.5 crore = 25000000', () => expect(parseIndianAmount('2.5 crore')).toBe(25000000));

  test('negative with space "- 500" → null', () => expect(parseIndianAmount('- 500')).toBeNull());

  // Injection-style inputs
  test('SQL fragment in amount field', () => expect(parseIndianAmount("'; DROP TABLE expenses;--")).toBeNull());
  // <script>alert(1)</script> — the "1" in alert(1) is parsed as ₹1; "cr" in script no longer triggers crore.
  // This is benign: ₹1 is a valid amount; actual security enforced by DB check constraint (amount <= 10000000).
  test('script tag returns 1 (not 10000000); cr word-boundary fix confirmed', () => expect(parseIndianAmount('<script>alert(1)</script>')).toBe(1));
  test('"credit 5000" → 5000 (cr in credit no longer triggers crore)', () => expect(parseIndianAmount('credit 5000')).toBe(5000));
  test('"5 cr" → 50000000 (standalone cr still works)', () => expect(parseIndianAmount('5 cr')).toBe(50000000));
});

// ─────────────────────────────────────────────
// 2. parseCeremonies  (from src/features/onboarding/model.ts)
// ─────────────────────────────────────────────
function parseCeremonies(v) {
  let arr = v;
  if (typeof v === 'string') {
    try { arr = JSON.parse(v); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => !!c && typeof c === 'object' && typeof c.key === 'string' && typeof c.en === 'string')
    .map((c) => ({ key: c.key, en: c.en, local: c.local || c.en, note: c.note }));
}

describe('parseCeremonies', () => {
  test('valid array', () => {
    const r = parseCeremonies([{ key: 'haldi', en: 'Haldi', local: 'Haldi' }]);
    expect(r).toHaveLength(1);
    expect(r[0].key).toBe('haldi');
  });
  test('valid JSON string', () => {
    const r = parseCeremonies('[{"key":"mehendi","en":"Mehendi","local":"Mehendi"}]');
    expect(r).toHaveLength(1);
  });
  test('missing local → falls back to en', () => {
    const r = parseCeremonies([{ key: 'sangeet', en: 'Sangeet' }]);
    expect(r[0].local).toBe('Sangeet');
  });
  test('invalid JSON string → empty', () => expect(parseCeremonies('not-json')).toEqual([]));
  test('null → empty', () => expect(parseCeremonies(null)).toEqual([]));
  test('undefined → empty', () => expect(parseCeremonies(undefined)).toEqual([]));
  test('number → empty', () => expect(parseCeremonies(42)).toEqual([]));
  test('empty array → empty', () => expect(parseCeremonies([])).toEqual([]));
  test('filters out items without key', () => {
    const r = parseCeremonies([{ en: 'No key' }, { key: 'k', en: 'Good' }]);
    expect(r).toHaveLength(1);
  });
  test('filters out items without en', () => {
    const r = parseCeremonies([{ key: 'k' }, { key: 'k2', en: 'Good' }]);
    expect(r).toHaveLength(1);
  });
  test('note is preserved when present', () => {
    const r = parseCeremonies([{ key: 'k', en: 'E', note: 'optional' }]);
    expect(r[0].note).toBe('optional');
  });
  test('note is undefined when absent', () => {
    const r = parseCeremonies([{ key: 'k', en: 'E' }]);
    expect(r[0].note).toBeUndefined();
  });
  // Nasty: injection in key/en
  test('XSS in key field — passes through (sanitisation is DB responsibility)', () => {
    const r = parseCeremonies([{ key: '<script>', en: 'XSS' }]);
    expect(r[0].key).toBe('<script>'); // parser does not sanitise; server DB clips/stores
  });
});

// ─────────────────────────────────────────────
// 3. slug  (from src/features/onboarding/model.ts)
// ─────────────────────────────────────────────
function slug(s) {
  const out = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return out || `custom_${Date.now().toString(36)}`;
}

describe('slug', () => {
  test('simple English word', () => expect(slug('Haldi')).toBe('haldi'));
  test('two words', () => expect(slug('Wedding Ceremony')).toBe('wedding_ceremony'));
  test('special chars stripped', () => expect(slug("Let's go!")).toBe('let_s_go'));
  test('leading/trailing underscores trimmed', () => expect(slug('  wedding  ')).toBe('wedding'));
  test('numbers preserved', () => expect(slug('Day 2')).toBe('day_2'));
  test('multiple spaces → single underscore', () => expect(slug('a   b')).toBe('a_b'));
  test('all special → fallback custom_<ts>', () => {
    const r = slug('!!!');
    expect(r).toMatch(/^custom_/);
  });
  test('empty string → fallback', () => expect(slug('')).toMatch(/^custom_/));
  // ⚠️  SUSPECTED ISSUE: Odia/Hindi/Bengali text → strips to empty → fallback
  // The key won't be human-readable, but it's functionally OK (unique).
  test('non-ASCII (Odia) → fallback custom_<ts>', () => {
    const r = slug('ବିବାହ'); // Odia "wedding"
    expect(r).toMatch(/^custom_/);
  });
  test('SQL injection → safe slug', () => expect(slug("'; DROP TABLE")).toBe('drop_table'));
});

// ─────────────────────────────────────────────
// 4. isDate  (from src/features/onboarding/model.ts)
// ─────────────────────────────────────────────
const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const d = new Date(s.trim() + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  const [y, m, day] = s.trim().split('-').map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
};

describe('isDate', () => {
  test('valid date', () => expect(isDate('2026-11-25')).toBe(true));
  test('with leading space', () => expect(isDate(' 2026-11-25')).toBe(true));
  test('wrong separator', () => expect(isDate('2026/11/25')).toBe(false));
  test('DD-MM-YYYY → false', () => expect(isDate('25-11-2026')).toBe(false));
  test('empty → false', () => expect(isDate('')).toBe(false));
  test('text → false', () => expect(isDate('next saturday')).toBe(false));
  // Calendar validity is now also checked
  test('invalid calendar date rejected (Feb 30)', () => expect(isDate('2026-02-30')).toBe(false));
  test('month 13 rejected', () => expect(isDate('2026-13-01')).toBe(false));
  test('valid leap day passes', () => expect(isDate('2024-02-29')).toBe(true));
  test('invalid leap day rejected (non-leap year)', () => expect(isDate('2026-02-29')).toBe(false));
});

// ─────────────────────────────────────────────
// 5. normalizePhone  (from src/lib/invite.ts)
// ─────────────────────────────────────────────
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

describe('normalizePhone', () => {
  test('10-digit Indian mobile', () => expect(normalizePhone('9876543210')).toBe('919876543210'));
  test('10-digit with spaces', () => expect(normalizePhone('98765 43210')).toBe('919876543210'));
  test('10-digit with dashes', () => expect(normalizePhone('98765-43210')).toBe('919876543210'));
  test('11-digit with leading 0', () => expect(normalizePhone('09876543210')).toBe('919876543210'));
  test('already has 91 prefix (12 digits)', () => expect(normalizePhone('919876543210')).toBe('919876543210'));
  test('international +91', () => expect(normalizePhone('+919876543210')).toBe('919876543210'));
  test('empty string → empty', () => expect(normalizePhone('')).toBe(''));
  test('no digits → empty', () => expect(normalizePhone('no phone here')).toBe(''));
  // ⚠️  SUSPECTED ISSUE: 11-digit NOT starting with 0 (e.g. a +1 US number stripped of +)
  test('11-digit US number stripped (not 0-prefix) → returned as-is', () => {
    const r = normalizePhone('19876543210'); // US +1 number
    expect(r).toBe('19876543210'); // passes through; no 91 prepended
  });
  // ⚠️  SUSPECTED ISSUE: a 10-digit number that is actually a WhatsApp group ID or non-mobile
  test('10-digit always gets 91 prefix regardless of number validity', () => {
    expect(normalizePhone('1234567890')).toBe('911234567890');
  });
});

// ─────────────────────────────────────────────
// 6. logic.ts pure helpers
// ─────────────────────────────────────────────
function myDeptScope(m, depts) {
  const s = new Set();
  if (!m.department_id) return s;
  s.add(m.department_id);
  if (m.role === 'head') for (const d of depts) if (d.parent_id === m.department_id) s.add(d.id);
  return s;
}

function canDecide(m, e) {
  if (e.status !== 'pending' || e.submitted_by === m.id) return false;
  return e.approver_id === m.id || m.role === 'admin';
}

function canChangeTask(m, t, depts) {
  if (m.role === 'admin' || t.assigned_to === m.id) return true;
  return (m.role !== 'member') && myDeptScope(m, depts).has(t.department_id);
}

function inviteRoles(m, d) {
  if (!d) return [];
  const major = d.parent_id === null;
  if (m.role === 'admin') return major ? ['head', 'member'] : ['sub_head', 'member'];
  if (m.role === 'head') return major ? ['member'] : ['sub_head', 'member'];
  if (m.role === 'sub_head') return d.id === m.department_id ? ['member'] : [];
  return [];
}

const DEPT_A = { id: 'dept-a', wedding_id: 'w1', parent_id: null, is_finance: false, sort: 0, name: 'Finance' };
const DEPT_B = { id: 'dept-b', wedding_id: 'w1', parent_id: 'dept-a', is_finance: false, sort: 1, name: 'Finance Sub' };
const DEPT_C = { id: 'dept-c', wedding_id: 'w1', parent_id: null, is_finance: false, sort: 2, name: 'Logistics' };
const ALL_DEPTS = [DEPT_A, DEPT_B, DEPT_C];

const ADMIN = { id: 'm-admin', role: 'admin', department_id: null };
const HEAD_A = { id: 'm-head-a', role: 'head', department_id: 'dept-a' };
const SUB_A = { id: 'm-sub-a', role: 'sub_head', department_id: 'dept-b' };
const MEMBER_A = { id: 'm-member', role: 'member', department_id: 'dept-b' };

describe('myDeptScope', () => {
  test('admin with no dept → empty scope', () => expect(myDeptScope(ADMIN, ALL_DEPTS).size).toBe(0));
  test('head sees own dept + sub-teams', () => {
    const s = myDeptScope(HEAD_A, ALL_DEPTS);
    expect(s.has('dept-a')).toBe(true);
    expect(s.has('dept-b')).toBe(true);
    expect(s.has('dept-c')).toBe(false);
  });
  test('sub-head sees only own dept', () => {
    const s = myDeptScope(SUB_A, ALL_DEPTS);
    expect(s.has('dept-b')).toBe(true);
    expect(s.has('dept-a')).toBe(false);
  });
  test('member sees only own dept', () => {
    const s = myDeptScope(MEMBER_A, ALL_DEPTS);
    expect(s.has('dept-b')).toBe(true);
    expect(s.size).toBe(1);
  });
});

describe('canDecide', () => {
  const pending = { id: 'e1', status: 'pending', submitted_by: 'm-member', approver_id: 'm-head-a' };
  const approved = { ...pending, status: 'approved' };
  const ownExpense = { ...pending, submitted_by: 'm-head-a' };

  test('assigned approver can decide', () => expect(canDecide(HEAD_A, pending)).toBe(true));
  test('admin can always decide (unless own)', () => expect(canDecide(ADMIN, pending)).toBe(true));
  test('wrong member cannot decide', () => expect(canDecide(SUB_A, pending)).toBe(false));
  test('already decided → cannot decide again', () => expect(canDecide(HEAD_A, approved)).toBe(false));
  test('submitter cannot approve own expense', () => expect(canDecide({ ...HEAD_A, id: 'm-member' }, { ...pending, approver_id: 'm-member' })).toBe(false));
  // ⚠️  SUSPECTED ISSUE: admin who also submitted cannot decide (submitted_by check)
  test('admin who submitted cannot decide own expense', () => {
    const adminOwnExpense = { ...pending, submitted_by: 'm-admin', approver_id: 'm-head-a' };
    expect(canDecide(ADMIN, adminOwnExpense)).toBe(false);
  });
});

describe('canChangeTask', () => {
  const task = { id: 't1', department_id: 'dept-b', assigned_to: null, status: 'pending' };
  const myTask = { ...task, assigned_to: 'm-member' };

  test('admin can change any task', () => expect(canChangeTask(ADMIN, task, ALL_DEPTS)).toBe(true));
  test('assigned member can change their task', () => expect(canChangeTask(MEMBER_A, myTask, ALL_DEPTS)).toBe(true));
  test('member with no assignment cannot change', () => expect(canChangeTask(MEMBER_A, task, ALL_DEPTS)).toBe(false));
  test('head can change task in own dept scope', () => expect(canChangeTask(HEAD_A, task, ALL_DEPTS)).toBe(true));
  test('head cannot change task in other dept', () => {
    const otherTask = { ...task, department_id: 'dept-c' };
    expect(canChangeTask(HEAD_A, otherTask, ALL_DEPTS)).toBe(false);
  });
});

describe('inviteRoles', () => {
  test('admin inviting to major dept → head,member', () => expect(inviteRoles(ADMIN, DEPT_A)).toEqual(['head', 'member']));
  test('admin inviting to sub-team → sub_head,member', () => expect(inviteRoles(ADMIN, DEPT_B)).toEqual(['sub_head', 'member']));
  test('head inviting to major dept → member only', () => expect(inviteRoles(HEAD_A, DEPT_A)).toEqual(['member']));
  test('head inviting to sub-team → sub_head,member', () => expect(inviteRoles(HEAD_A, DEPT_B)).toEqual(['sub_head', 'member']));
  test('sub-head inviting to own dept → member', () => expect(inviteRoles(SUB_A, DEPT_B)).toEqual(['member']));
  test('sub-head inviting to different dept → empty', () => expect(inviteRoles(SUB_A, DEPT_C)).toEqual([]));
  test('member cannot invite → empty', () => expect(inviteRoles(MEMBER_A, DEPT_B)).toEqual([]));
  test('no dept → empty', () => expect(inviteRoles(ADMIN, undefined)).toEqual([]));

  // ⚠️  SUSPECTED ISSUE: head invited to major dept can NOT invite another head (inviteRoles returns ['member'])
  // but create_invite server function DOES allow heads in major depts - UI correctly prevents it
  test('head cannot invite another head to major dept via inviteRoles', () => {
    expect(inviteRoles(HEAD_A, DEPT_A)).not.toContain('head');
  });
});

// ─────────────────────────────────────────────
// 7. routeReason display logic  (from src/features/home/logic.ts)
// ─────────────────────────────────────────────
function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
const LEVEL_LABEL = { admin: 'Admin', head: 'Head', sub_head: 'Sub-head', member: 'Member', finance: 'Finance' };
function routeReason(e, members) {
  const sub = e.limits_used?.sub_head;
  const head = e.limits_used?.head;
  const hasLimits = sub != null || head != null;
  const amt = formatINR(Number(e.amount));
  const who = e.approver_id ? members[e.approver_id]?.display_name : null;
  const to = `${LEVEL_LABEL[e.approval_level] ?? e.approval_level}${who ? ` (${who})` : ''}`;
  let why;
  if (e.approval_level === 'sub_head' && sub != null) why = `${amt} ≤ ${formatINR(sub)} sub-head limit`;
  else if (e.approval_level === 'head' && sub != null) why = `${amt} > ${formatINR(sub)} sub-head limit`;
  else if ((e.approval_level === 'finance' || e.approval_level === 'admin') && head != null)
    why = `${amt} > ${formatINR(head)} head limit`;
  else why = amt;
  return `${why} → ${to}${hasLimits ? ' (limits from Flagsmith)' : ''}`;
}

describe('routeReason', () => {
  const members = { 'm-head': { display_name: 'Rajan' } };
  const base = { approver_id: 'm-head', limits_used: { sub_head: 5000, head: 25000 } };

  test('sub_head route: amount ≤ sub limit', () => {
    const r = routeReason({ ...base, amount: 3000, approval_level: 'sub_head' }, members);
    expect(r).toContain('≤');
    expect(r).toContain('Sub-head');
    expect(r).toContain('Rajan');
  });
  test('head route: amount > sub limit', () => {
    const r = routeReason({ ...base, amount: 10000, approval_level: 'head' }, members);
    expect(r).toContain('>');
    expect(r).toContain('Head');
  });
  test('finance route: amount > head limit', () => {
    const r = routeReason({ ...base, amount: 50000, approval_level: 'finance' }, members);
    expect(r).toContain('head limit');
    expect(r).toContain('Finance');
  });
  test('missing limits_used → no "limits from Flagsmith" suffix', () => {
    const r = routeReason({ ...base, amount: 5000, approval_level: 'sub_head', limits_used: {} }, members);
    expect(r).not.toContain('limits from Flagsmith');
  });
  test('unknown approver_id → no name in output', () => {
    const r = routeReason({ ...base, amount: 3000, approval_level: 'sub_head', approver_id: 'unknown' }, members);
    expect(r).not.toContain('Rajan');
    expect(r).toContain('Sub-head');
  });
  test('null approver → no name', () => {
    const r = routeReason({ ...base, amount: 3000, approval_level: 'sub_head', approver_id: null }, {});
    expect(r).toContain('Sub-head');
  });
});
