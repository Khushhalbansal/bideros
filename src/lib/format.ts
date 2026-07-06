export function formatINR(amount: number | bigint | null | undefined): string {
  if (amount == null) return "₹0";
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function parseINR(input: string): number {
  // accept "1.5cr", "50l", "500000"
  const s = input.trim().toLowerCase().replace(/[₹,\s]/g, "");
  if (s.endsWith("cr")) return Math.round(parseFloat(s) * 10000000);
  if (s.endsWith("l")) return Math.round(parseFloat(s) * 100000);
  return Math.round(parseFloat(s) || 0);
}
