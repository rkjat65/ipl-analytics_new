export default function Header({ onSidebarToggle }) {
  return (
    <header className="h-12 bg-bg-elevated border-b border-border-subtle flex items-center px-4 shrink-0 lg:hidden">
      {/* Mobile sidebar toggle — only visible on small screens */}
      <button
        onClick={onSidebarToggle}
        className="flex items-center justify-center w-10 h-10 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-white/[0.03]"
        aria-label="Toggle sidebar"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span className="font-heading font-bold text-text-primary text-sm ml-2">Crickrida</span>
    </header>
  )
}
