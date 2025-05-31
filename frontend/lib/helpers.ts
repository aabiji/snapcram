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

export interface Flashcard { front: string; back: string; }

export interface Deck { id: number; name: string; cards: Flashcard[]; }

export interface Asset { uri: string; name: string; mimetype: string; }
