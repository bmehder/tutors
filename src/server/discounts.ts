export function checkoutDiscount(
  subtotalCents: number,
  requested: boolean,
  settings: { paymentMode: 'sandbox' | 'mock' | 'live'; sandboxDiscountsEnabled: boolean },
): { kind: 'accepted'; amountCents: number } | { kind: 'unavailable'; message: string } {
  if (!requested) return { kind: 'accepted', amountCents: 0 }
  if (settings.paymentMode !== 'sandbox' || !settings.sandboxDiscountsEnabled)
    return { kind: 'unavailable', message: 'This test discount is not available. Remove the discount and try again.' }
  return { kind: 'accepted', amountCents: Math.floor(subtotalCents / 5) }
}
