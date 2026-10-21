import { unzip } from 'fflate'

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i
const ARCHIVE_RE = /\.(zip|cbz)$/i
const UNSUPPORTED_RE = /\.(rar|cbr|7z|cb7|tar|cbt|pdf|epub|mobi|azw3)$/i

export const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })
export const sortByName = (a, b) => collator.compare(a, b)

const SKIP = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i

const basename = (p) => p.split('/').pop() || p
const stripExt = (name) => name.replace(/\.[^.]+$/, '')

function dirOf(p) {
  const seg = p.split('/')
  seg.pop()
  return seg.join('/')
}

function mimeOf(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'avif') return 'image/avif'
  if (ext === 'bmp') return 'image/bmp'
  return 'image/jpeg'
}

/** 把 [{path, blob, name}] 组织成章节 */
export function buildChapters(entries) {
  const dirs = new Set(entries.map((e) => dirOf(e.path)))
  const flat = dirs.size === 1 && dirs.has('')
  if (flat) {
    return [{ name: '全一册', pages: entries.slice().sort((a, b) => sortByName(a.name, b.name)) }]
  }
  const map = new Map()
  for (const e of entries) {
    const d = dirOf(e.path) || ''
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(e)
  }
  return [...map.entries()]
    .map(([dir, list]) => ({
      name: dir || '全一册',
      pages: list.sort((a, b) => sortByName(a.name, b.name)),
    }))
    .sort((a, b) => sortByName(a.name, b.name))
}

/** zip 里可能多包了一层文件夹，剥掉共同顶层 */
function stripCommonRoot(paths) {
  const segs = paths.map((p) => p.split('/'))
  if (segs.some((s) => s.length < 2)) return paths
  const head = segs[0][0]
  if (!segs.every((s) => s[0] === head)) return paths
  return paths.map((p) => p.split('/').slice(1).join('/'))
}

function guessTitleFromFiles(names) {
  if (!names.length) return '未命名漫画'
  const first = stripExt(names[0])
  const cleaned = first
    .replace(/[\s_\-.]*(第?\s*\d+\s*[话話卷冊册集章回]?)\s*$/i, '')
    .replace(/[\s_\-.]*\d+\s*$/, '')
    .trim()
  return cleaned || stripExt(names[0]) || '未命名漫画'
}

/**
 * 逐本产出待入库的草稿，避免整批解压把内存撑爆
 * yield { title, chapters: [{ name, pages: [{ name, blob }] }] }
 */
export async function* iterDrafts(fileList, onProgress = () => {}, warnings = []) {
  const files = [...fileList]
  const images = []
  const archives = []

  for (const f of files) {
    if (SKIP.test(f.webkitRelativePath || f.name)) continue
    if (f.name.startsWith('.')) continue
    if (ARCHIVE_RE.test(f.name)) archives.push(f)
    else if (UNSUPPORTED_RE.test(f.name)) warnings.push(`${f.name}：暂不支持这种格式（目前支持 ZIP / CBZ / 图片文件夹）`)
    else if (IMAGE_RE.test(f.name)) images.push(f)
  }

  // ---------- 图片 ----------
  if (images.length) {
    const withPath = images.map((f) => ({
      file: f,
      path: (f.webkitRelativePath || f.name).replace(/\\/g, '/'),
    }))
    const topDirs = new Set()
    for (const e of withPath) {
      const seg = e.path.split('/')
      if (seg.length > 1) topDirs.add(seg[0])
    }

    if (topDirs.size === 0) {
      const entries = withPath.map((e) => ({ path: e.path, name: basename(e.path), blob: e.file }))
      const chapters = buildChapters(entries)
      onProgress({ phase: 'scan', title: guessTitleFromFiles(entries.map((e) => e.name)), current: images.length, total: images.length })
      yield { title: guessTitleFromFiles(entries.map((e) => e.name)), chapters }
    } else {
      // 用户可能选了一个装多部作品的根目录 → 按第一层目录拆开
      const roots = [...topDirs].sort(sortByName)
      let done = 0
      for (const root of roots) {
        const group = withPath.filter((e) => e.path.startsWith(root + '/'))
        if (!group.length) continue
        const entries = group.map((e) => ({
          path: e.path.slice(root.length + 1),
          name: basename(e.path),
          blob: e.file,
        }))
        done += entries.length
        onProgress({ phase: 'scan', title: root, current: done, total: images.length })
        yield { title: root, chapters: buildChapters(entries) }
      }
    }
  }

  // ---------- 压缩包：一包一本，解完就交出去 ----------
  for (let i = 0; i < archives.length; i++) {
    const file = archives[i]
    onProgress({ phase: 'unzip', title: file.name, current: i + 1, total: archives.length })
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const unzipped = await new Promise((resolve, reject) => {
        unzip(buf, { filter: (f) => IMAGE_RE.test(f.name) && !SKIP.test(f.name) }, (err, data) =>
          err ? reject(err) : resolve(data),
        )
      })
      const keys = Object.keys(unzipped).filter((k) => IMAGE_RE.test(k) && !SKIP.test(k)).sort(sortByName)
      if (!keys.length) {
        warnings.push(`${file.name}：压缩包里没找到图片`)
        continue
      }
      const stripped = stripCommonRoot(keys)
      const entries = stripped.map((p, idx) => {
        const raw = unzipped[keys[idx]]
        const blob = new Blob([raw], { type: mimeOf(p) })
        delete unzipped[keys[idx]]
        return { path: p, name: basename(p), blob }
      })
      yield { title: stripExt(file.name), chapters: buildChapters(entries) }
    } catch (e) {
      warnings.push(`${file.name}：解压失败（${e?.message || '文件损坏或带密码'}）`)
    }
  }
}

/** 选封面：优先文件名带 cover，否则第一章第一张 */
export function pickCover(chapters) {
  for (const ch of chapters) {
    for (const p of ch.pages) {
      if (/cover/i.test(p.name)) return p
    }
  }
  return chapters[0]?.pages?.[0] || null
}

/** 生成缩略图，失败则退回原图 */
export async function makeThumb(blob, maxW = 360) {
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, maxW / bmp.width)
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const out = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
    return out || blob
  } catch {
    return blob
  }
}
