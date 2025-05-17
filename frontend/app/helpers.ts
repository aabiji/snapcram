// --- Local storage
import * as SecureStore from "expo-secure-store";

export const storageSet = (key: string, value: any) =>
  SecureStore.setItem(key, JSON.stringify(value));

export const storageGet = async (key: string): Promise<any> => {
  const str = SecureStore.getItem(key);
  return str ? JSON.parse(str) : undefined;
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

  const isJson = payload !== undefined && typeof payload === "object";

  if (isJson) {
    headers["Accept"] = "application/json";
    headers["Content-Type"] = "application/json";
  }

  return await fetch(url, {
    method, headers,
    body: isJson ? JSON.stringify(payload) : payload
  });
}

// -- Types
export interface Flashcard {
  confident: boolean;
  front: string;
  back: string;
}

export interface Deck {
  name: string;
  cards: Flashcard[];
}
