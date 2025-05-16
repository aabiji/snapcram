import * as SecureStore from "expo-secure-store";

export const setValue = async (key: string, value: any) =>
  SecureStore.setItem(key, JSON.stringify(value));

export const removeValue = async (key: string) =>
  SecureStore.deleteItemAsync(key);

export const getValue = async (key: string): Promise<any> => {
  const str = await SecureStore.getItem(key);
  return str ? JSON.parse(str) : undefined;
}