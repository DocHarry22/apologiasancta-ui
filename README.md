# Apologia Sancta UI

Next.js frontend for Apologia Sancta Live, including the public landing page, room-aware mobile play experience, authoring dashboard, installable web app flow, and Android wrapper scaffolding.

Built with Next.js 16, React 19, Tailwind CSS 4, and Capacitor 7.

## Features

- Room-aware mobile trivia flow with room switching while preserving player identity
- Real-time SSE state updates with automatic reconnect and polling fallback
- Room and global leaderboard views driven by the engine's `daily`, `weekly`, and `all-time` windows
- Author dashboard for content import, engine controls, persistence status, and room management
- Installable PWA flow with manifest, generated app icons, offline fallback, and service-worker registration
- Android wrapper scaffolding via Capacitor for shipping the web app inside a native shell
- Landing page install/download CTAs for browser install, iPhone Add to Home Screen, and Android APK distribution

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with install/download actions |
| `/mobile` | Mobile player experience |
| `/library` | Public topic library |
| `/library/[topicId]` | Topic detail page |
| `/author` | Protected author and engine dashboard |
| `/author/login` | Author login |
| `/manifest.webmanifest` | PWA manifest route |
| `/offline` | Offline fallback page |

The `/author` area is protected by middleware-backed session checks.

## Engine Compatibility

This UI is built for the room-aware engine release baseline:

- shared live topic progression across rooms
- room-scoped memberships, answers, scores, and leaderboard state
- room admin controls under `/admin/rooms/:roomId/*`
- paused restart recovery after engine restore

## Setup

### Prerequisites

- Node.js 18+
- npm
- A running `apologiasancta-engine` instance

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local` for local development:

```env
# Engine API base URL
NEXT_PUBLIC_ENGINE_URL=http://localhost:4000

# Optional public APK download link shown on the landing page
NEXT_PUBLIC_ANDROID_APK_URL=https://example.com/apologiasancta.apk

# Optional canonical web app URL used by Capacitor config fallback
NEXT_PUBLIC_APP_URL=https://apologiasancta.example.com
```

For Android shell builds, Capacitor also reads:

```env
CAPACITOR_SERVER_URL=https://your-deployed-ui.example.com
```

`CAPACITOR_SERVER_URL` overrides `NEXT_PUBLIC_APP_URL` in `capacitor.config.ts`.

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Install and Distribution

### Web app install

- Chromium-based browsers can install from the browser prompt or site install action
- Safari on iPhone can install through Add to Home Screen
- The app serves a manifest, app icons, and an offline fallback page for installability

### Android wrapper

The repository includes Capacitor scaffolding and a generated Android project.

```bash
# Sync web assets/config into Android
npm run cap:sync

# Add Android platform if needed
npm run cap:add:android

# Open the Android project in Android Studio
npm run cap:open:android
```

The native shell points at the deployed web app URL configured by `CAPACITOR_SERVER_URL` or `NEXT_PUBLIC_APP_URL`.

## Mobile Play Flow

1. Player opens `/mobile`.
2. UI resolves or registers a global player identity.
3. Player joins a room and receives room-scoped state.
4. SSE keeps the screen live; polling is used as fallback if the stream drops.
5. Answer, score, streak, rank, and leaderboard updates remain room-specific.

## Author Dashboard

The author dashboard supports:

- content batch import and JSON preview
- engine health and persistence visibility
- room creation and room closing
- room-scoped start, pause, resume, next, reset, and topic controls
- topic-sequence and countdown management

## Key Components

### Mobile UI

| Area | Purpose |
|------|---------|
| `src/components/mobile` | Player HUD, answers, leaderboard, ticker, admin drawer |
| `src/hooks/useQuizSSE.ts` | SSE lifecycle, reconnects, and polling fallback |
| `src/hooks/useLocalPlayer.ts` | Local identity persistence |
| `src/hooks/useLeaderboardDiff.ts` | Leaderboard change animation support |

### Authoring and engine control

| Area | Purpose |
|------|---------|
| `src/components/author` | Dashboard, import, engine control, JSON preview |
| `src/lib/engineAdmin.ts` | Client wrapper for engine and room admin endpoints |
| `middleware.ts` | Session gate for `/author` routes |

### Installability

| Area | Purpose |
|------|---------|
| `src/components/pwa` | Service worker registration |
| `public/app-icons` | Generated install icons |
| `capacitor.config.ts` | Android shell configuration |

## Development

```bash
# Local development
npm run dev

# Linting
npm run lint

# Production verification
npm run build
```

## Project Structure

```
src/
├── app/                  # Next app routes, pages, and API routes
├── components/           # Author, library, mobile, UI, and PWA components
├── hooks/                # Player, SSE, and animation hooks
├── lib/                  # Engine API clients, content helpers, auth, theme
├── types/                # Shared frontend types
└── content/              # Topic content consumed by the UI

android/                  # Capacitor Android project
public/                   # Static assets
```

## License

Private

