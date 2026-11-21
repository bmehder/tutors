// Reconstructed Gleam orders and a return from Stripe reuse the same attempt.
// Store only a plan fingerprint and random ID, never the family's contact details.
const storageKey = 'mct-checkout-attempt'

export function checkoutAttempts(newId = () => crypto.randomUUID(), storage) {
  let current
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) ?? 'null')
    if (typeof saved?.requestId === 'string' && typeof saved?.signature === 'string') current = saved
  } catch { /* Storage may be blocked; in-memory retries still work. */ }
  return {
    async forPlan(plan) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(plan)))
      const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      if (current?.signature !== signature) current = { signature, requestId: newId() }
      try { storage?.setItem(storageKey, JSON.stringify(current)) } catch { /* Keep the in-memory identity. */ }
      return { ...plan, requestId: current.requestId }
    },
    expired(requestId) {
      if (current?.requestId === requestId) {
        current = undefined
        try { storage?.removeItem(storageKey) } catch { /* Storage may be blocked. */ }
      }
    },
  }
}
