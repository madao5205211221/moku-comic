import { useRef } from 'react'
import { Icon } from './Icons'

export function ImportSheet({ onClose, onFiles }) {
  const folderRef = useRef(null)
  const imgRef = useRef(null)
  const zipRef = useRef(null)

  const pick = (ref) => {
    ref.current.value = ''
    ref.current.click()
  }
  const handle = (e) => {
    const files = e.target.files
    if (files && files.length) onFiles(files)
  }

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>导入漫画</h3>
        <p className="hint">
          文件会复制进 App 自己的存储，之后断网也能读。
          <br />
          原文件不动，可以自己删。
        </p>

        <button className="opt" onClick={() => pick(zipRef)}>
          <span className="ico">
            <Icon name="zip" size={20} />
          </span>
          <span className="txt">
            <strong>选 ZIP / CBZ</strong>
            <span>最稳的方式，一个包算一本，可多选</span>
          </span>
          <Icon name="right" size={16} style={{ color: 'var(--text-faint)' }} />
        </button>

        <button className="opt" onClick={() => pick(folderRef)}>
          <span className="ico">
            <Icon name="folder" size={20} />
          </span>
          <span className="txt">
            <strong>选一个文件夹</strong>
            <span>文件夹名就是书名，子文件夹自动当章节（个别机型可能不支持）</span>
          </span>
          <Icon name="right" size={16} style={{ color: 'var(--text-faint)' }} />
        </button>

        <button className="opt" onClick={() => pick(imgRef)}>
          <span className="ico">
            <Icon name="image" size={20} />
          </span>
          <span className="txt">
            <strong>直接选图片</strong>
            <span>一堆散图整成一本，按文件名顺序排列</span>
          </span>
          <Icon name="right" size={16} style={{ color: 'var(--text-faint)' }} />
        </button>

        <button className="close" onClick={onClose}>
          取消
        </button>

        <input
          ref={folderRef}
          type="file"
          multiple
          onChange={handle}
          style={{ display: 'none' }}
          {...{ webkitdirectory: '', directory: '' }}
        />
        <input ref={zipRef} type="file" multiple accept=".zip,.cbz,application/zip,application/x-cbz" onChange={handle} style={{ display: 'none' }} />
        <input ref={imgRef} type="file" multiple accept="image/*" onChange={handle} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
