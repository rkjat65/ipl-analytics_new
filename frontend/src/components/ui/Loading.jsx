export function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-bg-card-hover rounded animate-pulse ${className}`}
    />
  )
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  }

  return (
    <div
      className={`${sizes[size]} border-border-subtle border-t-accent-cyan rounded-full animate-spin ${className}`}
    />
  )
}

export default function Loading({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-text-secondary font-body text-sm">{message}</p>
    </div>
  )
}
