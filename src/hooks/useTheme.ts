import { useCallback, useState } from 'react'

/**
 * Light / dark mode.
 * index.html applies the saved theme before first paint;
 * this hook just reads the current state and flips it.
 */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      try {
        localStorage.setItem('ee:theme', next ? 'dark' : 'light')
      } catch {
        // Ignore storage errors; the theme still applies for this visit.
      }
      return next
    })
  }, [])

  return { dark, toggle }
}
