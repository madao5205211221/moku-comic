import { Capacitor, registerPlugin } from '@capacitor/core'

const FolderPicker = registerPlugin('FolderPicker')

export function hasNativeFolderPicker() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * 打开系统目录选择器，原生侧会递归扫描并把图片复制到缓存目录。
 * onProgress(count) 回报已复制数量；返回 { root, dir, files: [{ rel, name, abs, size }] }
 */
export async function pickFolder(onProgress) {
  let handle = null
  try {
    handle = await FolderPicker.addListener('progress', (e) => {
      if (onProgress) onProgress(e.count || 0)
    })
  } catch {}
  try {
    return await FolderPicker.pick()
  } finally {
    try {
      handle?.remove()
    } catch {}
  }
}

export async function cleanupFolder(dir) {
  if (!dir) return
  try {
    await FolderPicker.cleanup({ dir })
  } catch {}
}

/** 把原生缓存里的绝对路径读成 Blob（走 Capacitor 的本地文件代理，比 base64 快） */
export async function readNativeFile(abs) {
  const url = Capacitor.convertFileSrc(abs)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`读取失败 ${res.status}`)
  return res.blob()
}
