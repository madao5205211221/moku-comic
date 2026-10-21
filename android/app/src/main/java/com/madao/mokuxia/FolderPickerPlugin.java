package com.madao.mokuxia;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * 用系统的目录选择器（SAF）选一整个漫画文件夹，
 * 递归扫出所有图片并复制到 App 缓存目录，把路径交给网页层读取。
 */
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private static final String[] PROJ = new String[] {
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE,
    };

    private static final String[] IMAGE_EXT = { "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif" };

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("没有拿到目录");
            return;
        }

        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {}

        final Context ctx = getContext();
        final String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);

        execute(() -> {
            File targetDir = new File(ctx.getCacheDir(), "import/" + UUID.randomUUID().toString());
            if (!targetDir.exists() && !targetDir.mkdirs()) {
                call.reject("无法创建缓存目录");
                return;
            }
            try {
                ContentResolver resolver = ctx.getContentResolver();
                String rootName = queryName(resolver, treeUri, rootDocId);
                List<JSObject> files = new ArrayList<>();
                Counter counter = new Counter();
                walk(resolver, treeUri, rootDocId, "", targetDir, files, counter, new ProgressReporter());
                if (files.isEmpty()) {
                    deleteTree(targetDir);
                    call.reject("这个文件夹里没找到图片");
                    return;
                }
                JSArray arr = new JSArray(files);
                JSObject ret = new JSObject();
                ret.put("root", rootName == null ? "未命名漫画" : rootName);
                ret.put("dir", targetDir.getAbsolutePath());
                ret.put("files", arr);
                call.resolve(ret);
            } catch (Exception e) {
                deleteTree(targetDir);
                call.reject("扫描失败：" + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        String dir = call.getString("dir");
        if (dir == null || dir.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            File cacheRoot = new File(getContext().getCacheDir(), "import").getCanonicalFile();
            File target = new File(dir).getCanonicalFile();
            if (target.getAbsolutePath().startsWith(cacheRoot.getAbsolutePath())) {
                deleteTree(target);
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    // ---------- 内部实现 ----------

    private class Counter {
        int n = 0;
    }

    private class ProgressReporter {
        private long lastAt = 0;

        void maybeNotify(int done) {
            long now = System.currentTimeMillis();
            if (now - lastAt < 220) return;
            lastAt = now;
            JSObject p = new JSObject();
            p.put("count", done);
            notifyListeners("progress", p);
        }
    }

    private void walk(
        ContentResolver resolver,
        Uri treeUri,
        String docId,
        String relPath,
        File targetDir,
        List<JSObject> out,
        Counter counter,
        ProgressReporter progress
    ) {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId);
        Cursor cursor = null;
        List<String[]> dirs = new ArrayList<>();
        try {
            cursor = resolver.query(childrenUri, PROJ, null, null, null);
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                if (name == null || name.startsWith(".") || name.equalsIgnoreCase("__MACOSX")) continue;

                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    dirs.add(new String[] { id, name });
                    continue;
                }
                if (!isImage(name)) continue;

                String rel = relPath.isEmpty() ? name : relPath + "/" + name;
                File dest = new File(targetDir, "f" + counter.n + extOf(name));
                if (!copyFile(resolver, DocumentsContract.buildDocumentUriUsingTree(treeUri, id), dest)) {
                    continue;
                }
                JSObject o = new JSObject();
                o.put("rel", rel);
                o.put("name", name);
                o.put("abs", dest.getAbsolutePath());
                o.put("size", dest.length());
                out.add(o);
                counter.n++;
                progress.maybeNotify(counter.n);
            }
        } catch (Exception ignored) {
        } finally {
            // 必须在继续递归前关掉，避免游标耗尽
            if (cursor != null) cursor.close();
        }

        for (String[] d : dirs) {
            String childRel = relPath.isEmpty() ? d[1] : relPath + "/" + d[1];
            walk(resolver, treeUri, d[0], childRel, targetDir, out, counter, progress);
        }
    }

    private boolean copyFile(ContentResolver resolver, Uri src, File dest) {
        InputStream in = null;
        FileOutputStream out = null;
        try {
            in = resolver.openInputStream(src);
            if (in == null) return false;
            out = new FileOutputStream(dest);
            byte[] buf = new byte[32 * 1024];
            int len;
            while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
            out.flush();
            return true;
        } catch (Exception e) {
            dest.delete();
            return false;
        } finally {
            try {
                if (in != null) in.close();
            } catch (Exception ignored) {}
            try {
                if (out != null) out.close();
            } catch (Exception ignored) {}
        }
    }

    private String queryName(ContentResolver resolver, Uri treeUri, String docId) {
        Cursor c = null;
        try {
            Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
            c = resolver.query(
                docUri,
                new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME },
                null,
                null,
                null
            );
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    private boolean isImage(String name) {
        String ext = extOf(name);
        for (String e : IMAGE_EXT) if (e.equals(ext)) return true;
        return false;
    }

    private String extOf(String name) {
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase(Locale.ROOT);
    }

    private void deleteTree(File f) {
        if (f == null) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteTree(k);
        }
        f.delete();
    }
}
