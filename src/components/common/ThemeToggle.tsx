import { Button } from './Button'
import { useTheme } from '../../app/providers/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button tone="secondary" size="sm" onClick={toggleTheme} aria-label="Toggle color theme">
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </Button>
  )
}
