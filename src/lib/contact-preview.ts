export function renderContactPreview(
  root: ParentNode,
  draft: { recipient: string; subject: string; text: string },
) {
  const preview = root.querySelector<HTMLDetailsElement>('[data-message-preview]')!
  preview.querySelector('[data-preview-recipient]')!.textContent = draft.recipient
  preview.querySelector('[data-preview-subject]')!.textContent = draft.subject
  preview.querySelector('[data-preview-text]')!.textContent = draft.text
  preview.open = false
  preview.hidden = false
}
