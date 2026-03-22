import { Outlet, useLocation, Link } from 'react-router-dom'
import { useTheme } from '../../app/providers/ThemeProvider'
import { useToolkitStore } from '../../core/jobs/toolkit-store'
import { toolRegistry } from '../../core/plugins/registry'

export function AppLayout() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const recentToolId = useToolkitStore((state) => state.preferences.recentToolIds[0])
  const recentTool = toolRegistry.find((tool) => tool.id === recentToolId)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <nav className="navbar h-12 flex items-center justify-between px-10 border-b border-[var(--border-color)] bg-[var(--bg-surface)] sticky top-0 z-100">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '24px', height: '24px',
            background: 'var(--accent-primary)',
            borderRadius: '5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', fontSize: '13px', fontWeight: 700,
            color: '#ffffff', flexShrink: 0
          }}>U</div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Universal File Toolkit
          </span>
        </Link>
        <div className="flex items-center gap-6">
          {recentTool && location.pathname !== `/tools/${recentTool.id}` ? (
            <Link to={`/tools/${recentTool.id}`} className="resume-chip px-3 py-1 bg-[var(--accent-subtle)] text-[var(--accent-primary)] rounded-sm text-[9px] font-bold uppercase tracking-wider inline-flex items-center border border-[var(--accent-primary)] border-opacity-20">
              <span className="line-clamp-1">Resume {recentTool.name}</span>
            </Link>
          ) : null}
          <button
            className="theme-toggle w-8 h-8 flex items-center justify-center text-muted border border-[var(--border-color)] rounded-sm hover:bg-[var(--bg-elevated)] transition-all"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
        </div>
      </nav>
      <div key={location.pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  )
}
