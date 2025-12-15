# Lotus Routine

**Your Accountability Hub** - Track your progress, compete with friends, and build lasting habits.

![Lotus Routine](https://img.shields.io/badge/Lotus-Routine-purple?style=for-the-badge)

Lotus Routine is a modern accountability platform that helps you track your daily progress, compete with friends, and stay motivated through challenges, badges, and leaderboards.

## ✨ Features

### 📊 Core Tracking
- **Daily Hour Logging** - Log and track hours worked each day
- **Calendar View** - Visual calendar interface to see your progress at a glance
- **Daily Goals** - Set and track daily hour targets
- **Streak Tracking** - Maintain consecutive days of logging with streak tracking

### 🏆 Competition & Social
- **Leaderboards** - Weekly and monthly rankings to see where you stand
- **Friends System** - Add friends, send requests, and compare progress
- **Challenges** - Create and join challenges with friends
- **Activity Feed** - See what your friends are up to in real-time

### 🎖️ Achievements & Motivation
- **Badge System** - Earn badges based on milestones (Bronze, Silver, Gold, Samurai, Warrior)
- **Custom Achievements** - Add and manage your own achievements
- **Motivational Quotes** - Get inspired with daily motivational quotes
- **Analytics** - Detailed insights into your progress and patterns

### ⚙️ User Features
- **Profile Management** - Customize your profile and view your stats
- **Settings** - Personalize your experience
- **Responsive Design** - Works seamlessly on desktop and mobile

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Routing**: React Router
- **State Management**: TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Cloudflare Workers (Web) + Tauri (Desktop/Mobile)
- **Package Manager**: Bun / npm

## 📦 Prerequisites

- Node.js 20+ or Bun
- npm or bun
- Supabase account
- Cloudflare account (for deployment)

## 🛠️ Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd neon-ledger
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Environment Variables

Create a `.env` file in the `neon-ledger` directory:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

Get these values from your [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API

### 4. Database Setup

Run the Supabase migrations:

```bash
# Using Supabase CLI
supabase db push

# Or apply migrations manually in Supabase Dashboard
# Go to SQL Editor and run the files in supabase/migrations/
```

### 5. Run Development Server

```bash
npm run dev
# or
bun run dev
```

Visit `http://localhost:8080` to see the app.

## 🏗️ Build

```bash
npm run build
# or
bun run build
```

The built files will be in the `dist` directory.

## 🖥️ Desktop & Mobile Apps (Tauri)

Lotus Routine can be built as native desktop and mobile apps using Tauri.

### Quick Start

1. **Install Rust** (if not installed):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri:dev
   ```

4. **Build for your platform**:
   ```bash
   # Build for current platform
   npm run tauri:build

   # Or build for specific platforms
   npm run tauri:build:windows
   npm run tauri:build:macos
   npm run tauri:build:linux
   npm run tauri:build:android  # Mobile (beta)
   npm run tauri:build:ios      # Mobile (beta, macOS only)
   ```

### App Icons

Before building, set up your app icons:
```bash
./scripts/setup-tauri-icons.sh
```

Then add proper icon files to `src-tauri/icons/`:
- `32x32.png`, `128x128.png`, `128x128@2x.png`
- `icon.ico` (Windows)
- `icon.icns` (macOS)

### Environment Variables for Tauri

Set environment variables before building:
```bash
export VITE_SUPABASE_URL="https://your-project-id.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
npm run tauri:build
```

### More Information

See [TAURI_SETUP.md](./TAURI_SETUP.md) for detailed setup instructions, prerequisites, and troubleshooting.

---

## ☁️ Web Deployment

### Deploy to Cloudflare Workers

#### Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler` or use the local version
2. Authenticate: `npx wrangler login`

#### Quick Deploy

**Option 1: Using npm scripts**
```bash
# Set environment variables
export VITE_SUPABASE_URL="https://your-project-id.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."

# Deploy
npm run deploy
```

**Option 2: Using deployment script**
```bash
# Set environment variables
export VITE_SUPABASE_URL="https://your-project-id.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."

# Deploy
./deploy.sh
```

**Option 3: Using encrypted secrets (recommended)**
```bash
# Set secrets (one-time setup)
wrangler secret put VITE_SUPABASE_URL
wrangler secret put VITE_SUPABASE_PUBLISHABLE_KEY

# Deploy (secrets are automatically used)
npm run deploy
```

#### Environment-Specific Deployments

```bash
# Production
npm run deploy:prod

# Development
npm run deploy:dev
```

## 📁 Project Structure

```
neon-ledger/
├── src/
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # Third-party integrations (Supabase)
│   ├── lib/             # Utility functions
│   ├── pages/            # Page components
│   └── utils/            # Helper utilities
├── public/               # Static assets
├── supabase/            # Database migrations
├── worker.js            # Cloudflare Worker entry point
├── wrangler.toml        # Cloudflare Workers configuration
└── package.json         # Dependencies and scripts
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run deploy:dev` | Deploy to development environment |
| `npm run deploy:prod` | Deploy to production environment |
| `npm run tauri:dev` | Run Tauri app in development mode |
| `npm run tauri:build` | Build Tauri app for current platform |
| `npm run tauri:build:windows` | Build Windows app |
| `npm run tauri:build:macos` | Build macOS app |
| `npm run tauri:build:linux` | Build Linux app |
| `npm run tauri:build:android` | Build Android app (beta) |
| `npm run tauri:build:ios` | Build iOS app (beta) |

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key | Yes |

**Note**: These are build-time variables. They get baked into your JavaScript bundle during the build process.

## 🗄️ Database Schema

The app uses Supabase (PostgreSQL) with the following main tables:

- `profiles` - User profiles
- `daily_logs` - Daily hour tracking
- `achievements` - User achievements
- `badges` - Badge definitions and awards
- `friends` - Friend relationships
- `challenges` - Challenge definitions
- `challenge_participants` - Challenge participation

See `supabase/migrations/` for the complete schema.

## 🧹 Clean Git History

To remove `.env` and `.md` files from git history:

```bash
./clean-git-history.sh
```

**Warning**: This rewrites git history. Make sure you have a backup!

## 👤 Author

**th3void**
- Email: th3void.24@protonmail.com

## 📝 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Backend powered by [Supabase](https://supabase.com/)
- Deployed on [Cloudflare Workers](https://workers.cloudflare.com/)

---

**Lotus Routine** - Your Accountability Hub 🚀
