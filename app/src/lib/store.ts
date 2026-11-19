import { useSyncExternalStore } from "react";
import { FACE_VIEWS, type AppState, type FaceView, type Intake, type PhotoKind, type Profile, type Scan } from "./types";
import { SAMPLE_PROFILE_ID, SAMPLE_SCAN_ID, samplePhotos, sampleProfile, sampleScan, sampleVisuals } from "./sample";

/* ------------------------------------------------------------------ */
/*  Minimal IndexedDB key/value store (photos can be several MB)        */
/* ------------------------------------------------------------------ */

const DB_NAME = "facet";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key: string, value: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ------------------------------------------------------------------ */
/*  App state                                                          */
/* ------------------------------------------------------------------ */

const STATE_KEY = "state";

const empty = (): AppState => ({
  version: 1,
  profiles: [sampleProfile],
  scans: [sampleScan],
  activeProfileId: sampleProfile.id,
  progress: {},
  settings: { units: "metric", currency: "KWD" },
  visuals: { [SAMPLE_SCAN_ID]: sampleVisuals },
  bookings: [],
});

let state: AppState = empty();
let ready = false;
const photos = new Map<string, string>(); // `${scanId}:face|body` -> data URL
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function persist() {
  idbSet(STATE_KEY, state).catch((e) => console.error("persist failed", e));
}

function set(next: AppState) {
  state = next;
  persist();
  emit();
}

/** Every photo kind stored per scan (IndexedDB key `photo:${scanId}:${kind}`). */
const PHOTO_KINDS: PhotoKind[] = ["face", "body", "side", ...FACE_VIEWS];

const isSample = (profileId: string) => profileId === SAMPLE_PROFILE_ID;

/**
 * Scans a user ran under the sample profile (older builds allowed a "check-in" on the sample)
 * are moved to a profile of their own instead of being dropped.
 */
function rescueSampleScans(s: AppState, savedSample: Profile | undefined): AppState {
  const mine = s.scans.filter((x) => isSample(x.profileId) && x.id !== SAMPLE_SCAN_ID);
  if (!mine.length) return s;
  const intake = savedSample?.intake ?? sampleProfile.intake;
  const own: Profile = { id: uid(), createdAt: mine[0].createdAt, intake: { ...intake, name: intake.name === sampleProfile.intake.name ? "My analysis" : intake.name } };
  const moved = new Set(mine.map((x) => x.id));
  // habit ticks made on the sample in older builds move with the scans
  const progress = { ...s.progress };
  if (progress[SAMPLE_PROFILE_ID]) {
    progress[own.id] = progress[SAMPLE_PROFILE_ID];
    delete progress[SAMPLE_PROFILE_ID];
  }
  return {
    ...s,
    progress,
    profiles: [...s.profiles, own],
    scans: s.scans.map((x) => (moved.has(x.id) ? { ...x, profileId: own.id } : x)),
    activeProfileId: isSample(s.activeProfileId ?? "") ? own.id : s.activeProfileId,
  };
}

export async function initStore() {
  try {
    const saved = await idbGet<AppState>(STATE_KEY);
    if (saved && saved.version === 1) state = { ...empty(), ...saved, settings: { ...empty().settings, ...saved.settings }, visuals: saved.visuals ?? {}, bookings: saved.bookings ?? [] };
    if (state.settings.currency !== "KWD") state = { ...state, settings: { ...state.settings, currency: "KWD" } };
    const savedSample = state.profiles.find((p) => isSample(p.id));
    const rescued = rescueSampleScans(state, savedSample);
    const changed = rescued !== state;
    state = rescued;
    // keep the built-in sample in sync with the shipped sample data
    if (savedSample) {
      state = {
        ...state,
        profiles: state.profiles.map((p) => (isSample(p.id) ? sampleProfile : p)),
        scans: [...state.scans.filter((x) => x.id !== SAMPLE_SCAN_ID), sampleScan],
        visuals: { ...state.visuals, [SAMPLE_SCAN_ID]: sampleVisuals },
      };
    }
    if (changed) persist();
    for (const scan of state.scans) {
      for (const kind of PHOTO_KINDS) {
        const url = await idbGet<string>(`photo:${scan.id}:${kind}`);
        if (url) photos.set(`${scan.id}:${kind}`, url);
      }
    }
  } catch (e) {
    console.warn("IndexedDB unavailable; data will not persist", e);
  }
  ready = true;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState() {
  return useSyncExternalStore(subscribe, () => state);
}
export function useReady() {
  return useSyncExternalStore(subscribe, () => ready);
}
export function getState() {
  return state;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ------------------------------ Queries --------------------------- */

export function scansFor(s: AppState, profileId: string) {
  return s.scans
    .filter((x) => x.profileId === profileId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function latestScan(s: AppState, profileId: string): Scan | undefined {
  const list = scansFor(s, profileId);
  return list[list.length - 1];
}
export function photoUrl(scanId: string, kind: PhotoKind) {
  if (scanId === SAMPLE_SCAN_ID) return samplePhotos[kind] ?? null;
  return photos.get(`${scanId}:${kind}`) ?? null;
}

/* ----------------------------- Mutations -------------------------- */

/** True for the built-in sample profile, which never takes a customer's scan. */
export function isSampleProfile(profileId: string | null | undefined) {
  return !!profileId && isSample(profileId);
}

/** The user has at least one profile of their own (not the sample). */
export function hasOwnProfile(s: AppState) {
  return s.profiles.some((p) => !p.sample && !isSample(p.id));
}

export function createProfile(intake: Intake): Profile {
  const p: Profile = { id: uid(), createdAt: new Date().toISOString(), intake };
  set({ ...state, profiles: [...state.profiles, p], activeProfileId: p.id });
  return p;
}

export function updateIntake(profileId: string, intake: Intake) {
  set({
    ...state,
    profiles: state.profiles.map((p) => (p.id === profileId ? { ...p, intake } : p)),
  });
}

export async function addScan(scan: Scan, facePhoto: string | null, bodyPhoto: string | null, sidePhoto: string | null = null, views: Partial<Record<FaceView, string>> = {}) {
  if (isSample(scan.profileId)) throw new Error("Scans can't be added to the sample profile. Start a new analysis instead.");
  for (const [kind, url] of Object.entries(views) as [FaceView, string][]) {
    if (!url) continue;
    photos.set(`${scan.id}:${kind}`, url);
    await idbSet(`photo:${scan.id}:${kind}`, url).catch(() => {});
  }
  if (sidePhoto) {
    photos.set(`${scan.id}:side`, sidePhoto);
    await idbSet(`photo:${scan.id}:side`, sidePhoto).catch(() => {});
  }
  if (facePhoto) {
    photos.set(`${scan.id}:face`, facePhoto);
    await idbSet(`photo:${scan.id}:face`, facePhoto).catch(() => {});
  }
  if (bodyPhoto) {
    photos.set(`${scan.id}:body`, bodyPhoto);
    await idbSet(`photo:${scan.id}:body`, bodyPhoto).catch(() => {});
  }
  set({ ...state, scans: [...state.scans, scan], activeProfileId: scan.profileId });
}

export function updateScan(id: string, patch: Partial<Scan>) {
  set({ ...state, scans: state.scans.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
}

export function setReview(id: string, patch: Partial<import("./types").Review>) {
  const cur = state.scans.find((x) => x.id === id)?.review ?? { status: "awaiting" as const, checks: {}, hiddenItems: [], itemNotes: {}, note: "" };
  updateScan(id, { review: { ...cur, ...patch, updatedAt: new Date().toISOString() } });
}

export function setActiveProfile(id: string) {
  if (state.activeProfileId !== id) set({ ...state, activeProfileId: id });
}

/** Remove every stored photo kind of a scan from memory and IndexedDB. */
function dropPhotos(scanId: string) {
  for (const k of PHOTO_KINDS) {
    photos.delete(`${scanId}:${k}`);
    idbDel(`photo:${scanId}:${k}`).catch(() => {});
  }
}

function withoutVisuals(visuals: AppState["visuals"], scanIds: string[]) {
  const next = { ...visuals };
  for (const id of scanIds) if (id !== SAMPLE_SCAN_ID) delete next[id];
  return next;
}

export function deleteProfile(id: string) {
  const gone = state.scans.filter((s) => s.profileId === id).map((s) => s.id);
  gone.forEach(dropPhotos);
  const profiles = state.profiles.filter((p) => p.id !== id);
  const progress = { ...state.progress };
  delete progress[id];
  set({
    ...state,
    profiles,
    scans: state.scans.filter((s) => s.profileId !== id),
    progress,
    visuals: withoutVisuals(state.visuals, gone),
    bookings: (state.bookings ?? []).filter((b) => b.profileId !== id),
    activeProfileId: state.activeProfileId === id ? profiles[0]?.id ?? null : state.activeProfileId,
  });
}

export function deleteScan(id: string) {
  dropPhotos(id);
  set({ ...state, scans: state.scans.filter((s) => s.id !== id), visuals: withoutVisuals(state.visuals, [id]) });
}

export function toggleProgress(profileId: string, itemId: string) {
  const mine = { ...(state.progress[profileId] ?? {}) };
  if (mine[itemId]) delete mine[itemId];
  else mine[itemId] = new Date().toISOString();
  set({ ...state, progress: { ...state.progress, [profileId]: mine } });
}

export function setUnits(units: "metric" | "imperial") {
  set({ ...state, settings: { ...state.settings, units } });
}

export function setReviewerName(reviewerName: string) {
  set({ ...state, settings: { ...state.settings, reviewerName } });
}

export function setStaff(staff: boolean) {
  set({ ...state, settings: { ...state.settings, staff } });
}

export function setPhotoMode(photoMode: "studio" | "original") {
  set({ ...state, settings: { ...state.settings, photoMode } });
}

export function setCurrency(currency: import("./types").Currency) {
  set({ ...state, settings: { ...state.settings, currency } });
}

export function setVisuals(scanId: string, patch: Partial<import("./types").Visuals>) {
  set({ ...state, visuals: { ...state.visuals, [scanId]: { ...(state.visuals[scanId] ?? {}), ...patch } } });
}

/* --------------------------- Import / export ---------------------- */

export async function exportAll(): Promise<string> {
  const photoDump: Record<string, string> = {};
  photos.forEach((v, k) => (photoDump[k] = v));
  return JSON.stringify({ state, photos: photoDump });
}

export async function importAll(json: string) {
  const parsed = JSON.parse(json) as { state: AppState; photos: Record<string, string> };
  if (!parsed?.state || parsed.state.version !== 1) throw new Error("Unrecognised backup file");
  photos.clear();
  for (const [k, v] of Object.entries(parsed.photos ?? {})) {
    photos.set(k, v);
    await idbSet(`photo:${k}`, v);
  }
  set(parsed.state);
}

export async function resetAll() {
  const keys = [...photos.keys()];
  photos.clear();
  await Promise.all(keys.map((k) => idbDel(`photo:${k}`).catch(() => {})));
  set(empty());
}

/* ----------------------------- Bookings --------------------------- */

export function addBooking(b: Omit<import("./types").Booking, "id" | "createdAt" | "status">) {
  const booking = { ...b, id: uid(), createdAt: new Date().toISOString(), status: "requested" as const };
  set({ ...state, bookings: [...(state.bookings ?? []), booking] });
  return booking;
}

export function updateBookingStatus(id: string, status: import("./types").Booking["status"]) {
  set({ ...state, bookings: (state.bookings ?? []).map((b) => (b.id === id ? { ...b, status } : b)) });
}
