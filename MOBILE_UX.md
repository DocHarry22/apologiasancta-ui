# Mobile UX

Phase 4 focuses `/mobile` on fast, readable live play for phones first.

## Route States

The mobile route presents clear states for:

- Connecting
- Live
- Reconnecting
- Polling fallback
- Offline / engine unavailable
- Waiting for host
- OPEN
- LOCKED
- REVEAL
- Topic countdown
- Topic complete
- Congrats / series complete

The last known quiz state stays visible during reconnects where possible.

## Onboarding Flow

Players move through these states:

- No room selected: choose a room.
- Room selected but no display name: enter your display name.
- Display name saved but not registered: join this room.
- Registered: waiting for host or ready to answer.
- Engine unavailable: safe message with no raw stack trace.
- Room closed: shown in the room picker and disabled for joining.

Display names are stored locally for convenience and verified with the engine when available.

## Room Join Flow

Players can:

- View active and closed rooms.
- Search rooms.
- See player counts.
- Copy room links.
- Switch rooms with confirmation.
- Join from `/mobile?roomId=abc` or `/mobile?room=abc`.

Room IDs from query strings are sanitized as plain player routing hints. They are never admin authority.

## Gameplay Phases

OPEN:

- Answer buttons are enabled.
- One tap immediately locks the selected answer locally.
- A submitted chip confirms the answer.
- Duplicate taps are prevented.

LOCKED:

- Answers are disabled.
- The selected answer remains visible.
- The UI says “Answers locked.”

REVEAL:

- Correct answer is highlighted.
- Incorrect selected answer is marked.
- Points/streak feedback is shown when available.
- Teaching moment is available in a compact expandable card.

## Leaderboard

Phones do not show a permanent right-side leaderboard rail. They show:

- Compact top 3 preview.
- Floating leaderboard button.
- Bottom drawer with Room, Global, Streaks, Daily, Weekly, and All-time views.
- Loading, empty, error, refresh, and last-updated states.

Desktop/tablet can keep the richer side panel.

## Teaching Moment

Teaching content is hidden during OPEN and appears after REVEAL. It includes:

- Title
- Explanation
- Plain-text references
- Graceful fallback for missing references

References are structured for future linking to library/reference pages.

## Reconnect and Offline Behavior

The connection pill shows:

- Live
- Connecting
- Reconnecting
- Polling
- Offline

The app avoids raw technical errors in the player UI. Retry happens in the hook, and polling fallback is visible when SSE fails.

## Mobile Admin Drawer

The mobile admin drawer remains token-free and uses `/api/admin` proxy calls. It is hidden from ordinary production players by default and only appears with `?admin=1` or in development. Unlock requires a valid author/admin session; unauthenticated users see a locked state.

## PWA Considerations

The service worker caches app shell/static assets but excludes live and admin traffic:

- `/api/*`
- `/events`
- `/state`
- `/answer`
- `/register`
- `/rooms`
- `/leaderboard`
- `/admin`

Safe area padding remains on the mobile shell so controls are not hidden behind notches or home indicators.

## Mobile Viewport Testing

Use widths around:

- 360px
- 390px
- 412px
- 430px

Expected result: full-width question/answers, no permanent leaderboard rail below 520px, large answer buttons, compact header, and drawer-based leaderboard.
