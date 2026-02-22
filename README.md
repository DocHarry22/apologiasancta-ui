# Apologia Sancta UI

Frontend for **Apologia Sancta Live** — a real-time theology quiz platform with mobile play and OBS overlay support.

Built with Next.js 16, React 19, and Tailwind CSS 4.

## Features

- **Mobile Play UI** (`/mobile`) — Full-featured quiz interface for mobile players
- **Real-time Updates** — SSE connection to backend with automatic reconnection
- **Personal Score HUD** — Animated score feedback with rank tracking
- **Leaderboard** — Live top 10 scorers and top 5 streakers
- **Teaching Moments** — Expandable cards with catechism references
- **Dark/Light Theme** — CSS variable-based theming
- **Registration Flow** — Unique username system with collision prevention

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/mobile` | Mobile play interface |
| `/library` | Content library |
| `/author` | Author dashboard |

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Running [apologiasancta-engine](../apologiasancta-engine) backend

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Backend API URL
NEXT_PUBLIC_ENGINE_URL=http://localhost:4000

# Or for production
NEXT_PUBLIC_ENGINE_URL=https://your-api-domain.com
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Mobile Play Flow

```
┌─────────────────────────────────────────┐
│            JoinGameModal                │
│  ┌─────────────────────────────────┐    │
│  │  Enter unique username          │    │
│  │  [________________]             │    │
│  │  [Join Game]                    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    ▼ (registered)
┌─────────────────────────────────────────┐
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Question   │  │  Your Score      │  │
│  │  Card       │  │  Rank #42        │  │
│  │             │  │  Score: 150      │  │
│  │  [A] [B]    │  │  Streak: 🔥3     │  │
│  │  [C] [D]    │  ├──────────────────┤  │
│  │             │  │  Leaderboard     │  │
│  │  Teaching   │  │  1. John - 500   │  │
│  │  Moment     │  │  2. Mary - 450   │  │
│  └─────────────┘  └──────────────────┘  │
│  [Ticker: Leader: John (500)]           │
└─────────────────────────────────────────┘
```

## Components

### Mobile Components (`src/components/mobile/`)

| Component | Description |
|-----------|-------------|
| `Layout` | Two-column layout (80/20 split) |
| `TopBar` | Theme title, question counter, connection status |
| `CountdownRing` | Animated countdown timer |
| `QuestionCard` | Question text display |
| `AnswerList` | Answer options with selection states |
| `TeachingMomentCard` | Expandable teaching content |
| `LeaderboardColumn` | Top scorers and streakers |
| `YourScoreCard` | Personal score HUD with animations |
| `TickerBar` | Bottom scrolling ticker |
| `JoinGameModal` | Registration modal |
| `AdminDrawer` | Admin controls panel |

### Hooks (`src/hooks/`)

| Hook | Description |
|------|-------------|
| `useQuizSSE` | SSE connection with reconnection |
| `useLeaderboardDiff` | Detect leaderboard changes for animations |
| `useLocalPlayer` | Track local player state |
| `useScoreDeltaAnimation` | Animate score changes |

## Styling

Uses CSS custom properties for theming:

```css
:root {
  --bg: #f5f3ef;
  --card: #ffffff;
  --text: #1a1a1a;
  --accent: #c9a227;  /* Gold */
  --correct: #22c55e;
  --wrong: #ef4444;
}

[data-theme="dark"] {
  --bg: #1a1816;
  --card: #242220;
  --text: #f0ebe3;
  --accent: #d4af37;
}
```

## Project Structure

```
src/
├── app/
│   ├── globals.css       # Global styles & theme
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── mobile/
│       └── page.tsx      # Mobile play page
├── components/
│   └── mobile/
│       ├── index.ts      # Barrel exports
│       ├── Layout.tsx
│       ├── TopBar.tsx
│       ├── CountdownRing.tsx
│       ├── QuestionCard.tsx
│       ├── AnswerList.tsx
│       ├── TeachingMomentCard.tsx
│       ├── LeaderboardColumn.tsx
│       ├── YourScoreCard.tsx
│       ├── TickerBar.tsx
│       ├── JoinGameModal.tsx
│       └── AdminDrawer.tsx
├── hooks/
│   ├── useQuizSSE.ts
│   ├── useLeaderboardDiff.ts
│   ├── useLocalPlayer.ts
│   └── useScoreDeltaAnimation.tsx
├── lib/
│   ├── theme.tsx
│   └── scoreColor.ts
└── types/
    └── quiz.ts           # TypeScript types
```

## OBS Overlay

For streaming, connect OBS browser source directly to the engine SSE:

```
URL: http://localhost:4000/events
```

The UI can be customized for overlay use by creating a dedicated `/overlay` route.

## Development

```bash
# Run with hot reload
npm run dev

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

## License

Private

