# Nexus Account Manager

<div align="center">

<img src="src-tauri/icons/icon.png" alt="Nexus Account Manager" width="120" />

**统一管理你的 AI 账号**

[English](./README.md) | [简体中文](./README_ZH.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

基于 Tauri、React 和 Rust 构建的统一多平台 AI 账号管理工具。

[功能特性](#-功能特性) • [安装](#-安装) • [开发](#-开发) • [贡献](#-贡献)

</div>

---

## ✨ 功能特性

### �� 核心能力

- **🔐 多平台支持**: 管理 Antigravity、Kiro、Claude、Codex 和 Gemini 等平台账号
- **⚡ 快速切换**: 一键切换账号，自动刷新 Token
- **📊 配额监控**: 实时追踪使用情况和配额管理
- **🔄 自动刷新**: 智能 Token 刷新，自动检测过期
- **🏷️ 组织管理**: 标签、分组和搜索，轻松管理账号
- **💾 本地存储**: 所有数据本地存储，支持备份/恢复

### 🔌 插件化架构

- **可扩展平台系统**: 用最少的代码添加新平台
- **模块化设计**: 每个平台都是独立的、自包含的模块
- **类型安全**: 全栈 TypeScript 和 Rust 类型安全
- **热重载**: 开发模式下即时更新

### 🎨 现代化 UI/UX

- **macOS 风格设计**: 简洁、极简的界面，注重细节
- **深色/浅色主题**: 无缝主题切换，支持系统偏好检测
- **流畅动画**: 由 Framer Motion 驱动的流畅过渡效果
- **响应式布局**: 针对所有屏幕尺寸和分辨率优化
- **无障碍访问**: 符合 WCAG 标准的组件，支持键盘导航

### �� 性能优化

- **HTTP 客户端池化**: 可复用连接减少延迟 50-67%
- **搜索防抖**: 使用 React 19 的 useDeferredValue 实现流畅输入
- **存储优化**: 防抖保存提升批量操作性能 80%+
- **日志轮转**: 自动日志文件管理（10MB 限制）
- **代码复用**: 共享工具减少重复代码 40%

### 📦 支持的平台

#### 🌌 Antigravity
- Google/Anthropic AI 服务
- OAuth 2.0 授权
- 从 IDE 数据库导入 Token
- 配额监控
- API 代理支持
- 账号切换

#### 🤖 Kiro IDE
- 设备授权流程
- SSO Token 导入
- OIDC 凭证支持
- 机器 ID 管理
- 自动 Token 刷新
- 使用量和订阅追踪
- 社交登录（GitHub、Google 等）

#### 🧠 Claude（即将推出）
- Anthropic Claude API
- 会话管理
- 使用量追踪

#### 💻 Codex（即将推出）
- OpenAI Codex API
- 项目管理

#### 🔮 Gemini（即将推出）
- Google Gemini API
- 多模态支持

---

## 🛠️ 技术栈

### 前端
- **React 19** - 最新的 UI 框架，支持并发特性
- **TypeScript** - 类型安全和更好的开发体验
- **Tailwind CSS 4** - 实用优先的样式，支持 JIT 编译
- **Zustand** - 轻量级状态管理
- **React Router 7** - 客户端路由
- **Radix UI** - 无障碍组件原语
- **Lucide React** - 精美的图标库
- **Framer Motion** - 生产就绪的动画
- **i18next** - 国际化（英文和中文）

### 后端
- **Rust** - 内存安全的系统编程语言
- **Tauri 2** - 安全的桌面应用框架
- **Tokio** - 异步运行时
- **Reqwest** - 支持连接池的 HTTP 客户端
- **Serde** - 序列化/反序列化
- **SQLite**（计划中）- 本地数据库

### 开发工具
- **Vite 7** - 闪电般快速的构建工具
- **TypeScript 5.8** - 最新的语言特性
- **ESLint** - 代码检查
- **Prettier** - 代码格式化

---

## 📦 安装

### 前置要求
- **Node.js** 18+（推荐 LTS 版本）
- **Rust** 1.70+（最新稳定版）
- **npm** 或 **yarn** 或 **pnpm**

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/yourusername/nexus-account-manager.git
cd nexus-account-manager

# 安装依赖
npm install

# 启动开发服务器
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

### 平台特定设置

#### Windows
```bash
# 安装 Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/

# 安装 WebView2（Windows 10/11 通常已预装）
```

#### macOS
```bash
# 安装 Xcode 命令行工具
xcode-select --install
```

#### Linux
```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl libappindicator-gtk3 librsvg
```

---

## 🏗️ 项目结构

```
nexus-account-manager/
├── src/                          # React 前端
│   ├── components/
│   │   ├── ui/                  # 基础 UI 组件（Radix UI）
│   │   ├── layout/              # 布局组件
│   │   ├── common/              # 共享组件
│   │   ├── accounts/            # 账号相关组件
│   │   └── dialogs/             # 对话框组件
│   │
│   ├── platforms/               # 平台模块（插件系统）
│   │   ├── antigravity/         # Antigravity 平台
│   │   ├── kiro/                # Kiro 平台
│   │   ├── claude/              # Claude 平台
│   │   ├── codex/               # Codex 平台
│   │   ├── gemini/              # Gemini 平台
│   │   └── registry.ts          # 平台注册中心
│   │
│   ├── pages/                   # 页面组件
│   ├── stores/                  # Zustand 状态管理
│   ├── hooks/                   # 自定义 React Hooks
│   ├── types/                   # TypeScript 类型定义
│   ├── i18n/                    # 国际化
│   └── lib/                     # 工具函数
│
├── src-tauri/                   # Rust 后端
│   └── src/
│       ├── core/                # 核心模块
│       │   ├── storage.rs      # 数据存储（支持防抖）
│       │   ├── oauth.rs        # OAuth 2.0 处理
│       │   ├── kiro.rs         # Kiro 特定逻辑
│       │   └── quota.rs        # 配额管理
│       │
│       ├── commands/            # Tauri 命令（前后端通信）
│       │   ├── antigravity.rs  # Antigravity 命令
│       │   ├── kiro.rs         # Kiro 命令
│       │   └── machine.rs      # 机器 ID 命令
│       │
│       ├── utils/               # 工具模块
│       │   ├── logger.rs       # 统一日志系统
│       │   ├── http.rs         # HTTP 客户端（支持连接池）
│       │   ├── common.rs       # 共享工具
│       │   └── config.rs       # 配置管理
│       │
│       └── lib.rs               # 主入口点
│
├── docs/                        # 文档
│   ├── PROJECT_RULES.md         # AI 编程指南
│   ├── ARCHITECTURE.md          # 架构文档
│   ├── API_PLATFORMS_GUIDE.md   # 平台开发指南
│   └── OPTIMIZATION_COMPLETED.md # 性能优化报告
│
└── test/                        # 测试数据
```

---

## 🔌 添加新平台

我们的插件架构使添加新平台变得简单。以下是完整示例：

### 1. 创建平台模块

```typescript
// src/platforms/myplatform/index.ts
import { PlatformConfig } from '@/types/platform'
import { Rocket } from 'lucide-react'
import { MyPlatformAccountList } from './components/AccountList'

export const myPlatformConfig: PlatformConfig = {
  id: 'myplatform',
  name: 'My Platform',
  icon: Rocket,
  color: '#FF6B6B',
  description: '管理你的 My Platform 账号',
  
  // 必需：账号列表组件
  AccountList: MyPlatformAccountList,
  
  // 可选：功能标志
  features: {
    oauth: true,
    tokenImport: false,
    quota: true,
    switching: true,
  },
}
```

### 2. 创建组件

```typescript
// src/platforms/myplatform/components/AccountList.tsx
import { usePlatformStore } from '@/stores/usePlatformStore'

export function MyPlatformAccountList() {
  const accounts = usePlatformStore(state => 
    state.getAccountsByPlatform('myplatform')
  )
  
  return (
    <div>
      {accounts.map(account => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  )
}
```

### 3. 添加认证方法

```typescript
// src/platforms/myplatform/methods/OAuthMethod.tsx
export function MyPlatformOAuthMethod() {
  const handleOAuth = async () => {
    // 你的 OAuth 逻辑
    const account = await invoke('myplatform_oauth')
    await addAccount(account)
  }
  
  return <Button onClick={handleOAuth}>使用 OAuth 连接</Button>
}
```

### 4. 注册平台

```typescript
// src/platforms/registry.ts
import { myPlatformConfig } from './myplatform'

export const platforms: PlatformConfig[] = [
  antigravityConfig,
  kiroConfig,
  myPlatformConfig, // ✅ 在这里添加
]
```

### 5. 添加 Rust 命令（可选）

```rust
// src-tauri/src/commands/myplatform.rs
use tauri::command;

#[command]
pub async fn myplatform_oauth() -> Result<Account, String> {
    // 你的后端逻辑
    Ok(account)
}
```

就这样！你的新平台现在已完全集成。🎉

详细指南请参阅 [docs/API_PLATFORMS_GUIDE.md](./docs/API_PLATFORMS_GUIDE.md)

---

## 🤖 AI 编程指南

本项目遵循**严格的 AI 编程规则**以保持代码质量和一致性。

### AI 辅助开发

在使用任何 AI 助手（Claude、ChatGPT、Copilot 等）之前，**请包含此声明**：

```markdown
请在开发过程中严格遵守 #[[file:docs/PROJECT_RULES.md]] 中定义的所有规则。
```

### 关键规则

- ✅ 使用 `src/components/ui/` 中的现有 UI 组件
- ✅ 使用 Zustand 进行状态管理
- ✅ 在 Rust 中使用统一日志系统（`log_info`、`log_warn` 等）
- ✅ 遵循既定的项目结构
- ❌ 未经批准不要引入新依赖
- ❌ 不要修改核心架构
- ❌ 不要在 Rust 代码中使用 `println!` 或 `eprintln!`

完整指南请参阅：**[docs/PROJECT_RULES.md](./docs/PROJECT_RULES.md)**

---

## 🧪 开发

### 可用脚本

```bash
# 前端开发
npm run dev              # 启动 Vite 开发服务器
npm run build            # 构建生产版本前端

# Tauri 开发
npm run tauri:dev        # 以开发模式启动 Tauri
npm run tauri:build      # 构建生产版本 Tauri 应用
npm run tauri:build:debug # 构建带调试符号的版本

# 代码质量
npm run lint             # 运行 ESLint
npm run format           # 使用 Prettier 格式化代码
npm run type-check       # 运行 TypeScript 类型检查
```

### 开发工作流

1. **启动开发服务器**
   ```bash
   npm run tauri:dev
   ```
   这会同时启动 Vite 开发服务器和 Tauri 应用，支持热重载。

2. **进行更改**
   - 前端：编辑 `src/` 中的文件，更改立即反映
   - 后端：编辑 `src-tauri/src/` 中的文件，应用自动重启

3. **测试更改**
   - 使用应用测试功能
   - 检查浏览器控制台查看前端日志
   - 检查终端查看后端日志

4. **构建生产版本**
   ```bash
   npm run tauri:build
   ```
   输出在 `src-tauri/target/release/bundle/`

### 调试

#### 前端
- 打开开发工具：`Ctrl+Shift+I`（Windows/Linux）或 `Cmd+Option+I`（macOS）
- React DevTools：安装浏览器扩展
- Zustand DevTools：内置状态检查

#### 后端
- 日志位于 `~/.local/share/com.nexus.account-manager/logs/app.log`
- 使用 `log_info!()`、`log_warn!()`、`log_error!()` 进行调试
- 附加调试器：`rust-lldb` 或 `rust-gdb`

---

## 🤝 贡献

我们欢迎贡献！以下是你可以帮助的方式：

### 贡献方式

- 🐛 **报告 Bug**：提交包含详细复现步骤的 issue
- 💡 **建议功能**：在讨论区分享你的想法
- 📝 **改进文档**：修复错别字、添加示例、澄清说明
- 🔧 **提交 Pull Request**：修复 bug 或实现功能

### 贡献指南

1. **Fork 仓库**
   ```bash
   git clone https://github.com/yourusername/nexus-account-manager.git
   cd nexus-account-manager
   git checkout -b feature/your-feature-name
   ```

2. **遵循项目规则**
   - 阅读 [docs/PROJECT_RULES.md](./docs/PROJECT_RULES.md)
   - 使用现有的模式和约定
   - 编写清晰、有文档的代码

3. **测试你的更改**
   - 确保应用无错误构建
   - 测试所有受影响的功能
   - 如适用，添加测试

4. **提交 Pull Request**
   - 编写清晰的更改描述
   - 引用相关 issue
   - 等待审查并处理反馈

### 行为准则

- 尊重和包容
- 提供建设性反馈
- 关注代码，而非个人
- 帮助他人学习和成长

---

## 👥 贡献者

感谢这些为本项目做出贡献的优秀人员：

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/adnaan">
        <img src="https://github.com/adnaan-worker.png" width="100px;" alt="adnaan"/>
        <br />
        <sub><b>adnaan</b></sub>
      </a>
      <br />
      <sub>项目负责人 & 核心开发者</sub>
    </td>
    <td align="center">
      <a href="https://github.com/027xiguapi">
        <img src="https://github.com/027xiguapi.png" width="100px;" alt="xiguapi"/>
        <br />
        <sub><b>xiguapi</b></sub>
      </a>
      <br />
      <sub>贡献者</sub>
    </td>
  </tr>
</table>

想看到你的名字在这里？[为项目做贡献！](#-贡献)

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

```
MIT License

Copyright (c) 2026 adnaan

特此免费授予任何获得本软件及相关文档文件（"软件"）副本的人
不受限制地处理本软件的权利，包括但不限于使用、复制、修改、
合并、发布、分发、再许可和/或销售本软件副本的权利，
以及允许获得本软件的人这样做，但须符合以下条件：

上述版权声明和本许可声明应包含在本软件的所有副本或
主要部分中。
```

---

## 🙏 致谢

本项目站在巨人的肩膀上：

### 灵感来源
- [Antigravity Manager](https://github.com/lbjlaq/Antigravity-Manager) - 多账号管理的原始灵感
- [Kiro Account Manager](https://github.com/kiro-dev/kiro-account-manager) - Kiro 平台集成模式

### 技术
- [Tauri](https://tauri.app/) - 安全的桌面应用框架
- [React](https://react.dev/) - UI 库
- [Rust](https://www.rust-lang.org/) - 系统编程语言
- [Radix UI](https://www.radix-ui.com/) - 无障碍组件
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS

### 社区
- 所有我们的[贡献者](#-贡献者)
- Tauri Discord 社区
- Rust 社区

---

## 📞 支持

### 获取帮助

- 📖 **文档**：查看 [docs/](./docs/) 文件夹
- 💬 **讨论**：在 GitHub Discussions 中提问
- 🐛 **Issues**：在 GitHub Issues 中报告 bug
- 📧 **邮件**：直接联系维护者

### 有用链接

- [项目文档](./docs/)
- [架构指南](./docs/ARCHITECTURE.md)
- [平台开发指南](./docs/API_PLATFORMS_GUIDE.md)
- [性能优化报告](./docs/OPTIMIZATION_COMPLETED.md)

---

## 🗺️ 路线图

### v1.1（2026 年第二季度）
- [ ] Claude 平台集成
- [ ] Codex 平台集成
- [ ] Gemini 平台集成
- [ ] 大账号列表的虚拟滚动
- [ ] 高级搜索和过滤

### v1.2（2026 年第三季度）
- [ ] SQLite 数据库迁移
- [ ] 云同步（可选）
- [ ] 账号分组和标签
- [ ] 批量操作
- [ ] 导出/导入改进

### v2.0（2026 年第四季度）
- [ ] 插件市场
- [ ] 自定义主题
- [ ] 高级自动化
- [ ] 第三方集成 API
- [ ] 移动伴侣应用

---

<div align="center">

**由 Nexus 团队用 ❤️ 制作**

[⬆ 返回顶部](#nexus-account-manager)

</div>
