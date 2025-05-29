// --- Local storage
import * as SecureStore from "expo-secure-store";

export const storageSet = (key: string, value: any) =>
  SecureStore.setItem(key, JSON.stringify(value));

export const storageRemove = async (key: string) =>
  SecureStore.deleteItemAsync(key);

export function storageGet<T>(key: string): T | undefined {
  const str = SecureStore.getItem(key);
  return str !== null ? JSON.parse(str) as unknown as T : undefined;
}

export const removeValue = async (key: string) =>
  SecureStore.deleteItemAsync(key);

// -- HTTP
export async function request(
  method: string,
  endpoint: string,
  payload?: object | FormData,
  token?: string
): Promise<Response> {
  const host = process.env.EXPO_PUBLIC_HOST_ADDRESS;
  const url = `http://${host}:8080${endpoint}`;

  let headers: Record<string, string> = {};
  if (token !== undefined)
    headers["Authorization"] = token;

  const isForm = payload !== undefined && payload instanceof FormData;

  if (payload !== undefined && !isForm) {
    headers["Accept"] = "application/json";
    headers["Content-Type"] = "application/json";
  }

  return await fetch(url, {
    method, headers,
    body: isForm ? payload : JSON.stringify(payload)
  });
}

// -- Types
export interface Flashcard { front: string; back: string; }

export interface Deck { name: string; cards: Flashcard[]; }

export interface ImageInfo { uri: string; name: string; mimetype: string; }

// -- Create flashcard deck
async function generateFlashcards(
  jwt: string, fileIds: string[], numCards: number
): Promise<Flashcard[]> {
  const payload = { numCards, fileIds };
  const response = await request("POST", "/generateFlashcards", payload, jwt);
  const json = await response.json();

  if (response.status == 200)
    return json["cards"] as any as Flashcard[];
  throw new Error(json["message"] + " " + json["details"]);
}

async function processBatch(
  batch: ImageInfo[], jwt: string, numCards: number
): Promise<Flashcard[]> {
  // Upload the files
  const formData = new FormData();
  for (let asset of batch) {
    formData.append("files", {
      uri: asset.uri, type: asset.mimetype, name: asset.uri
    });
  }

  const response = await request("POST", "/uploadFiles", formData, jwt);
  const json = await response.json();

  if (response.status == 200)
    return generateFlashcards(jwt, json["files"], numCards);
  throw new Error(json["message"] + " " + json["details"]);
}

export async function createFlashcardDeck(
  assets: ImageInfo[], jwt: string, name: string, deckSize: number
): Promise<Deck> {

  // Split the input images into batches and generate flashcards from each batch
  const batchSize = 5; // 5 images per batch
  const numBatches = Math.floor(assets.length / batchSize);
  let cards = [];

  for (let i = 0; i < numBatches; i++) {
    const batch = assets.slice(i * batchSize, i * batchSize + batchSize);
    // Create lots of flashcards initially, then reduce
    // it when we create the final set of flashcards
    const set = await processBatch(batch, jwt, deckSize * 2);
    cards.push(...set);
  }

  // Create a new flashcard deck from the set of generated flashcards
  const payload = { name, deckSize, cards };
  const response = await request("POST", "/createDeck", payload, jwt);
  const json = await response.json();

  if (response.status == 200) return json;
  throw new Error(json["message"] + " " + json["details"]);
};
