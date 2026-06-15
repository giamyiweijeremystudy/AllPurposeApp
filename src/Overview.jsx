// SVG illustrations keyed by tabler icon name — add more as you add pages
export const PAGE_ILLUSTRATIONS = {
  'ti-calendar': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="48" height="42" rx="6" fill="#c7d2fe"/>
      <rect x="8" y="14" width="48" height="14" rx="6" fill="#4f46e5"/>
      <rect x="8" y="22" width="48" height="6" fill="#4f46e5"/>
      <rect x="18" y="10" width="4" height="10" rx="2" fill="#4f46e5"/>
      <rect x="42" y="10" width="4" height="10" rx="2" fill="#4f46e5"/>
      <rect x="16" y="36" width="8" height="8" rx="2" fill="#4f46e5" opacity="0.7"/>
      <rect x="28" y="36" width="8" height="8" rx="2" fill="#4f46e5" opacity="0.4"/>
      <rect x="40" y="36" width="8" height="8" rx="2" fill="#4f46e5" opacity="0.2"/>
      <rect x="16" y="48" width="8" height="4" rx="2" fill="#4f46e5" opacity="0.4"/>
      <rect x="28" y="48" width="8" height="4" rx="2" fill="#4f46e5" opacity="0.7"/>
    </svg>
  ),
  'ti-folder': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 22c0-3.3 2.7-6 6-6h10l4 5h22c3.3 0 6 2.7 6 6v17c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V22z" fill="#fde68a"/>
      <path d="M8 27h48v18c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V27z" fill="#f59e0b"/>
      <rect x="20" y="35" width="24" height="3" rx="1.5" fill="white" opacity="0.6"/>
      <rect x="20" y="41" width="16" height="3" rx="1.5" fill="white" opacity="0.4"/>
    </svg>
  ),
  'ti-chart-bar': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#cffafe"/>
      <rect x="16" y="32" width="8" height="16" rx="2" fill="#0891b2"/>
      <rect x="28" y="22" width="8" height="26" rx="2" fill="#0891b2" opacity="0.7"/>
      <rect x="40" y="16" width="8" height="32" rx="2" fill="#0891b2" opacity="0.4"/>
    </svg>
  ),
  'ti-list': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#bbf7d0"/>
      <circle cx="20" cy="24" r="3" fill="#16a34a"/>
      <rect x="26" y="22" width="20" height="4" rx="2" fill="#16a34a" opacity="0.5"/>
      <circle cx="20" cy="34" r="3" fill="#16a34a"/>
      <rect x="26" y="32" width="20" height="4" rx="2" fill="#16a34a" opacity="0.5"/>
      <circle cx="20" cy="44" r="3" fill="#16a34a" opacity="0.4"/>
      <rect x="26" y="42" width="14" height="4" rx="2" fill="#16a34a" opacity="0.3"/>
    </svg>
  ),
  'ti-users': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#e9d5ff"/>
      <circle cx="26" cy="26" r="7" fill="#7c3aed"/>
      <path d="M12 48c0-8 6-13 14-13s14 5 14 13" fill="#7c3aed" opacity="0.5"/>
      <circle cx="42" cy="24" r="5" fill="#7c3aed" opacity="0.6"/>
      <path d="M34 48c0-6 4-10 10-10" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  'ti-settings': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#f1f5f9"/>
      <circle cx="32" cy="32" r="10" fill="none" stroke="#64748b" strokeWidth="3"/>
      <circle cx="32" cy="32" r="4" fill="#64748b"/>
      <rect x="30" y="12" width="4" height="6" rx="2" fill="#64748b"/>
      <rect x="30" y="46" width="4" height="6" rx="2" fill="#64748b"/>
      <rect x="12" y="30" width="6" height="4" rx="2" fill="#64748b"/>
      <rect x="46" y="30" width="6" height="4" rx="2" fill="#64748b"/>
    </svg>
  ),
  'ti-home': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#e0f2fe"/>
      <path d="M32 16L14 30h5v18h12V36h2v12h12V30h5L32 16z" fill="#0284c7"/>
    </svg>
  ),
  'ti-mail': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="48" height="32" rx="6" fill="#dbeafe"/>
      <path d="M8 22l24 15 24-15" stroke="#2563eb" strokeWidth="2.5" fill="none"/>
      <rect x="8" y="16" width="48" height="6" rx="3" fill="#2563eb" opacity="0.15"/>
    </svg>
  ),
  'ti-database': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="20" rx="18" ry="7" fill="#fca5a5"/>
      <path d="M14 20v8c0 3.9 8.1 7 18 7s18-3.1 18-7v-8" fill="#f87171"/>
      <path d="M14 28v8c0 3.9 8.1 7 18 7s18-3.1 18-7v-8" fill="#ef4444"/>
      <ellipse cx="32" cy="20" rx="18" ry="7" fill="none" stroke="#dc2626" strokeWidth="1.5"/>
    </svg>
  ),
  'ti-layout-grid': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="8" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="18" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="38" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="28" y="18" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="18" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="38" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="8" y="44" width="48" height="10" rx="2" fill="#ef444466"/>
    </svg>
  ),
  'ti-letter-w': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="#538d4e"/>
      <rect x="20" y="6" width="12" height="12" rx="2" fill="#b59f3b"/>
      <rect x="34" y="6" width="12" height="12" rx="2" fill="#538d4e"/>
      <rect x="48" y="6" width="12" height="12" rx="2" fill="#3a3a3c"/>
      <rect x="6" y="20" width="12" height="12" rx="2" fill="#3a3a3c"/>
      <rect x="20" y="20" width="12" height="12" rx="2" fill="#538d4e"/>
      <rect x="34" y="20" width="12" height="12" rx="2" fill="#b59f3b"/>
      <rect x="48" y="20" width="12" height="12" rx="2" fill="#3a3a3c"/>
      <rect x="6" y="34" width="12" height="12" rx="2" fill="var(--border-2)"/>
      <rect x="20" y="34" width="12" height="12" rx="2" fill="var(--border-2)"/>
      <rect x="34" y="34" width="12" height="12" rx="2" fill="var(--border-2)"/>
      <rect x="48" y="34" width="12" height="12" rx="2" fill="var(--border-2)"/>
    </svg>
  ),
  // fallback for unknown icons
  'default': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#f3f4f6"/>
      <rect x="20" y="24" width="24" height="4" rx="2" fill="#9ca3af"/>
      <rect x="20" y="32" width="18" height="4" rx="2" fill="#9ca3af" opacity="0.6"/>
      <rect x="20" y="40" width="12" height="4" rx="2" fill="#9ca3af" opacity="0.3"/>
    </svg>
  ),
}

// Accent colours keyed by icon
export const PAGE_COLORS = {
  'ti-calendar': '#4f46e5',
  'ti-folder':   '#d97706',
  'ti-chart-bar':'#0891b2',
  'ti-list':     '#16a34a',
  'ti-users':    '#7c3aed',
  'ti-settings': '#64748b',
  'ti-home':     '#0284c7',
  'ti-mail':     '#2563eb',
  'ti-database': '#dc2626',
  'ti-layout-grid': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="8" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="18" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="38" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="28" y="18" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="18" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="38" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="8" y="44" width="48" height="10" rx="2" fill="#ef444466"/>
    </svg>
  ),
  'ti-layout-grid': '#06b6d4',
  'ti-letter-w': '#538d4e',
  'default':     '#6b7280',
}

export const PAGE_BG = {
  'ti-calendar': '#eef2ff',
  'ti-folder':   '#fffbeb',
  'ti-chart-bar':'#ecfeff',
  'ti-list':     '#f0fdf4',
  'ti-users':    '#f5f3ff',
  'ti-settings': '#f8fafc',
  'ti-home':     '#e0f2fe',
  'ti-mail':     '#dbeafe',
  'ti-database': '#fef2f2',
  'ti-layout-grid': (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="8" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="18" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="20" width="10" height="10" rx="2" fill="#06b6d4"/>
      <rect x="28" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="38" y="8" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="28" y="18" width="10" height="10" rx="2" fill="#a855f7"/>
      <rect x="18" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="32" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="28" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="38" y="42" width="10" height="10" rx="2" fill="#22c55e"/>
      <rect x="8" y="44" width="48" height="10" rx="2" fill="#ef444466"/>
    </svg>
  ),
  'ti-layout-grid': '#ecfeff',
  'ti-letter-w': '#f0fdf4',
  'default':     '#f9fafb',
}

export function Overview({ navItems, sections, activeNavId, onNavigate }) {
  // All pages except Overview itself
  const otherPages = navItems.filter(i => i.id !== activeNavId)

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' })

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:22, fontWeight:600, color:'var(--text)' }}>{greeting}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{dateLabel}</div>
      </div>

      {/* Page cards grouped by section */}
      {sections.sort((a,b) => a.sort_order - b.sort_order).map(sec => {
        const pages = otherPages.filter(p => p.section_id === sec.id).sort((a,b) => a.sort_order - b.sort_order)
        if (pages.length === 0) return null
        return (
          <div key={sec.id} style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
              {sec.label}
            </div>
            <div className="overview-grid">
              {pages.map(page => {
                const color = PAGE_COLORS[page.icon] || PAGE_COLORS.default
                const bg    = PAGE_BG[page.icon]    || PAGE_BG.default
                const svg   = PAGE_ILLUSTRATIONS[page.icon] || PAGE_ILLUSTRATIONS.default
                return (
                  <button
                    key={page.id}
                    onClick={() => onNavigate(page.id)}
                    className="overview-card"
                    style={{ '--ov-color': color, '--ov-bg': bg }}
                  >
                    <div className="overview-card-img">{svg}</div>
                    <div className="overview-card-label">{page.label}</div>
                    {page.badge && (
                      <span className="overview-card-badge" style={{ background: color + '22', color }}>
                        {page.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
