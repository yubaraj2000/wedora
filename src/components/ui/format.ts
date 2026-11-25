/** Format a number as Indian rupees with Indian digit grouping: 1800000 -> '₹18,00,000'. */
export function formatINR(n: number, opts: { decimals?: number } = {}): string {
  if (!Number.isFinite(n)) return '₹0';
  const decimals = opts.decimals ?? 0;
  const negative = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length) groups.unshift(rest);
    grouped = `${groups.join(',')},${last3}`;
  }
  return `${negative ? '-' : ''}₹${grouped}${fracPart ? `.${fracPart}` : ''}`;
}
