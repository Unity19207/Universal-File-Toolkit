import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../common/Modal'
import { categoryMeta } from '../../core/plugins/categories'
import { useToolkitStore } from '../../core/jobs/toolkit-store'
import { toolRegistry } from '../../core/plugins/registry'

const CATEGORY_COLORS: Record<string, string> = {
  image: 'var(--cat-image)',
  pdf: 'var(--cat-pdf)',
  data: 'var(--cat-data)',
  text: 'var(--cat-text)',
  media: 'var(--cat-media)',
  developer: 'var(--cat-developer)',
  archive: 'var(--cat-archive)',
}

export function DashboardPage() {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const recentIds = useToolkitStore((state) => state.preferences.recentToolIds)
  const recentTools = useMemo(
    () => recentIds.map((toolId) => toolRegistry.find((tool) => tool.id === toolId)).filter(Boolean),
    [recentIds],
  )
  const recentToolsLimited = recentTools.slice(0, 3)
  const totalTools = toolRegistry.length

  return (
    <main className="min-h-[calc(100vh-48px)] bg-[var(--bg-base)]">
      {/* ── HERO ── */}
      <div className="dashboard-hero">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-eyebrow">Universal File Toolkit</div>
          <h1 className="hero-title">Precision systems for local file transformation.</h1>
          <p className="hero-sub">
            The professional suite for high-fidelity data operations. {totalTools} tools running entirely in your browser's secure memory.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-block">
            <span className="stat-num">{totalTools}</span>
            <span className="stat-lbl">tools</span>
          </div>
          <div className="stat-block">
            <span className="stat-num">{Object.keys(categoryMeta).length}</span>
            <span className="stat-lbl">categories</span>
          </div>
          <div className="stat-block">
            <span className="stat-num">0</span>
            <span className="stat-lbl">server-side</span>
          </div>
        </div>
      </div>

      {/* ── RECENT TOOLS ── */}
      {recentToolsLimited.length > 0 ? (
        <section className="recent-section">
          <h3 className="recent-label">Continue where you left off</h3>
          <div className="recent-strip">
            {recentToolsLimited.map((tool) => (
              <Link key={tool!.id} to={`/tools/${tool!.id}`} className="recent-chip">
                <span className="recent-chip-dot" style={{ background: CATEGORY_COLORS[tool!.category] || 'var(--accent-primary)' }} />
                <div className="recent-chip-content">
                  <div className="recent-chip-name">{tool!.name}</div>
                  <div className="recent-chip-desc">{tool!.description}</div>
                </div>
                <span className="recent-chip-arrow">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── PRIVACY BANNER ── */}
      <div style={{ padding: '20px 40px' }}>
        <div className="privacy-tip-banner" onClick={() => setShowPrivacyModal(true)} style={{ cursor: 'pointer' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase' as const,
            color: 'var(--accent-primary)', margin: 0
          }}>
            Privacy
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            All processing runs locally in your browser memory. Your files never leave this device.
          </p>
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <div style={{ padding: '0 40px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
          Tool categories
        </h2>
        <Link to="/category/data" className="text-[12px] font-bold text-[var(--accent-primary)] hover:underline">
          Explore by domain →
        </Link>
      </div>
      <div className="category-grid">
        {Object.entries(categoryMeta).map(([key, category]) => {
          const tools = toolRegistry.filter((tool) => tool.category === key)
          if (!tools.length) return null
          const catColor = CATEGORY_COLORS[key] || 'var(--accent-primary)'
          return (
            <Link
              key={key}
              to={`/category/${key}`}
              className="category-card"
              style={{ '--cat-color': catColor } as React.CSSProperties}
            >
              <div className="category-card-header">
                <span className="category-name">{category.title}</span>
                <span className="category-count">{tools.length} tools</span>
              </div>
              <p className="category-desc">{category.description}</p>
              <span className="category-explore">→ Explore</span>
            </Link>
          )
        })}
      </div>

      <Modal
        open={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Privacy model"
        description="How this app handles files and processing"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          <p>All file transformations run in browser memory using Canvas, WebAssembly workers, and local JavaScript modules.</p>
          <p>Generated outputs are only available as direct downloads. File bytes are not persisted in local storage.</p>
          <p>Only non-sensitive preferences, such as recent tool IDs and theme selection, are stored locally.</p>
        </div>
      </Modal>
    </main>
  )
}
