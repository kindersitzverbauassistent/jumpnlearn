# Security Specification — Wortwelten Highscores & Basiswortschatz

## 1. Data Invariants

### Highscores (`/highscores/{scoreId}`)
1. **Anonymous & Google Player Identity**: Every write (`create`, `update`, `delete`) requires `request.auth != null` (supporting both Firebase Anonymous Auth for zero-popup player sessions and Google Sign-In).
2. **Ownership & Slot Partitioning**: `ownerUid == request.auth.uid`, and `scoreId` must start with `${request.auth.uid}_${game}` (either exact or followed by `_${profileSlug}`) where `game` is `"dungeon"` or `"underwater"`.
3. **Strict Schema & Bounds**: Exact keys `['ownerUid', 'playerName', 'game', 'score', 'isPublic', 'createdAt', 'updatedAt']`; `playerName` 1..30 chars; `score` int `0..100000000`; `isPublic == true`.
4. **Immutable Fields & Temporal Integrity**: `ownerUid`, `game`, `isPublic`, `createdAt` are immutable; `createdAt`/`updatedAt` must equal `request.time`.
5. **Monotonic Score Updates**: Updates may only mutate `['playerName', 'score', 'updatedAt']` with `incoming().score > existing().score`.
6. **Public Read Boundary**: Reads (`get`, `list`) require `resource.data.isPublic == true` (or `ownerUid == request.auth.uid`). Zero PII stored.

### Central Base Vocabulary (`/baseVocabulary/{wordId}`)
7. **Verified Admin-Only Central Writes**: Only the verified Google admin (`request.auth.token.email == 'ahuf77@gmail.com' && request.auth.token.email_verified == true`) can `create`, `update`, or `delete` entries in `/baseVocabulary`. Anonymous users are strictly rejected.
8. **Strict Schema & Bounds**: Exact keys `['german', 'english', 'isActive', 'updatedBy', 'createdAt', 'updatedAt']`; `german` and `english` 1..60 chars; `isActive == true`; `updatedBy == request.auth.uid`.
9. **Immutable Creation Timestamp & Temporal Integrity**: `createdAt` is immutable after creation and must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update. Updates may only affect `['german', 'english', 'updatedBy', 'updatedAt']`.
10. **Public Active Read Boundary**: Reads (`get`, `list`) only expose `resource.data.isActive == true` (or admin).

## 2. The "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Highscore Create**: Completely unauthenticated client (`request.auth == null`) creates `/highscores/anon_dungeon`.
2. **UID Spoofing**: User `uid1` (anonymous or Google) attempts to create `/highscores/uid2_dungeon` with `ownerUid: "uid2"`.
3. **Slot Squatting**: User `uid1` creates `/highscores/custom_slot_1` without matching prefix `${uid1}_${game}`.
4. **Ghost / Shadow Field Injection**: Creating `/highscores/uid1_dungeon` or `/baseVocabulary/w1` with extra `isAdmin: true`.
5. **ID Poisoning**: Document ID exceeding 128 chars or containing invalid symbols (`bad$id`).
6. **Oversized String**: `playerName` > 30 chars on highscores, or `german` / `english` > 60 chars on `baseVocabulary`.
7. **Invalid Game Mode Enum**: `game: "arcade"` on `/highscores`.
8. **Client-Spoofed Timestamp**: Hardcoded `Date` for `createdAt` or `updatedAt` instead of `request.time`.
9. **Score Downgrade**: Updating existing highscore `500` to `200`.
10. **Cross-User Update / Delete**: User `uid2` attempts to modify or delete `/highscores/uid1_dungeon`.
11. **Anonymous / Non-Admin Base Vocabulary Write**: Anonymous user or regular Google user tries to `create`, `update`, or `delete` `/baseVocabulary/starter-0`.
12. **Admin Email Spoofing (Unverified)**: Attacker token with `email: "ahuf77@gmail.com"` and `email_verified: false` tries to write `/baseVocabulary/starter-0`.
