'use client';

import { openDB } from 'idb';

const DB_NAME = 'bls_lexi_audio';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Save a base64 audio blob to IndexedDB */
export async function saveAudioBlob(id: string, base64: string): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, base64, id);
  } catch (err) {
    console.warn('audioDB.saveAudioBlob failed:', err);
  }
}

/** Retrieve a base64 audio blob from IndexedDB */
export async function getAudioBlob(id: string): Promise<string | null> {
  try {
    const db = await getDB();
    const val = await db.get(STORE_NAME, id);
    return val ?? null;
  } catch (err) {
    console.warn('audioDB.getAudioBlob failed:', err);
    return null;
  }
}

/** Delete a blob from IndexedDB */
export async function deleteAudioBlob(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  } catch (err) {
    console.warn('audioDB.deleteAudioBlob failed:', err);
  }
}
