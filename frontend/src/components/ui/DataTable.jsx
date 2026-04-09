import { useState, useEffect, useMemo } from 'react'

function SkeletonRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="border-b border-border-subtle">
      {columns.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 bg-bg-card-hover rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  ))
}

export default function DataTable({
  columns = [],
  data = [],
  onSort,
  sortKey,
  sortDir,
  onRowClick,
  loading = false,
  pageSize = 50,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [internalSort, setInternalSort] = useState({ key: '', dir: 'asc' })

  // Reset to page 1 when data or sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [data, sortKey, sortDir, internalSort.key, internalSort.dir])

  const activeSortKey = sortKey ?? internalSort.key
  const activeSortDir = sortDir ?? internalSort.dir

  const parseSortableValue = (value) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return value ? 1 : 0
    const text = String(value).trim()
    const numeric = Number(text.replace(/,/g, ''))
    if (!Number.isNaN(numeric) && text !== '') return numeric
    const dateValue = Date.parse(text)
    if (!Number.isNaN(dateValue) && /\d{4}|\d{1,2}[/-]\d{1,2}/.test(text)) return dateValue
    return text.toLowerCase()
  }

  const sortedData = useMemo(() => {
    if (!activeSortKey) return data
    const sorted = [...data].sort((a, b) => {
      const av = parseSortableValue(a?.[activeSortKey])
      const bv = parseSortableValue(b?.[activeSortKey])
      if (av === bv) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (av > bv) return activeSortDir === 'asc' ? 1 : -1
      if (av < bv) return activeSortDir === 'asc' ? -1 : 1
      return 0
    })
    return sorted
  }, [data, activeSortDir, activeSortKey])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const endIdx = startIdx + pageSize
  const pageData = sortedData.slice(startIdx, endIdx)
  const showPagination = sortedData.length > pageSize

  const handleSort = (col) => {
    if (col.sortable === false) return
    if (onSort) {
      onSort(col.key)
      return
    }
    setInternalSort((prev) => ({
      key: col.key,
      dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-elevated border-b border-border-subtle sticky top-0 z-10">
              {columns.map((col) => {
                const isSortable = col.sortable !== false
                const isActive = activeSortKey === col.key
                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${isSortable ? 'cursor-pointer select-none hover:text-text-primary transition-colors' : ''}`}
                    onClick={() => handleSort(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSortable && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`w-3 h-3 transition-transform ${isActive && activeSortDir === 'desc' ? 'rotate-180' : ''} ${isActive ? 'opacity-100' : 'opacity-35'}`}
                        >
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows columns={columns} />
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-text-muted text-sm"
                >
                  No data available
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={row.id ?? startIdx + i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border-subtle transition-colors ${
                    i % 2 === 1 ? 'bg-bg-card/50' : ''
                  } ${onRowClick ? 'cursor-pointer' : ''} hover:bg-bg-card-hover`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-text-primary ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-text-muted">
            Showing {startIdx + 1}–{Math.min(endIdx, sortedData.length)} of {sortedData.length} records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-card text-text-muted hover:text-text-primary hover:bg-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <span className="text-xs text-text-muted">
              Page <span className="text-accent-cyan font-medium">{currentPage}</span> of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-card text-text-muted hover:text-text-primary hover:bg-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
