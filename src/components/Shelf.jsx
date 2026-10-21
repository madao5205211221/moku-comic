import { useState } from 'react'
import { Icon } from './Icons'
import { BookCard } from './BookCard'

export function Shelf({ books, onOpen, onImport, onSettings }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const list = query ? books.filter((b) => b.title.toLowerCase().includes(query)) : books

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <h1>墨匣</h1>
          <span className="count">{books.length ? `${books.length} 部` : '本地漫画'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={onSettings} aria-label="设置">
            <Icon name="gear" size={19} />
          </button>
          <button className="icon-btn accent" onClick={onImport} aria-label="导入">
            <Icon name="plus" size={20} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      {books.length > 0 && (
        <div className="searchbar">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索书名" />
        </div>
      )}

      <div className="shelf">
        {!books.length ? (
          <div className="empty">
            <div className="glyph">
              <Icon name="book" size={34} />
            </div>
            <h2>书架还空着</h2>
            <p>
              把漫画放进手机后，点右上角导入。
              <br />
              支持图片文件夹、ZIP 和 CBZ，导入后断网也能读。
            </p>
            <button className="btn-primary" style={{ padding: '0 26px', marginTop: 6 }} onClick={onImport}>
              <Icon name="plus" size={18} /> 导入漫画
            </button>
          </div>
        ) : list.length ? (
          <div className="grid">
            {list.map((b) => (
              <BookCard key={b.id} book={b} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="empty" style={{ paddingTop: 60 }}>
            <p>没有书名包含「{q}」的漫画</p>
          </div>
        )}
      </div>
    </div>
  )
}
