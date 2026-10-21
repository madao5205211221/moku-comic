import { useEffect, useMemo, useRef, useState } from 'react'
import { getPage } from '../lib/db'
import { Icon } from './Icons'

/** 懒加载单页图片 */
export function LazyPage({ bookId, chapterIndex, pageIndex, eager, className, style, alt = '' }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!eager) return
    let alive = true
    let created = null
    getPage(bookId, chapterIndex, pageIndex)
      .then((blob) => {
        if (!alive) return
        if (!blob) {
          setFailed(true)
          return
        }
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [bookId, chapterIndex, pageIndex, eager])

  return (
    <div className={className} style={style} data-page={`${chapterIndex}-${pageIndex}`}>
      {url ? (
        <img src={url} alt={alt} />
      ) : (
        <div className="page-ph">{failed ? '这一页读不出来' : ''}</div>
      )}
    </div>
  )
}

const DIRS = [
  { value: 'rtl', label: '右→左' },
  { value: 'ltr', label: '左→右' },
  { value: 'vertical', label: '纵向' },
]
const BGS = [
  { value: 'night', label: '纯黑' },
  { value: 'gray', label: '深灰' },
  { value: 'paper', label: '米黄' },
]

export function Reader({ book, settings, setSettings, startGlobal, onClose, onProgress }) {
  const offsets = useMemo(() => {
    let acc = 0
    return book.chapters.map((c) => {
      const o = acc
      acc += c.pageCount
      return o
    })
  }, [book])

  const total = book.totalPages
  const [g, setG] = useState(() => Math.max(0, Math.min(total - 1, startGlobal || 0)))
  const [chrome, setChrome] = useState(true)
  const [panel, setPanel] = useState(false)
  const verticalRef = useRef(null)
  const touchRef = useRef(null)
  const progressTimer = useRef(null)
  const lastG = useRef(g)

  const locate = (gi) => {
    let ci = 0
    for (let i = 0; i < book.chapters.length; i++) {
      if (gi >= offsets[i]) ci = i
      else break
    }
    return { ci, pi: gi - offsets[ci] }
  }

  const cur = locate(g)
  const chapter = book.chapters[cur.ci]
  const vertical = settings.direction === 'vertical'

  // 进度防抖回写
  useEffect(() => {
    lastG.current = g
    clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      onProgress({ chapterIndex: cur.ci, pageIndex: cur.pi })
    }, 600)
    return () => clearTimeout(progressTimer.current)
  }, [g])

  // 退出时立刻落盘，避免快速返回丢进度
  const curRef = useRef(cur)
  curRef.current = cur
  useEffect(() => {
    return () => {
      onProgress({ chapterIndex: curRef.current.ci, pageIndex: curRef.current.pi })
    }
  }, [])

  const go = (delta) => {
    const next = g + delta
    if (next < 0 || next >= total) return
    setG(next)
    if (vertical) scrollToGlobal(next)
  }

  const scrollToGlobal = (gi) => {
    const el = verticalRef.current
    if (!el) return
    const loc = locate(gi)
    const target = el.querySelector(`[data-page="${loc.ci}-${loc.pi}"]`)
    if (target) el.scrollTop = target.offsetTop
  }

  // 键盘（桌面端方便调试）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (vertical) return
      const fwd = settings.direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const back = settings.direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if (e.key === fwd) go(1)
      if (e.key === back) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [g, vertical, settings.direction])

  // 屏幕常亮
  useEffect(() => {
    let lock = null
    if (settings.keepAwake && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    }
    return () => {
      try {
        lock?.release()
      } catch {}
    }
  }, [settings.keepAwake])

  // 纵向模式：图片是懒加载的，高度会变，多补几次定位
  useEffect(() => {
    if (!vertical) return
    const timers = [80, 260, 700].map((ms) => setTimeout(() => scrollToGlobal(g), ms))
    return () => timers.forEach(clearTimeout)
  }, [vertical])

  // 进入后自动收起上下栏，别挡着画面
  useEffect(() => {
    const t = setTimeout(() => setChrome(false), 3500)
    return () => clearTimeout(t)
  }, [])

  const onScroll = () => {
    const el = verticalRef.current
    if (!el) return
    const mid = el.scrollTop + el.clientHeight * 0.42
    const nodes = el.querySelectorAll('[data-page]')
    for (const n of nodes) {
      if (n.offsetTop + n.offsetHeight >= mid) {
        const [ci, pi] = n.dataset.page.split('-').map(Number)
        const gg = offsets[ci] + pi
        if (gg !== lastG.current) setG(gg)
        break
      }
    }
  }

  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e) => {
    const t = touchRef.current
    if (!t) return
    touchRef.current = null
    if (vertical) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      const forwardIsRight = settings.direction === 'rtl'
      const forward = forwardIsRight ? dx > 0 : dx < 0
      go(forward ? 1 : -1)
    }
  }

  const tapZone = (where) => {
    if (vertical || where === 'mid') {
      setChrome((c) => !c)
      setPanel(false)
      return
    }
    const forwardIsLeft = settings.direction === 'rtl'
    const forward = forwardIsLeft ? where === 'left' : where === 'right'
    go(forward ? 1 : -1)
  }

  const changeChapter = (delta) => {
    const ni = cur.ci + delta
    if (ni < 0 || ni >= book.chapters.length) return
    const target = offsets[ni]
    setG(target)
    if (vertical) {
      ;[40, 200, 600].forEach((ms) => setTimeout(() => scrollToGlobal(target), ms))
    }
  }

  const pct = total > 1 ? (g / (total - 1)) * 100 : 0
  const atFirst = cur.ci === 0
  const atLast = cur.ci >= book.chapters.length - 1

  return (
    <div className={`reader bg-${settings.bg}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {vertical ? (
        <div className="vertical-stage" ref={verticalRef} onScroll={onScroll} onClick={() => tapZone('mid')}>
          {chapter &&
            Array.from({ length: chapter.pageCount }).map((_, pi) => (
              <LazyPage key={`${cur.ci}-${pi}`} bookId={book.id} chapterIndex={cur.ci} pageIndex={pi} eager />
            ))}
        </div>
      ) : (
        <>
          <div className="stage">
            {[g - 1, g, g + 1].map((i) => {
              if (i < 0 || i >= total) return null
              const loc = locate(i)
              return (
                <LazyPage
                  key={`${i}-${loc.ci}-${loc.pi}`}
                  bookId={book.id}
                  chapterIndex={loc.ci}
                  pageIndex={loc.pi}
                  eager
                  className={`page-slot ${i === g ? 'on' : ''}`}
                />
              )
            })}
          </div>
          <div className="tapzones">
            <div onClick={() => tapZone('left')} />
            <div style={{ flex: 0.7 }} onClick={() => tapZone('mid')} />
            <div onClick={() => tapZone('right')} />
          </div>
        </>
      )}

      <div className={`overlay top ${chrome ? '' : 'hidden'}`}>
        <button className="icon-btn" onClick={onClose} aria-label="返回">
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="reader-title">{book.title}</div>
          <div className="reader-sub">
            {chapter?.name || ''} · {cur.pi + 1}/{chapter?.pageCount || 0}
          </div>
        </div>
        <button
          className={`btn-mini ${panel ? 'on' : ''}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          onClick={() => setPanel((p) => !p)}
        >
          {g + 1}/{total}
        </button>
      </div>

      {panel && (
        <div className="reader-panel">
          <div className="panel-row">
            <span>翻页</span>
            <div className="seg">
              {DIRS.map((d) => (
                <button
                  key={d.value}
                  className={settings.direction === d.value ? 'on' : ''}
                  onClick={() => setSettings((s) => ({ ...s, direction: d.value }))}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-row">
            <span>底色</span>
            <div className="seg">
              {BGS.map((b) => (
                <button
                  key={b.value}
                  className={settings.bg === b.value ? 'on' : ''}
                  onClick={() => setSettings((s) => ({ ...s, bg: b.value }))}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`overlay bottom ${chrome ? '' : 'hidden'}`}>
        <div className="slider-row">
          <span className="pct">{Math.round(pct)}%</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={g}
            onChange={(e) => {
              const v = Number(e.target.value)
              setG(v)
              if (vertical) scrollToGlobal(v)
            }}
          />
          <span className="cn">{cur.ci + 1}/{book.chapters.length} 话</span>
        </div>
        <div className="reader-actions">
          <button className="btn-mini act" onClick={() => changeChapter(-1)} disabled={atFirst}>
            上一话
          </button>
          <button className="btn-mini act wide" onClick={() => go(-1)} disabled={g === 0}>
            <Icon name="left" size={15} /> 上一页
          </button>
          <button className="btn-mini act wide" onClick={() => go(1)} disabled={g >= total - 1}>
            下一页 <Icon name="right" size={15} />
          </button>
          <button className="btn-mini act" onClick={() => changeChapter(1)} disabled={atLast}>
            下一话
          </button>
        </div>
      </div>
    </div>
  )
}
