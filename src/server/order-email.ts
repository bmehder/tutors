export type ConfirmedOrderEmailDetails = {
  id: string
  familyName: string
  customerEmail: string
  customerPhone: string
  packageHours: number
  totalCents: number
  timeZone: string
  sessions: readonly { student: string; subject: string; tutor: string; start: Date; meetingInstructions?: string }[]
}

export function orderEmails(order: ConfirmedOrderEmailDetails, adminEmail: string) {
  const reference = order.id.slice(0, 8).toUpperCase()
  const payment = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(order.totalCents / 100)
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: order.timeZone, dateStyle: 'full', timeStyle: 'short',
  })
  const meetingDetails = [...new Set(order.sessions.flatMap(session => {
    const instructions = session.meetingInstructions?.trim()
    return instructions ? [`${session.tutor}\n${instructions}`] : []
  }))]
  const summary = [
    `Order #${reference}`,
    `${order.packageHours}-hour tutoring package · ${payment} paid`,
    '',
    `Scheduled sessions (${order.timeZone.replaceAll('_', ' ')})`,
    ...order.sessions.map(session =>
      `${date.format(session.start)} · ${session.student} · ${session.subject} with ${session.tutor}`),
    ...(meetingDetails.length ? ['', 'How to join', meetingDetails.join('\n\n')] : []),
  ]
  return [
    {
      to: order.customerEmail,
      subject: `Your MyChristianTutors booking #${reference}`,
      text: [`Hi ${order.familyName},`, '', 'Your tutoring sessions are booked.', '', ...summary,
        '', 'Reply to this email if you have questions about your schedule.'].join('\n'),
      key: `order-confirmation/${order.id}/customer`,
    },
    {
      to: adminEmail,
      subject: `New paid tutoring order #${reference}`,
      text: [`Family contact: ${order.familyName}`, `Email: ${order.customerEmail}`,
        `Phone: ${order.customerPhone}`, '', ...summary].join('\n'),
      key: `order-confirmation/${order.id}/admin`,
    },
  ] as const
}

export type OutgoingEmail = {
  to: string
  subject: string
  text: string
  key: string
  replyTo?: string
}

export async function sendWithResend(
  config: { apiKey: string; from: string; replyTo: string },
  message: OutgoingEmail,
  request: typeof fetch = fetch,
) {
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': message.key,
    },
    body: JSON.stringify({
      from: config.from, to: [message.to], reply_to: message.replyTo ?? config.replyTo,
      subject: message.subject, text: message.text,
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`Resend email request failed (HTTP ${response.status}).`)
  const result = await response.json()
  if (typeof result.id !== 'string') throw new Error('Resend did not return an email ID.')
  return result.id as string
}
