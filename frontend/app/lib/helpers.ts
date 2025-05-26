// --- Local storage
import * as SecureStore from "expo-secure-store";

export const storageSet = (key: string, value: any) =>
  SecureStore.setItem(key, JSON.stringify(value));

export const storageRemove = async (key: string) =>
  SecureStore.deleteItemAsync(key);

export function storageGet<T>(key: string, isString?: boolean): T | undefined {
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
