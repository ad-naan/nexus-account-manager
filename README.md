# Nexus Account Manager

<div align="center">

<img src="src-tauri/icons/icon.png" alt="Nexus Account Manager" width="120" />

**Your AI Accounts, Unified**

[English](./README.md) | [简体中文](./README_ZH.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

A unified multi-platform AI account management tool built with Tauri, React, and Rust.

[Features](#-features) • [Installation](#-installation) • [Development](#-development) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🎯 Core Capabilities

- **🔐 Multi-Platform Support**: Manage accounts across Antigravity, Kiro, Claude, Codex, and Gemini
- **⚡ Quick Switching**: One-click account switching with automatic token refresh
- **📊 Quota Monitoring**: Real-time usage tracking and quota management
- **🔄 Auto Refresh**: Intelligent token refresh with expiration detection
- **🏷️ Organization**: Tags, groups, and search for easy account management
- **💾 Local Storage**: All data stored locally with optional backup/restore

### 🔌 Plugin Architecture

- **Extensible Platform System**: Add new platforms with minimal code
- **Modular Design**: Each platform is an independent, self-contained module
- **Type-Safe**: Full TypeScript and Rust type safety throughout
- **Hot Reload**: Development mode with instant updates

### 🎨 Modern UI/UX

- **macOS-Inspired Design**: Clean, minimalist interface with attention to detail
- **Dark/Light Theme**: Seamless theme switching with system preference detection
- **Smooth Animations**: Powered by Framer Motion for fluid transitions
- **Responsive Layout**: Optimized for all screen sizes and resolutions
- **Accessibility**: WCAG-compliant components with keyboard navigation

### 🚀 Performance Optimized

- **HTTP Client Pooling**: Reusable connections reduce latency by 50-67%
- **Search Debouncing**: Smooth input with React 19's `useDeferredValue`
- **Storage Optimization**: Debounced saves improve batch operations by 80%+
- **Log Rotation**: Automatic log file management (10MB limit)
- **Code Reusability**: Shared utilities reduce duplication by 40%

### 📦 Supported Platforms

#### 🌌 Antigravity
- Google/Anthropic AI Services
- OAuth 2.0 Authorization
- Token Import from IDE databases
- Quota Monitoring
- API Proxy Support
- Account Switching

#### 🤖 Kiro IDE
- Device Authorization Flow
- SSO Token Import
- OIDC Credentials Support
- Machine ID Management
- Auto Token Refresh
- Usage & Subscription Tracking
- Social Login (GitHub, Google, etc.)

#### 🧠 Claude (Coming Soon)
- Anthropic Claude API
- Session Management
- Usage Tracking

#### 💻 Codex (Coming Soon)
- OpenAI Codex API
- Project Management

#### 🔮 Gemini (Coming Soon)
- Google Gemini API
- Multi-modal Support

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - Latest UI framework with concurrent features
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS 4** - Utility-first styling with JIT compilation
- **Zustand** - Lightweight state management
- **React Router 7** - Client-side routing
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **Framer Motion** - Production-ready animations
- **i18next** - Internationalization (English & Chinese)

### Backend
- **Rust** - Memory-safe systems programming
- **Tauri 2** - Secure desktop framework
- **Tokio** - Async runtime
- **Reqwest** - HTTP client with connection pooling
- **Serde** - Serialization/deserialization
- **SQLite** (planned) - Local database

### Development Tools
- **Vite 7** - Lightning-fast build tool
- **TypeScript 5.8** - Latest language features
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## 📦 Installation

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **Rust** 1.70+ (latest stable)
- **npm** or **yarn** or **pnpm**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/nexus-account-manager.git
cd nexus-account-manager

# Install dependencies
npm install

# Start development server
npm run tauri:dev

# Build for production
npm run tauri:build
```

### Platform-Specific Setup

#### Windows
```bash
# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/

# Install WebView2 (usually pre-installed on Windows 10/11)
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Linux
```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  libappindicator-gtk3 \
  librsvg
```

---

## 🏗️ Project Structure

```
nexus-account-manager/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ui/                  # Base UI components (Radix UI)
│   │   ├── layout/              # Layout components
│   │   ├── common/              # Shared components
│   │   ├── accounts/            # Account-related components
│   │   └── dialogs/             # Dialog components
│   │
│   ├── platforms/               # Platform modules (Plugin system)
│   │   ├── antigravity/         # Antigravity platform
│   │   ├── kiro/                # Kiro platform
│   │   ├── claude/              # Claude platform
│   │   ├── codex/               # Codex platform
│   │   ├── gemini/              # Gemini platform
│   │   └── registry.ts          # Platform registry
│   │
│   ├── pages/                   # Page components
│   ├── stores/                  # Zustand state management
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   ├── i18n/                    # Internationalization
│   └── lib/                     # Utility functions
│
├── src-tauri/                   # Rust backend
│   └── src/
│       ├── core/                # Core modules
│       │   ├── storage.rs      # Data storage with debouncing
│       │   ├── oauth.rs        # OAuth 2.0 handling
│       │   ├── kiro.rs         # Kiro-specific logic
│       │   └── quota.rs        # Quota management
│       │
│       ├── commands/            # Tauri commands (Frontend ↔ Backend)
│       │   ├── antigravity.rs  # Antigravity commands
│       │   ├── kiro.rs         # Kiro commands
│       │   └── machine.rs      # Machine ID commands
│       │
│       ├── utils/               # Utility modules
│       │   ├── logger.rs       # Unified logging system
│       │   ├── http.rs         # HTTP client with pooling
│       │   ├── common.rs       # Shared utilities
│       │   └── config.rs       # Configuration management
│       │
│       └── lib.rs               # Main entry point
│
├── docs/                        # Documentation
│   ├── PROJECT_RULES.md         # AI programming guidelines
│   ├── ARCHITECTURE.md          # Architecture documentation
│   ├── API_PLATFORMS_GUIDE.md   # Platform development guide
│   └── OPTIMIZATION_COMPLETED.md # Performance optimization report
│
└── test/                        # Test data
```

---

## 🔌 Adding a New Platform

Our plugin architecture makes it easy to add new platforms. Here's a complete example:

### 1. Create Platform Module

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
  description: 'Manage your My Platform accounts',
  
  // Required: Account list component
  AccountList: MyPlatformAccountList,
  
  // Optional: Feature flags
  features: {
    oauth: true,
    tokenImport: false,
    quota: true,
    switching: true,
  },
}
```

### 2. Create Components

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

### 3. Add Authentication Methods

```typescript
// src/platforms/myplatform/methods/OAuthMethod.tsx
export function MyPlatformOAuthMethod() {
  const handleOAuth = async () => {
    // Your OAuth logic
    const account = await invoke('myplatform_oauth')
    await addAccount(account)
  }
  
  return <Button onClick={handleOAuth}>Connect with OAuth</Button>
}
```

### 4. Register Platform

```typescript
// src/platforms/registry.ts
import { myPlatformConfig } from './myplatform'

export const platforms: PlatformConfig[] = [
  antigravityConfig,
  kiroConfig,
  myPlatformConfig, // ✅ Add here
]
```

### 5. Add Rust Commands (Optional)

```rust
// src-tauri/src/commands/myplatform.rs
use tauri::command;

#[command]
pub async fn myplatform_oauth() -> Result<Account, String> {
    // Your backend logic
    Ok(account)
}
```

That's it! Your new platform is now fully integrated. 🎉

For detailed guidelines, see [docs/API_PLATFORMS_GUIDE.md](./docs/API_PLATFORMS_GUIDE.md)

---

## 🤖 AI Programming Guidelines

This project follows **strict AI programming rules** to maintain code quality and consistency.

### For AI-Assisted Development

Before using any AI assistant (Claude, ChatGPT, Copilot, etc.), **include this statement**:

```markdown
Please strictly follow all rules defined in #[[file:docs/PROJECT_RULES.md]] during development.
```

### Key Rules

- ✅ Use existing UI components from `src/components/ui/`
- ✅ Use Zustand for state management
- ✅ Use unified logging system in Rust (`log_info`, `log_warn`, etc.)
- ✅ Follow the established project structure
- ❌ Do NOT introduce new dependencies without approval
- ❌ Do NOT modify core architecture
- ❌ Do NOT use `println!` or `eprintln!` in Rust code

For complete guidelines, see: **[docs/PROJECT_RULES.md](./docs/PROJECT_RULES.md)**

---

## 🧪 Development

### Available Scripts

```bash
# Frontend development
npm run dev              # Start Vite dev server
npm run build            # Build frontend for production

# Tauri development
npm run tauri:dev        # Start Tauri in development mode
npm run tauri:build      # Build Tauri app for production
npm run tauri:build:debug # Build with debug symbols

# Code quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run type-check       # Run TypeScript type checking
```

### Development Workflow

1. **Start Development Server**
   ```bash
   npm run tauri:dev
   ```
   This starts both the Vite dev server and Tauri app with hot reload.

2. **Make Changes**
   - Frontend: Edit files in `src/`, changes reflect instantly
   - Backend: Edit files in `src-tauri/src/`, app restarts automatically

3. **Test Your Changes**
   - Use the app to test functionality
   - Check browser console for frontend logs
   - Check terminal for backend logs

4. **Build for Production**
   ```bash
   npm run tauri:build
   ```
   Outputs are in `src-tauri/target/release/bundle/`

### Debugging

#### Frontend
- Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
- React DevTools: Install browser extension
- Zustand DevTools: Built-in state inspection

#### Backend
- Logs are in `~/.local/share/com.nexus.account-manager/logs/app.log`
- Use `log_info!()`, `log_warn!()`, `log_error!()` for debugging
- Attach debugger: `rust-lldb` or `rust-gdb`

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

- 🐛 **Report Bugs**: Open an issue with detailed reproduction steps
- 💡 **Suggest Features**: Share your ideas in discussions
- 📝 **Improve Documentation**: Fix typos, add examples, clarify instructions
- 🔧 **Submit Pull Requests**: Fix bugs or implement features

### Contribution Guidelines

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/nexus-account-manager.git
   cd nexus-account-manager
   git checkout -b feature/your-feature-name
   ```

2. **Follow Project Rules**
   - Read [docs/PROJECT_RULES.md](./docs/PROJECT_RULES.md)
   - Use existing patterns and conventions
   - Write clean, documented code

3. **Test Your Changes**
   - Ensure the app builds without errors
   - Test all affected functionality
   - Add tests if applicable

4. **Submit Pull Request**
   - Write a clear description of changes
   - Reference related issues
   - Wait for review and address feedback

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

---

## 👥 Contributors

Thanks to these wonderful people who have contributed to this project:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/adnaan">
        <img src="https://github.com/adnaan-worker.png" width="100px;" alt="adnaan"/>
        <br />
        <sub><b>adnaan</b></sub>
      </a>
      <br />
      <sub>Project Lead & Core Developer</sub>
    </td>
    <td align="center">
      <a href="https://github.com/027xiguapi">
        <img src="https://github.com/027xiguapi.png" width="100px;" alt="xiguapi"/>
        <br />
        <sub><b>xiguapi</b></sub>
      </a>
      <br />
      <sub>Contributor</sub>
    </td>
  </tr>
</table>

Want to see your name here? [Contribute to the project!](#-contributing)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 adnaan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

This project stands on the shoulders of giants:

### Inspiration
- [Antigravity Manager](https://github.com/lbjlaq/Antigravity-Manager) - Original inspiration for multi-account management
- [Kiro Account Manager](https://github.com/kiro-dev/kiro-account-manager) - Kiro platform integration patterns

### Technologies
- [Tauri](https://tauri.app/) - Secure desktop framework
- [React](https://react.dev/) - UI library
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

### Community
- All our [contributors](#-contributors)
- The Tauri Discord community
- The Rust community

---

## 📞 Support

### Getting Help

- 📖 **Documentation**: Check [docs/](./docs/) folder
- 💬 **Discussions**: Ask questions in GitHub Discussions
- 🐛 **Issues**: Report bugs in GitHub Issues
- 📧 **Email**: Contact maintainers directly

### Useful Links

- [Project Documentation](./docs/)
- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Platform Development Guide](./docs/API_PLATFORMS_GUIDE.md)
- [Performance Optimization Report](./docs/OPTIMIZATION_COMPLETED.md)

---

## 🗺️ Roadmap

### v1.1 (Q2 2026)
- [ ] Claude platform integration
- [ ] Codex platform integration
- [ ] Gemini platform integration
- [ ] Virtual scrolling for large account lists
- [ ] Advanced search and filtering

### v1.2 (Q3 2026)
- [ ] SQLite database migration
- [ ] Cloud sync (optional)
- [ ] Account groups and tags
- [ ] Batch operations
- [ ] Export/import improvements

### v2.0 (Q4 2026)
- [ ] Plugin marketplace
- [ ] Custom themes
- [ ] Advanced automation
- [ ] API for third-party integrations
- [ ] Mobile companion app

---

<div align="center">

**Made with ❤️ by the Nexus Team**

[⬆ Back to Top](#nexus-account-manager)

</div>
