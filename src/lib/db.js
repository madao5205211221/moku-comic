// IndexedDB 封装：books 存元数据，pages 存图片 Blob
const DB_NAME = 'moku-comic'
const DB_VER = 1

let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('pages')) {
        const s = db.createObjectStore('pages', { keyPath: 'id' })
        s.createIndex('bookId', 'bookId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function listBooks() {
  const db = await open()
  const tx = db.transaction('books', 'readonly')
  const store = tx.objectStore('books')
  const items = await new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  await done(tx)
  return items.sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt))
}

export async function getBook(id) {
  const db = await open()
  const tx = db.transaction('books', 'readonly')
  const item = await new Promise((resolve, reject) => {
    const req = tx.objectStore('books').get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
  await done(tx)
  return item
}

export async function putBook(book) {
  const db = await open()
  const tx = db.transaction('books', 'readwrite')
  tx.objectStore('books').put(book)
  await done(tx)
}

export async function patchBook(id, patch) {
  const book = await getBook(id)
  if (!book) return null
  const next = { ...book, ...patch }
  await putBook(next)
  return next
}

export async function deleteBook(id) {
  const db = await open()
  // 先删页，再删书
  const tx1 = db.transaction('pages', 'readwrite')
  const idx = tx1.objectStore('pages').index('bookId')
  await new Promise((resolve, reject) => {
    const req = idx.openKeyCursor(IDBKeyRange.only(id))
    req.onsuccess = () => {
      const cur = req.result
      if (cur) {
        tx1.objectStore('pages').delete(cur.primaryKey)
        cur.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
  await done(tx1)

  const tx2 = db.transaction('books', 'readwrite')
  tx2.objectStore('books').delete(id)
  await done(tx2)
}

// 批量写入页数据，每批 120 条一个事务，避免长时间锁库
export async function putPages(bookId, pages, onProgress) {
  const db = await open()
  const BATCH = 120
  for (let i = 0; i < pages.length; i += BATCH) {
    const tx = db.transaction('pages', 'readwrite')
    const store = tx.objectStore('pages')
    const slice = pages.slice(i, i + BATCH)
    for (const p of slice) {
      store.put({
        id: `${bookId}|${p.chapterIndex}|${p.pageIndex}`,
        bookId,
        chapterIndex: p.chapterIndex,
        pageIndex: p.pageIndex,
        blob: p.blob,
      })
    }
    await done(tx)
    if (onProgress) onProgress(Math.min(pages.length, i + BATCH), pages.length)
    if (i % (BATCH * 4) === 0) await new Promise((r) => setTimeout(r, 0))
  }
}

export async function getPage(bookId, chapterIndex, pageIndex) {
  const db = await open()
  const tx = db.transaction('pages', 'readonly')
  const item = await new Promise((resolve, reject) => {
    const req = tx.objectStore('pages').get(`${bookId}|${chapterIndex}|${pageIndex}`)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
  await done(tx)
  return item ? item.blob : null
}

// 估算整体占用（遍历页 blobs 的 size）
export async function estimateUsage() {
  const db = await open()
  const tx = db.transaction('pages', 'readonly')
  const store = tx.objectStore('pages')
  let total = 0
  let count = 0
  await new Promise((resolve, reject) => {
    const req = store.openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (cur) {
        total += cur.value.blob?.size || 0
        count += 1
        cur.continue()
      } else resolve()
    }
    req.onerror = () => reject(req.error)
  })
  await done(tx)
  return { bytes: total, pages: count }
}

export async function clearAll() {
  const db = await open()
  const tx = db.transaction(['books', 'pages'], 'readwrite')
  tx.objectStore('books').clear()
  tx.objectStore('pages').clear()
  await done(tx)
}
