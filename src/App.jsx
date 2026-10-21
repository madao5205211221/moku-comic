import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { listBooks, putBook, patchBook, deleteBook, putPages, clearAll, getBook } from './lib/db'
import { iterDrafts, pickCover, makeThumb } from './lib/importer'
import { uid } from './lib/util'
import { STATUS_STYLE } from './lib/themes'
import { Shelf } from './components/Shelf'
import { Detail } from './components/Detail'
import { Reader } from './components/Reader'
import { Settings } from './components/Settings'
import { ImportSheet } from './components/ImportSheet'
import { Icon } from './components/Icons'

const SETTINGS_KEY = 'moku.settings.v1'
const DEFAULT_SETTINGS = { direction: 'rtl', bg: 'night', keepAwake: true, theme: 'ink' }

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const PHASE_TEXT = {
  scan: '正在整理图片',
  unzip: '正在解压',
  save: '正在存入书架',
  parse: '正在读取',
}

const isNative = () => Capacitor.isNativePlatform()

export default function App() {
  const [books, setBooks] = useState([])
  const [view, setView] = useState('shelf')
  const [detail, setDetail] = useState(null)
  const [reader, setReader] = useState(null)
  const [settings, setSettingsState] = useState(loadSettings)
  const [importOpen, setImportOpen] = useState(false)
  const [job, setJob] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const appRef = useRef(null)

  // 给手势和返回键用的最新状态快照
  const stateRef = useRef({})
  stateRef.current = { reader, job, importOpen, view }
  const goBackRef = useRef(() => false)

  const refresh = useCallback(async () => {
    const list = await listBooks()
    setBooks(list)
    return list
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 主题挂到 html 上
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || 'ink'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const s = STATUS_STYLE[settings.theme] || STATUS_STYLE.ink
      meta.setAttribute('content', s.color)
    }
    if (isNative()) {
      const s = STATUS_STYLE[settings.theme] || STATUS_STYLE.ink
      StatusBar.setStyle({ style: s.style }).catch(() => {})
      StatusBar.setBackgroundColor({ color: s.color }).catch(() => {})
    }
  }, [settings.theme])

  const showToast = (msg, ms = 2400) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }

  const setSettings = (updater) => {
    setSettingsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  async function handleFiles(fileList) {
    setImportOpen(false)
    const warnings = []
    let added = 0
    let addedPages = 0
    setJob({ phase: 'parse', title: '正在读取…', current: 0, total: 1 })

    try {
      for await (const draft of iterDrafts(fileList, (p) => setJob(p), warnings)) {
        const chapters = draft.chapters.map((c) => ({ name: c.name, pageCount: c.pages.length }))
        const totalPages = chapters.reduce((a, c) => a + c.pageCount, 0)
        if (!totalPages) continue

        const id = uid()
        const pages = []
        draft.chapters.forEach((c, ci) => {
          c.pages.forEach((p, pi) => pages.push({ chapterIndex: ci, pageIndex: pi, blob: p.blob }))
        })

        setJob({ phase: 'save', title: draft.title, current: 0, total: pages.length })
        await putPages(id, pages, (cur, tot) => setJob({ phase: 'save', title: draft.title, current: cur, total: tot }))

        const cover = pickCover(draft.chapters)
        const thumb = cover ? await makeThumb(cover.blob) : null
        const sizeBytes = pages.reduce((a, p) => a + (p.blob?.size || 0), 0)

        await putBook({
          id,
          title: draft.title,
          chapters,
          totalPages,
          sizeBytes,
          coverThumb: thumb,
          addedAt: Date.now(),
          lastReadAt: null,
          progress: null,
        })
        added += 1
        addedPages += totalPages
      }
    } catch (e) {
      warnings.push(`导入中断：${e?.message || e}`)
    }

    setJob(null)
    await refresh()
    if (added) showToast(`已导入 ${added} 部，共 ${addedPages} 页`)
    if (warnings.length) {
      setTimeout(() => showToast(warnings[0], 5000), added ? 1800 : 0)
    }
  }

  async function handleDelete(book) {
    await deleteBook(book.id)
    setDetail(null)
    setView('shelf')
    await refresh()
    showToast('已从书架删除')
  }

  async function closeReader() {
    const id = reader?.book?.id
    setReader(null)
    // 等 Reader 卸载时那次进度写入落库，再刷新列表
    await new Promise((r) => setTimeout(r, 80))
    await refresh()
    if (id && detail?.id === id) {
      const nb = await getBook(id)
      setDetail(nb)
    }
  }

  const saveProgress = (p) => {
    if (!reader) return
    patchBook(reader.book.id, { progress: p, lastReadAt: Date.now() }).catch(() => {})
  }

  // 层级返回：能退一级就退一级，退到书架根才交回系统
  const goBack = () => {
    const s = stateRef.current
    if (s.job) return true
    if (s.importOpen) {
      setImportOpen(false)
      return true
    }
    if (s.reader) {
      closeReader()
      return true
    }
    if (s.view === 'detail') {
      setDetail(null)
      setView('shelf')
      return true
    }
    if (s.view === 'settings') {
      setView('shelf')
      return true
    }
    return false
  }
  goBackRef.current = goBack

  // 安卓物理返回键 / 系统返回手势
  useEffect(() => {
    if (!isNative()) return
    let handle = null
    CapApp.addListener('backButton', () => {
      if (!goBackRef.current()) {
        CapApp.exitApp().catch(() => {})
      }
    })
      .then((h) => (handle = h))
      .catch(() => {})
    return () => {
      try {
        handle?.remove()
      } catch {}
    }
  }, [])

  // 左右边缘侧滑返回
  useEffect(() => {
    const el = appRef.current
    if (!el) return
    const EDGE = 26
    const THRESHOLD = 74
    let drag = null

    const reset = (animate = true) => {
      el.style.transition = animate ? 'transform .24s cubic-bezier(.22,1,.36,1)' : 'none'
      el.style.transform = 'translateX(0)'
      el.style.boxShadow = ''
      window.setTimeout(() => {
        if (!drag) {
          el.style.transform = ''
          el.style.transition = ''
        }
      }, 260)
    }

    const onStart = (e) => {
      const s = stateRef.current
      if (s.reader || s.job || s.importOpen) return
      const t = e.touches[0]
      const w = window.innerWidth
      let from = 0
      if (t.clientX <= EDGE) from = 1
      else if (t.clientX >= w - EDGE) from = -1
      if (!from) return
      drag = { from, x0: t.clientX, y0: t.clientY, dx: 0, active: false }
    }

    const onMove = (e) => {
      if (!drag) return
      const t = e.touches[0]
      const dx = t.clientX - drag.x0
      const dy = t.clientY - drag.y0
      if (!drag.active) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          drag = null
          return
        }
        if (Math.abs(dx) < 8) return
        drag.active = true
      }
      const v = drag.from === 1 ? Math.max(0, dx) : Math.min(0, dx)
      drag.dx = v
      el.style.transition = 'none'
      el.style.transform = `translateX(${v * 0.72}px)`
      el.style.boxShadow = '0 0 28px rgba(0,0,0,.45)'
    }

    // 只有真的能退一级，才播放滑出动画；根页面直接回弹
    const canGoBack = () => {
      const s = stateRef.current
      return !!(s.job || s.importOpen || s.reader || s.view !== 'shelf')
    }

    const onEnd = () => {
      if (!drag) return
      const d = drag
      drag = null
      if (!d.active) return
      if (Math.abs(d.dx) > THRESHOLD && canGoBack()) {
        el.style.transition = 'transform .17s cubic-bezier(.4,0,.6,1)'
        el.style.transform = `translateX(${d.from * 100}%)`
        window.setTimeout(() => {
          goBackRef.current()
          el.style.transition = 'none'
          el.style.transform = ''
          window.requestAnimationFrame(() => {
            el.style.transition = ''
          })
        }, 170)
      } else {
        reset(true)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const jobPct = job ? Math.round(((job.current || 0) / Math.max(1, job.total || 1)) * 100) : 0

  return (
    <div className="app" ref={appRef}>
      {view === 'shelf' && (
        <Shelf
          books={books}
          onOpen={(b) => {
            setDetail(b)
            setView('detail')
          }}
          onImport={() => setImportOpen(true)}
          onSettings={() => setView('settings')}
        />
      )}

      {view === 'detail' && detail && (
        <Detail
          book={detail}
          onBack={() => {
            setDetail(null)
            setView('shelf')
          }}
          onOpen={(start) => setReader({ book: detail, start })}
          onDelete={() => handleDelete(detail)}
        />
      )}

      {view === 'settings' && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          onBack={() => setView('shelf')}
          onClearAll={async () => {
            await clearAll()
            await refresh()
            showToast('书架已清空')
          }}
        />
      )}

      {view !== 'detail' && (
        <div className="tabbar">
          <button className={view === 'shelf' ? 'on' : ''} onClick={() => setView('shelf')}>
            <Icon name="shelf" size={20} />
            书架
          </button>
          <button className={view === 'settings' ? 'on' : ''} onClick={() => setView('settings')}>
            <Icon name="gear" size={20} />
            设置
          </button>
        </div>
      )}

      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} onFiles={handleFiles} />}

      {job && (
        <div className="sheet-mask" style={{ alignItems: 'center', padding: 24 }}>
          <div className="sheet" style={{ borderRadius: 16, width: '100%', maxWidth: 360 }}>
            <h3>导入中</h3>
            <p className="hint">{PHASE_TEXT[job.phase] || '处理中'}，别切到别的 App，大文件会慢一点。</p>
            <div className="loading">
              <div className="line">
                <i style={{ width: `${jobPct}%` }} />
              </div>
              <p>
                {job.title} · {job.current}/{job.total}
              </p>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {reader && (
        <Reader
          book={reader.book}
          settings={settings}
          setSettings={setSettings}
          startGlobal={reader.start}
          onClose={closeReader}
          onProgress={saveProgress}
        />
      )}
    </div>
  )
}
