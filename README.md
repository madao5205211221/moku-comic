# 墨匣 · 本地漫画阅读器

安卓上的**纯本地**漫画阅读器。导入手机里的漫画文件，离线看，不联网、不上传、没广告。

界面和交互参考了 MH-ARK 的思路（本地仓库 → 自动扫描 → 书架），但实现更轻：一个 WebView 里跑 React，打包成 APK。

- 仓库：https://github.com/madao5205211221/moku-comic
- APK 下载：仓库的 **Releases** 页面，取最新一版 `moku-apk.apk`

---

## 支持什么

| 类型 | 说明 |
| --- | --- |
| ZIP / CBZ | 一个压缩包 = 一本书。包内如果有子文件夹，每个子文件夹算一话 |
| 图片文件夹 | 选一个文件夹，文件夹名就是书名，子文件夹自动当章节 |
| 散图 | 多选一堆图片，按文件名顺序排成一本 |

暂不支持：RAR / 7Z / TAR / PDF / EPUB（浏览器里解不开，需要原生库，以后再说）。

封面选择规则跟 MH-ARK 一致：优先用文件名带 `cover` 的图，没有就取第一话的第一张。

---

## 安卓上怎么用

1. 把漫画文件传到手机（微信文件传输助手、数据线、网盘都行）
2. 打开墨匣，右上角 `+`
3. 选 **ZIP/CBZ**（最稳），或者 **选图片文件夹**
4. 导入时会显示进度，导完就能离线读

**关于「选文件夹」**：这个走的是浏览器/WebView 的目录选择能力，个别机型可能不支持。如果不弹文件夹选择器，就退回用 ZIP 方式——安卓的「文件」App 里长按文件夹可以「压缩」，或者在电脑上打好包再传。

导入是**复制**进 App 自己的存储，原文件不动、也不删。所以占用空间会翻倍，读完原包可以自己删掉。

---

## 阅读器

- 翻页方向：右→左（日漫）/ 左→右 / 纵向滚动
- 背景：纯黑 / 深灰 / 米黄
- 点屏幕左中右：上一页 / 收起菜单 / 下一页
- 左右滑动翻页，顶部页码点一下可以就地改设置
- 读到哪自动记住，下次点「继续阅读」直接跳回去
- 阅读时屏幕常亮（可关）

---

## 开发

```bash
npm install
npm run dev        # 本地预览，浏览器打开 http://localhost:5175
npm run build      # 构建
npm run sync       # 构建 + 同步到安卓工程
```

技术栈：React 18 + Vite 5 + Capacitor 8。数据存在 IndexedDB（书元数据 + 图片 Blob），设置存 localStorage。

### 打 APK

本机不装 Android Studio，全部在 GitHub Actions 云端编译：

push 到 `main` 分支会自动触发，产物在仓库的 **Releases** 里。

用的签名密钥和「得鹿梦鱼」共用一份（`KEYSTORE_BASE64` secret），所以能直接覆盖安装升级、书架数据不丢。

---

## 目录结构

```
src/
  App.jsx              路由和状态
  lib/db.js            IndexedDB：books / pages 两个 store
  lib/importer.js      解析文件夹、ZIP，切章节，选封面
  lib/util.js          尺寸格式化、进度计算
  components/
    Shelf.jsx          书架
    BookCard.jsx       书卡
    Detail.jsx         详情 + 目录
    Reader.jsx         阅读器（三种模式）
    Settings.jsx       设置
    ImportSheet.jsx    导入面板
    Icons.jsx          图标
```

---

## 已知限制

- 一次导入很大的包（几百 MB）会慢，导入时别切到别的 App
- App 内清空书架后空间才真正释放；卸载 App 数据全没（本来也是复制进来的）
- 单页模式一次预载前后各一页，快速连续翻页偶尔会看到一下加载占位
