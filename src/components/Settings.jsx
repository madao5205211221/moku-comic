import { useEffect, useState } from 'react'
import { Icon } from './Icons'
import { fmtSize } from '../lib/util'
import { estimateUsage } from '../lib/db'

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Settings({ settings, setSettings, onBack, onClearAll }) {
  const [usage, setUsage] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    estimateUsage().then(setUsage).catch(() => {})
  }, [])

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <div className="page">
      <div className="detail-head">
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>设置</div>
      </div>

      <div className="settings">
        <div className="group-title">阅读</div>
        <div className="card">
          <div className="row">
            <div className="label">
              翻页方向
              <small>日漫一般选右→左</small>
            </div>
            <Seg
              value={settings.direction}
              onChange={(v) => set({ direction: v })}
              options={[
                { value: 'rtl', label: '右→左' },
                { value: 'ltr', label: '左→右' },
                { value: 'vertical', label: '纵向' },
              ]}
            />
          </div>
          <div className="row">
            <div className="label">阅读背景</div>
            <Seg
              value={settings.bg}
              onChange={(v) => set({ bg: v })}
              options={[
                { value: 'night', label: '纯黑' },
                { value: 'gray', label: '深灰' },
                { value: 'paper', label: '米黄' },
              ]}
            />
          </div>
          <div className="row">
            <div className="label">
              阅读时屏幕常亮
              <small>开着不会自动息屏</small>
            </div>
            <Seg
              value={settings.keepAwake ? 'on' : 'off'}
              onChange={(v) => set({ keepAwake: v === 'on' })}
              options={[
                { value: 'on', label: '开' },
                { value: 'off', label: '关' },
              ]}
            />
          </div>
        </div>

        <div className="group-title">存储</div>
        <div className="card">
          <div className="row">
            <div className="label">
              已占用
              <small>
                {usage ? `${usage.pages} 页 · ${fmtSize(usage.bytes)}` : '统计中…'}
              </small>
            </div>
          </div>
          <div className="row">
            <div className="label">
              清空书架
              <small>删掉 App 里所有漫画，原文件不受影响</small>
            </div>
            {confirming ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-mini"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                  onClick={() => {
                    setConfirming(false)
                    onClearAll()
                  }}
                >
                  确定清空
                </button>
                <button className="btn-mini" style={{ background: 'var(--surface-2)' }} onClick={() => setConfirming(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button className="btn-mini danger" style={{ background: 'var(--surface-2)' }} onClick={() => setConfirming(true)}>
                清空
              </button>
            )}
          </div>
        </div>

        <div className="group-title">关于</div>
        <div className="card">
          <div className="row">
            <div className="label">
              墨匣 <small>v0.1.0 · 纯本地，不联网</small>
            </div>
          </div>
          <div className="row">
            <div className="label">
              支持的格式
              <small>图片文件夹、ZIP、CBZ。RAR / 7Z / PDF 暂不支持</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
