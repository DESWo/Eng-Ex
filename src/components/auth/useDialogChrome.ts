import { useEffect, useRef, type RefObject } from 'react'

/**
 * The parts of a modal dialog the browser does not hand you for free.
 *
 * A div with role="dialog" still lets Tab walk out into the page behind it,
 * still lets a screen reader read that page, still scrolls it, and still drops
 * focus at the top of the document when it closes. This puts all four back:
 * focus stays inside the panel, the app behind it goes inert, the body stops
 * scrolling, and focus returns to whatever opened the dialog.
 *
 * Written by hand rather than pulled in as a dependency: it is one effect, and
 * the dialogs are the only modals in the app.
 */

/** Things a person can actually Tab to, in DOM order. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableIn = (panel: HTMLElement) =>
  Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // offsetParent skips display:none nodes, such as the hidden file input.
    (el) => el.offsetParent !== null || el === document.activeElement,
  )

export function useDialogChrome(
  open: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  // Held in a ref so a new inline onClose from the parent cannot re-run the
  // effect mid-dialog, which would yank focus out of whatever is being typed.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const app = document.getElementById('root')
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    // The dialogs render in a portal on <body>, so the whole app can go inert
    // without taking the dialog with it.
    app?.setAttribute('inert', '')
    app?.setAttribute('aria-hidden', 'true')
    // Focus the panel itself, not its first button: screen readers announce the
    // dialog, and each dialog is free to move focus somewhere better afterwards.
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const stops = focusableIn(panel)
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const active = document.activeElement
      const outside = !panel.contains(active)
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      app?.removeAttribute('inert')
      app?.removeAttribute('aria-hidden')
      opener?.focus?.()
    }
  }, [open, panelRef])
}
