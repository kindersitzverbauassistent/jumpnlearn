import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export type GameMode = 'dungeon' | 'underwater';

export interface CloudHighscoreEntry {
  id: string;
  ownerUid: string;
  name: string;
  game: GameMode;
  score: number;
  date: string;
}

export interface CloudBaseWord {
  id: string;
  german: string;
  english: string;
  updatedAt: string;
}

export interface CloudAuthUser {
  uid: string;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  isAdmin: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const ADMIN_EMAIL = 'ahuf77@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_PLAYER_NAME_LENGTH = 30;
const MAX_WORD_LENGTH = 60;
const MAX_SCORE = 100_000_000;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

function sanitizePlayerName(rawName: string, fallback = 'Spieler'): string {
  const cleaned = rawName.replace(/[\r\n]+/g, ' ').trim();
  const base = cleaned || fallback.trim() || 'Spieler';
  return base.slice(0, MAX_PLAYER_NAME_LENGTH);
}

function sanitizeWordText(rawText: string): string {
  return rawText.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_WORD_LENGTH);
}

function sanitizeScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return 0;
  return Math.min(MAX_SCORE, Math.max(0, Math.trunc(rawScore)));
}

function profileSlotSlug(name: string): string {
  const normalized = name.trim().toLocaleLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `p${(hash >>> 0).toString(36)}`;
}

function isUserAdmin(user: User | null): boolean {
  if (!user || user.isAnonymous || !user.emailVerified || !user.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL;
}

function toCloudAuthUser(user: User | null): CloudAuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.isAnonymous ? 'Gast' : sanitizePlayerName(user.displayName || 'Spieler'),
    emailVerified: Boolean(user.emailVerified),
    isAnonymous: Boolean(user.isAnonymous),
    isAdmin: isUserAdmin(user),
  };
}

function formatTimestampIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function starterIndexFromId(id: string): number {
  const match = /^starter-(\d+)$/.exec(id);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

let cachedHighscores: { dungeon: CloudHighscoreEntry[]; underwater: CloudHighscoreEntry[] } = {
  dungeon: [],
  underwater: [],
};

let cachedBaseWords: CloudBaseWord[] = [];
let anonymousAuthDisabled = false;
let anonymousSignInPromise: Promise<User | null> | null = null;

async function ensureAnonymousSession(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (anonymousAuthDisabled) return null;
  if (anonymousSignInPromise) return anonymousSignInPromise;

  anonymousSignInPromise = signInAnonymously(auth)
    .then((cred) => {
      anonymousAuthDisabled = false;
      return cred.user;
    })
    .catch((error) => {
      const code = (error as { code?: string })?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        anonymousAuthDisabled = true;
      }
      return null;
    })
    .finally(() => {
      anonymousSignInPromise = null;
    });

  return anonymousSignInPromise;
}

let authReadyPromise: Promise<User | null> | null = null;
function waitForAuthReady(): Promise<User | null> {
  if (authReadyPromise) return authReadyPromise;
  authReadyPromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        void ensureAnonymousSession().then(resolve);
      }
    });
  });
  return authReadyPromise;
}

export interface CloudHighscoresApi {
  getUser: () => CloudAuthUser | null;
  isAnonymousAuthDisabled: () => boolean;
  getCachedHighscores: () => { dungeon: CloudHighscoreEntry[]; underwater: CloudHighscoreEntry[] };
  signIn: () => Promise<CloudAuthUser | null>;
  signOutUser: () => Promise<void>;
  onAuthChange: (callback: (user: CloudAuthUser | null) => void) => () => void;
  subscribeHighscores: (
    onData: (data: { dungeon: CloudHighscoreEntry[]; underwater: CloudHighscoreEntry[] }) => void,
    onError?: (message: string) => void,
  ) => () => void;
  submitHighscore: (game: GameMode, rawPlayerName: string, rawScore: number) => Promise<boolean>;
}

export interface CloudVocabularyApi {
  getCachedWords: () => CloudBaseWord[];
  subscribeBaseWords: (
    onData: (words: CloudBaseWord[]) => void,
    onError?: (message: string) => void,
  ) => () => void;
  createBaseWord: (german: string, english: string) => Promise<CloudBaseWord>;
  updateBaseWord: (wordId: string, german: string, english: string) => Promise<void>;
  deleteBaseWord: (wordId: string) => Promise<void>;
  importBaseWords: (
    entries: Array<{ id?: string; german: string; english: string }>,
  ) => Promise<{ added: number; skipped: number }>;
}

const cloudHighscoresApi: CloudHighscoresApi = {
  getUser() {
    return toCloudAuthUser(auth.currentUser);
  },

  isAnonymousAuthDisabled() {
    return anonymousAuthDisabled;
  },

  getCachedHighscores() {
    return cachedHighscores;
  },

  async signIn() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return toCloudAuthUser(result.user);
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error(
          `Diese Domain (${window.location.hostname}) muss in Firebase Authentication unter „Autorisierte Domains“ freigeschaltet werden.`,
        );
      }
      throw error;
    }
  },

  async signOutUser() {
    await signOut(auth);
    await ensureAnonymousSession();
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback(toCloudAuthUser(user));
      } else {
        void ensureAnonymousSession().then((anonUser) => {
          callback(toCloudAuthUser(anonUser));
        });
      }
    });
  },

  subscribeHighscores(onData, onError) {
    let active = true;
    let unsubscribeSnapshot: Unsubscribe | null = null;

    void waitForAuthReady().then(() => {
      if (!active) return;
      const collectionPath = 'highscores';
      const highscoresQuery = query(
        collection(db, collectionPath),
        where('isPublic', '==', true),
        limit(100),
      );

      unsubscribeSnapshot = onSnapshot(
        highscoresQuery,
        (snapshot) => {
          const dungeon: CloudHighscoreEntry[] = [];
          const underwater: CloudHighscoreEntry[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const game = data.game === 'underwater' ? 'underwater' : data.game === 'dungeon' ? 'dungeon' : null;
            if (!game || typeof data.playerName !== 'string' || typeof data.score !== 'number') return;

            const entry: CloudHighscoreEntry = {
              id: docSnap.id,
              ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
              name: data.playerName,
              game,
              score: Math.trunc(data.score),
              date: formatTimestampIso(data.updatedAt || data.createdAt),
            };

            if (game === 'dungeon') dungeon.push(entry);
            else underwater.push(entry);
          });

          const byBest = (a: CloudHighscoreEntry, b: CloudHighscoreEntry) =>
            b.score - a.score || a.date.localeCompare(b.date);
          dungeon.sort(byBest);
          underwater.sort(byBest);

          cachedHighscores = {
            dungeon: dungeon.slice(0, 20),
            underwater: underwater.slice(0, 20),
          };
          onData(cachedHighscores);
        },
        (error) => {
          onError?.('Globale Highscores konnten gerade nicht geladen werden.');
          try {
            handleFirestoreError(error, OperationType.LIST, collectionPath);
          } catch {
            // Structured error logged without breaking local UI.
          }
        },
      );
    });

    return () => {
      active = false;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };
  },

  async submitHighscore(game, rawPlayerName, rawScore) {
    let user = auth.currentUser;
    if (!user) {
      await waitForAuthReady();
      user = auth.currentUser || (await ensureAnonymousSession());
    }
    if (!user) {
      return false;
    }

    const score = sanitizeScore(rawScore);
    if (score <= 0) {
      return false;
    }

    if (!VALID_ID_REGEX.test(user.uid) || user.uid.length > 90) {
      return false;
    }

    const playerName = sanitizePlayerName(rawPlayerName, user.displayName || 'Spieler');
    const scoreId = `${user.uid}_${game}_${profileSlotSlug(playerName)}`;
    const docPath = `highscores/${scoreId}`;
    const docRef = doc(db, 'highscores', scoreId);

    let existingSnap;
    try {
      existingSnap = await getDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }

    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const existingScore = typeof existingData.score === 'number' ? Math.trunc(existingData.score) : 0;
      if (score <= existingScore) {
        return false;
      }

      try {
        await updateDoc(docRef, {
          playerName,
          score,
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    } else {
      try {
        await setDoc(docRef, {
          ownerUid: user.uid,
          playerName,
          game,
          score,
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    }
  },
};

function requireAdminUser(): User {
  const user = auth.currentUser;
  if (!isUserAdmin(user)) {
    throw new Error('Nur das Admin-Konto darf den zentralen Basiswortschatz bearbeiten.');
  }
  if (!user || !VALID_ID_REGEX.test(user.uid) || user.uid.length > 128) {
    throw new Error('Ungültige Admin-Benutzer-ID.');
  }
  return user;
}

const cloudVocabularyApi: CloudVocabularyApi = {
  getCachedWords() {
    return cachedBaseWords;
  },

  subscribeBaseWords(onData, onError) {
    let active = true;
    let unsubscribeSnapshot: Unsubscribe | null = null;

    void waitForAuthReady().then(() => {
      if (!active) return;
      const collectionPath = 'baseVocabulary';
      const wordsQuery = query(
        collection(db, collectionPath),
        where('isActive', '==', true),
        limit(2000),
      );

      unsubscribeSnapshot = onSnapshot(
        wordsQuery,
        (snapshot) => {
          const words: CloudBaseWord[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (typeof data.german !== 'string' || typeof data.english !== 'string') return;
            const german = sanitizeWordText(data.german);
            const english = sanitizeWordText(data.english);
            if (!german || !english) return;
            words.push({
              id: docSnap.id,
              german,
              english,
              updatedAt: formatTimestampIso(data.updatedAt || data.createdAt),
            });
          });

          words.sort((a, b) => {
            const idxA = starterIndexFromId(a.id);
            const idxB = starterIndexFromId(b.id);
            if (idxA !== idxB) return idxA - idxB;
            return a.german.localeCompare(b.german, 'de');
          });

          cachedBaseWords = words;
          onData(cachedBaseWords);
        },
        (error) => {
          onError?.('Basiswortschatz konnte online nicht geladen werden (lokaler Fallback aktiv).');
          try {
            handleFirestoreError(error, OperationType.LIST, collectionPath);
          } catch {
            // Structured error logged without breaking local gameplay.
          }
        },
      );
    });

    return () => {
      active = false;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };
  },

  async createBaseWord(rawGerman, rawEnglish) {
    const user = requireAdminUser();
    const german = sanitizeWordText(rawGerman);
    const english = sanitizeWordText(rawEnglish);
    if (!german || !english) {
      throw new Error('Bitte beide Übersetzungen eingeben.');
    }

    const wordId = `base-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const docPath = `baseVocabulary/${wordId}`;
    try {
      await setDoc(doc(db, 'baseVocabulary', wordId), {
        german,
        english,
        isActive: true,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }

    return {
      id: wordId,
      german,
      english,
      updatedAt: new Date().toISOString(),
    };
  },

  async updateBaseWord(wordId, rawGerman, rawEnglish) {
    const user = requireAdminUser();
    if (!VALID_ID_REGEX.test(wordId) || wordId.length > 128) {
      throw new Error('Ungültige Vokabel-ID.');
    }
    const german = sanitizeWordText(rawGerman);
    const english = sanitizeWordText(rawEnglish);
    if (!german || !english) {
      throw new Error('Bitte beide Übersetzungen eingeben.');
    }

    const docPath = `baseVocabulary/${wordId}`;
    try {
      await updateDoc(doc(db, 'baseVocabulary', wordId), {
        german,
        english,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  },

  async deleteBaseWord(wordId) {
    requireAdminUser();
    if (!VALID_ID_REGEX.test(wordId) || wordId.length > 128) {
      throw new Error('Ungültige Vokabel-ID.');
    }
    const docPath = `baseVocabulary/${wordId}`;
    try {
      await deleteDoc(doc(db, 'baseVocabulary', wordId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  },

  async importBaseWords(entries) {
    const user = requireAdminUser();
    const existingIds = new Set(cachedBaseWords.map((w) => w.id));
    const existingEnglish = new Set(cachedBaseWords.map((w) => w.english.trim().toLocaleLowerCase()));
    const toWrite: Array<{ id: string; german: string; english: string }> = [];
    let skipped = 0;

    entries.forEach((item, index) => {
      const german = sanitizeWordText(item.german);
      const english = sanitizeWordText(item.english);
      if (!german || !english) {
        skipped++;
        return;
      }
      const key = english.toLocaleLowerCase();
      if (existingEnglish.has(key)) {
        skipped++;
        return;
      }
      let candidateId = item.id && VALID_ID_REGEX.test(item.id)
        ? item.id.slice(0, 128)
        : `base-${Date.now()}-${index}`;
      while (existingIds.has(candidateId)) {
        candidateId = `${candidateId.slice(0, 120)}-1`;
      }
      existingIds.add(candidateId);
      existingEnglish.add(key);
      toWrite.push({ id: candidateId, german, english });
    });

    const CHUNK_SIZE = 400;
    for (let i = 0; i < toWrite.length; i += CHUNK_SIZE) {
      const slice = toWrite.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const word of slice) {
        batch.set(doc(db, 'baseVocabulary', word.id), {
          german: word.german,
          english: word.english,
          isActive: true,
          updatedBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'baseVocabulary');
      }
    }

    return { added: toWrite.length, skipped };
  },
};

declare global {
  interface Window {
    CloudHighscores?: CloudHighscoresApi;
    CloudVocabulary?: CloudVocabularyApi;
  }
}

window.CloudHighscores = cloudHighscoresApi;
window.CloudVocabulary = cloudVocabularyApi;
window.dispatchEvent(
  new CustomEvent('wortwelten:cloud-ready', {
    detail: { highscores: cloudHighscoresApi, vocabulary: cloudVocabularyApi },
  }),
);
