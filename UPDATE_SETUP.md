# 自动更新配置（带签名）

## 一次性配置（首次发布前）

### 1. 生成密钥对

```bash
npm run tauri signer generate -- -w ~/.tauri/nexus.key
```

输入密码（可选但推荐），记住这个密码。

### 2. 配置 GitHub Secrets

访问：`https://github.com/你的用户名/你的仓库名/settings/secrets/actions`

添加：
- `TAURI_SIGNING_PRIVATE_KEY`：私钥内容（`cat ~/.tauri/nexus.key`）
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：密钥密码（如果设置了）

### 3. 更新公钥和仓库地址

编辑 `src-tauri/tauri.conf.json`：
- 将生成的公钥粘贴到 `plugins.updater.pubkey`
- 更新 `plugins.updater.endpoints` 为你的仓库地址

## 发布新版本

1. 更新版本号（3个文件）：
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. 打标签并推送：
```bash
git tag v1.0.3
git push origin v1.0.3
```

3. GitHub Actions 自动构建并生成 `updater.json`

4. 在 GitHub Releases 页面发布 Draft Release

## 用户使用

- 应用启动时自动检测更新
- 在设置页面手动检查更新
- 点击"下载并安装"自动完成更新
- 更新完成后自动重启应用

## 功能特性

✅ 自动检测更新  
✅ 后台下载  
✅ 签名验证（安全）  
✅ 一键安装  
✅ 自动重启  
✅ 多语言支持  
✅ 优雅的 UI 对话框

## 发布新版本

1. 更新版本号（3个文件）：
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. 打标签并推送：
```bash
git tag v1.0.3
git push origin v1.0.3
```

3. GitHub Actions 自动构建并生成 `updater.json`

4. 在 GitHub Releases 页面发布 Draft Release

## 用户使用

应用会自动检测更新（启动时 + 每24小时），或在设置页面手动检查。
