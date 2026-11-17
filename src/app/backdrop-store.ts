import { isText, readBackdrop } from '../scene/backdrop-settings.ts';
import type { BackdropSettings, Json } from '../scene/backdrop-settings.ts';

/**
 * The browser storage of the stage dressing (design 4.5, backdrop): the settings in the local
 * storage, and the images of the user in IndexedDB, because an image is too large for the local
 * storage. No image leaves the browser (design 2.7).
 */

/** The key of the settings in the local storage. */
const SETTINGS_KEY = 'orchestra-backdrop';

/** The database and the store of the images. */
const DATABASE = { name: 'orchestra-backdrop', version: 1, store: 'images' } as const;

/** The longest side of a stored image, in pixels. A banner or a screen needs no more. */
export const IMAGE_MAX_SIDE = 1600;

/** One image of the user, as the database keeps it. */
export interface StoredImage {
  /** The id: `img:<uuid>`. */
  readonly id: string;
  /** The file name, for the list of the panel. */
  readonly name: string;
  /** The image, as a PNG file. */
  readonly blob: Blob;
}

/**
 * Tells if a value of the database is a stored image.
 *
 * @param value The value.
 * @returns True for an image.
 */
function isStoredImage(value: unknown): value is StoredImage {
  return (
    value instanceof Object &&
    'id' in value &&
    'name' in value &&
    'blob' in value &&
    isText(value.id) &&
    isText(value.name) &&
    value.blob instanceof Blob
  );
}

/**
 * Reads the settings of the dressing, or gives the defaults.
 *
 * @returns The settings.
 */
export function loadBackdropSettings(): BackdropSettings {
  try {
    const text = window.localStorage.getItem(SETTINGS_KEY);
    const data: Json = text ? JSON.parse(text) : null;
    return readBackdrop(data);
  } catch {
    // The browser keeps no data, for example in a private window, or the data is broken.
    return readBackdrop(null);
  }
}

/**
 * Saves the settings of the dressing.
 *
 * @param settings The settings.
 */
export function saveBackdropSettings(settings: BackdropSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The browser keeps no data, for example in a private window.
  }
}

/**
 * Opens the database of the images.
 *
 * @returns The database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE.name, DATABASE.version);
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(DATABASE.store, { keyPath: 'id' });
    });
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('The image store did not open.'));
    });
  });
}

/**
 * Runs one request on the store of the images, and closes the database.
 *
 * @param mode The mode of the transaction.
 * @param run Makes the request.
 * @returns The result of the request.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(DATABASE.store, mode).objectStore(DATABASE.store));
      request.addEventListener('success', () => {
        resolve(request.result);
      });
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('The image store failed.'));
      });
    });
  } finally {
    database.close();
  }
}

/**
 * Reads all the images of the user.
 *
 * @returns The images, or none when the browser keeps no data.
 */
export async function loadImages(): Promise<StoredImage[]> {
  try {
    const all = await withStore('readonly', (store) => store.getAll());
    return all.filter(isStoredImage);
  } catch {
    return [];
  }
}

/**
 * Saves an image of the user.
 *
 * @param image The image.
 */
export async function saveImage(image: StoredImage): Promise<void> {
  await withStore('readwrite', (store) => store.put(image));
}

/**
 * Deletes an image of the user.
 *
 * @param id The image id.
 */
export async function deleteImage(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

/**
 * Draws an image file on a canvas, at most {@link IMAGE_MAX_SIDE} on its longest side.
 *
 * @param blob The image file.
 * @returns The canvas.
 */
export async function decodeImage(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Makes the PNG file of a canvas.
 *
 * @param canvas The canvas.
 * @returns The file.
 */
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('The image could not be saved.'));
      }
    }, 'image/png');
  });
}
