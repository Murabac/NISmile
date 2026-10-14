import { useEffect, useState } from 'react'

const themeKey = 'dentaflow-theme'

export function useTheme() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(themeKey, isDark ? 'dark' : 'light')
  }, [isDark])

  return {
    isDark,
    toggle: () => setIsDark((current) => !current),
  }
}
