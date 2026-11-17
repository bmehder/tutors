/// <reference types="astro/client" />
import { ActionError, defineAction } from 'astro:actions'
import { z } from 'astro/zod'
import { tutorHours } from '../server/tutor-hours'

const shortName = z.string().trim().min(1).max(120)
const optionalText = (max: number) => z.string().trim().max(max).optional()
const applicationFields = [
  ['subjects', 'Subjects'],
  ['grades', 'Grade levels'],
  ['experience', 'Teaching experience and qualifications'],
  ['availability', 'Availability and time zone'],
  ['approach', 'Approach to a Biblical worldview'],
] as const

export const server = {
  previewContact: defineAction({
    accept: 'form',
    input: z.object({
      'contact-type': z.enum(['family', 'tutor', 'tutor-inquiry']),
      'tutor-id': optionalText(120),
      'first-name': shortName,
      'last-name': shortName,
      email: z.string().trim().max(254).email(),
      phone: optionalText(40),
      message: optionalText(3000),
      subjects: optionalText(300),
      grades: optionalText(120),
      experience: optionalText(3000),
      availability: optionalText(1000),
      approach: optionalText(3000),
    }),
    async handler(input) {
      if (!import.meta.env.DEV) throw new ActionError({ code: 'NOT_FOUND' })
      const name = (input['first-name'] + ' ' + input['last-name']).replace(/\s+/g, ' ')
      const kind = input['contact-type']
      const phone = input.phone ?? ''
      if (kind !== 'tutor-inquiry' && !/^\(\d{3}\) \d{3}-\d{4}$/.test(phone))
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a 10-digit US or Canadian phone number.' })
      if (kind === 'tutor-inquiry' && phone) {
        const digits = phone.replace(/\D/g, '')
        if (!/^\+?[\d(). -]+$/.test(phone) || digits.length < 7 || digits.length > 15)
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a valid phone number or leave it blank.' })
      }

      let recipient = 'Admin inbox'
      let subject: string
      let sections: string[]
      if (kind === 'tutor') {
        if (applicationFields.some(([field]) => !input[field]))
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Complete the tutor application fields.' })
        subject = `Tutor application from ${name}`
        sections = applicationFields.map(([field, label]) => label + '\n' + input[field])
      } else {
        const message = input.message
        if (!message || (kind === 'tutor-inquiry' && message.length > 2000))
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a question within the form’s length limit.' })
        if (kind === 'tutor-inquiry') {
          const tutor = (await tutorHours()).find(item => item.id === input['tutor-id'])
          if (!tutor)
            throw new ActionError({ code: 'NOT_FOUND', message: 'This tutor is no longer available. Choose another tutor.' })
          recipient = tutor.name
          subject = `Tutoring inquiry for ${tutor.name.replace(/\s+/g, ' ')}`
        } else {
          subject = `Tutoring inquiry from ${name}`
        }
        sections = ['Question\n' + message]
      }

      // This draft is ready for an email provider once sender and recipient addresses exist.
      return {
        recipient,
        subject,
        replyTo: input.email,
        text: [`From: ${name}\nEmail: ${input.email}` + (phone ? `\nPhone: ${phone}` : ''), ...sections].join('\n\n'),
      }
    },
  }),
}
