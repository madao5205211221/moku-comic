import { useBlobUrl, progressRatio, readPages } from '../lib/util'

export function BookCard({ book, onOpen }) {
  const coverUrl = useBlobUrl(book.coverThumb)
  const ratio = progressRatio(book)
  const read = readPages(book)
  const finished = book.totalPages > 0 && read >= book.totalPages

  return (
    <button className="book" onClick={() => onOpen(book)}>
      <div className="cover">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <div className="fallback">{book.title}</div>}
        {!read && <span className="badge-unread">未读</span>}
        {read > 0 && (
          <div className="progress-rail">
            <i style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="book-title">{book.title}</div>
      <div className="book-meta">
        {book.chapters.length > 1 ? `${book.chapters.length} 话 · ${book.totalPages} 页` : `${book.totalPages} 页`}
        {finished && <span style={{ color: 'var(--accent)' }}>读完</span>}
      </div>
    </button>
  )
}
