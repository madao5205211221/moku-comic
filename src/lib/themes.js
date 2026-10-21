export const THEMES = [
  {
    id: 'ink',
    name: '墨夜',
    desc: '深色 · 暖金',
    bg: '#0f0f10',
    surface: '#1a1a1c',
    accent: '#e5a94e',
    top: '#0f0f10',
    dark: true,
  },
  {
    id: 'green',
    name: '青竹',
    desc: '绿顶栏 · 浅色',
    bg: '#eef1ef',
    surface: '#ffffff',
    accent: '#0f6e56',
    top: '#0f6e56',
    dark: false,
  },
  {
    id: 'paper',
    name: '宣纸',
    desc: '暖纸 · 赭石',
    bg: '#f7f1e6',
    surface: '#fffdf8',
    accent: '#c4703a',
    top: '#f7f1e6',
    dark: false,
  },
]

export const THEME_IDS = THEMES.map((t) => t.id)

export function themeOf(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

/** 安卓状态栏：color 是底色，style 指底色明暗（DARK=深底配浅字，LIGHT=浅底配深字） */
export const STATUS_STYLE = {
  ink: { color: '#0f0f10', style: 'DARK' },
  green: { color: '#0f6e56', style: 'DARK' },
  paper: { color: '#f7f1e6', style: 'LIGHT' },
}
