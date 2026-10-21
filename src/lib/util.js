import { useEffect, useState } from 'react'

/** 把 Blob 转成可用的 objectURL，卸载时自动回收 */
export function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function fmtSize(bytes) {
  if (!bytes) return '0 KB'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / 1024 ** 2
  if (mb >= 1) return `${Math.round(mb)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function readPages(book) {
  const p = book?.progress
  if (!p) return 0
  let n = 0
  for (let i = 0; i < p.chapterIndex && i < book.chapters.length; i++) n += book.chapters[i].pageCount
  return n + (p.pageIndex || 0)
}

export function progressRatio(book) {
  if (!book?.totalPages) return 0
  return Math.min(1, readPages(book) / book.totalPages)
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
