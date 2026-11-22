import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, query, collection, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

const uid1 = 'anonUserAlpha1';
const uid2 = 'userBeta456';
const adminUid = 'adminOwner789';

function validHighscorePayload(uid: string, game: 'dungeon' | 'underwater' = 'dungeon', score = 120) {
  return {
    ownerUid: uid,
    playerName: 'Franz',
    game,
    score,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validBaseWordPayload(uid: string, german = 'der Mond', english = 'moon') {
  return {
    german,
    english,
    isActive: true,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function runRulesTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'wortwelten-rules-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const anonPlayerDb = testEnv.authenticatedContext(uid1, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    const spoofedAdminDb = testEnv.authenticatedContext(uid1, { email: 'ahuf77@gmail.com', email_verified: false }).firestore();
    const user2Db = testEnv.authenticatedContext(uid2, { email: 'u2@example.com', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext(adminUid, { email: 'ahuf77@gmail.com', email_verified: true }).firestore();

    // Highscores: anonymous player happy path (both exact and profile-suffixed slot)
    await assertSucceeds(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_dungeon`), validHighscorePayload(uid1, 'dungeon', 150)));
    await assertSucceeds(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_dungeon_leo`), validHighscorePayload(uid1, 'dungeon', 220)));
    await assertSucceeds(getDoc(doc(unauthDb, 'highscores', `${uid1}_dungeon`)));
    await assertSucceeds(getDocs(query(collection(unauthDb, 'highscores'), where('isPublic', '==', true))));

    // Highscores adversarial checks
    await assertFails(setDoc(doc(unauthDb, 'highscores', 'unauth_dungeon'), validHighscorePayload('unauth')));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', `${uid2}_dungeon`), validHighscorePayload(uid2)));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', 'custom_slot_1'), validHighscorePayload(uid1)));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_underwater`), { ...validHighscorePayload(uid1, 'underwater'), isAdmin: true }));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', 'x'.repeat(130)), validHighscorePayload(uid1)));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_underwater`), { ...validHighscorePayload(uid1, 'underwater'), playerName: 'A'.repeat(31) }));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_arcade`), { ...validHighscorePayload(uid1), game: 'arcade' }));
    await assertFails(setDoc(doc(anonPlayerDb, 'highscores', `${uid1}_underwater`), { ...validHighscorePayload(uid1, 'underwater'), createdAt: new Date(0) }));
    await assertFails(updateDoc(doc(anonPlayerDb, 'highscores', `${uid1}_dungeon`), { score: 100, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(anonPlayerDb, 'highscores', `${uid1}_dungeon`), { game: 'underwater', score: 300, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(user2Db, 'highscores', `${uid1}_dungeon`), { score: 999, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(user2Db, 'highscores', `${uid1}_dungeon`)));

    // Base vocabulary: anonymous and non-admin blocked; verified admin allowed
    await assertSucceeds(setDoc(doc(adminDb, 'baseVocabulary', 'starter-0'), validBaseWordPayload(adminUid)));
    await assertSucceeds(getDoc(doc(unauthDb, 'baseVocabulary', 'starter-0')));
    await assertSucceeds(getDocs(query(collection(unauthDb, 'baseVocabulary'), where('isActive', '==', true))));

    await assertFails(setDoc(doc(anonPlayerDb, 'baseVocabulary', 'starter-1'), validBaseWordPayload(uid1)));
    await assertFails(setDoc(doc(user2Db, 'baseVocabulary', 'starter-1'), validBaseWordPayload(uid2)));
    await assertFails(setDoc(doc(spoofedAdminDb, 'baseVocabulary', 'starter-1'), validBaseWordPayload(uid1)));
    await assertFails(updateDoc(doc(anonPlayerDb, 'baseVocabulary', 'starter-0'), { german: 'Sonne', updatedBy: uid1, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(anonPlayerDb, 'baseVocabulary', 'starter-0')));
  } finally {
    await testEnv.cleanup();
  }
}
