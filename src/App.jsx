import { useCallback, useEffect, useRef, useState } from 'react'
import { listBooks, putBook, patchBook, deleteBook, putPages, clearAll, getBook } from './lib/db'
import { iterDrafts, pickCover, makeThumb } from './lib/importer'
import { uid } from './lib/util'
import { Shelf } from './components/Shelf'
import { Detail } from './components/Detail'
import { Reader } from './components/Reader'
import { Settings } from './components/Settings'
import { ImportSheet } from './components/ImportSheet'
import { Icon } from './components/Icons'

const SETTINGS_KEY = 'moku.settings.v1'
const DEFAULT_SETTINGS = { direction: 'rtl', bg: 'night', keepAwake: true }

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

  const refresh = useCallback(async () => {
    const list = await listBooks()
    setBooks(list)
    return list
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  const jobPct = job ? Math.round(((job.current || 0) / Math.max(1, job.total || 1)) * 100) : 0

  return (
    <div className="app">
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
