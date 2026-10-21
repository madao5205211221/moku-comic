import { useState } from 'react'
import { Icon } from './Icons'
import { useBlobUrl, fmtSize, readPages, progressRatio } from '../lib/util'

export function Detail({ book, onBack, onOpen, onDelete }) {
  const coverUrl = useBlobUrl(book.coverThumb)
  const [menu, setMenu] = useState(false)
  const read = readPages(book)
  const ratio = progressRatio(book)
  const curChapter = book.progress?.chapterIndex ?? 0

  const startAt = () => {
    const p = book.progress
    if (!p) {
      onOpen(0)
      return
    }
    let offset = 0
    for (let i = 0; i < p.chapterIndex && i < book.chapters.length; i++) offset += book.chapters[i].pageCount
    onOpen(offset + (p.pageIndex || 0))
  }

  return (
    <div className="page">
      <div className="detail-head">
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.title}
        </div>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="更多">
          <Icon name="more" size={18} />
        </button>
      </div>

      {menu && (
        <div style={{ display: 'flex', gap: 8, padding: '6px 18px 0', justifyContent: 'flex-end' }}>
          <button
            className="btn-mini"
            style={{ background: 'var(--surface)', color: 'var(--danger)' }}
            onClick={() => {
              setMenu(false)
              onDelete()
            }}
          >
            <Icon name="trash" size={14} /> 从书架删除
          </button>
        </div>
      )}

      <div className="detail-body">
        <div className="detail-hero">
          <div className="cover">
            {coverUrl ? <img src={coverUrl} alt="" /> : <div className="fallback">{book.title}</div>}
          </div>
          <div className="info">
            <h2>{book.title}</h2>
            <div className="stats">
              {book.chapters.length > 1 ? `${book.chapters.length} 话 · ` : ''}
              {book.totalPages} 页 · {fmtSize(book.sizeBytes)}
              <br />
              {read > 0 ? `已读 ${read} 页（${Math.round(ratio * 100)}%）` : '还没开始读'}
            </div>
            <button className="btn-primary" onClick={startAt}>
              <Icon name="play" size={15} />
              {read > 0 && read < book.totalPages ? '继续阅读' : read >= book.totalPages ? '重新阅读' : '开始阅读'}
            </button>
          </div>
        </div>

        <div className="section-title">
          <span>目录</span>
          <span>{book.chapters.length} 话</span>
        </div>

        {book.chapters.map((ch, i) => {
          let offset = 0
          for (let k = 0; k < i; k++) offset += book.chapters[k].pageCount
          const isCur = i === curChapter && read > 0
          return (
            <button key={`${ch.name}-${i}`} className={`chapter ${isCur ? 'current' : ''}`} onClick={() => onOpen(offset)}>
              <span className="name">
                {isCur && <span className="dot" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />}
                {ch.name}
              </span>
              <span className="sub">{ch.pageCount} 页</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
