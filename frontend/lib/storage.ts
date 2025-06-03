import { MMKVLoader, useMMKVStorage, ProcessingModes } from "react-native-mmkv-storage";

const storageInstance = new MMKVLoader()
  .withEncryption()
  .setProcessingMode(ProcessingModes.SINGLE_PROCESS)
  .initialize();

// Get/Store the object in local storage as the specified type
export function useStorage<T>(key: string, defaultValue: T) {
  return useMMKVStorage<T>(key, storageInstance, defaultValue);
}

export const storeObject = async (key: string, value: any) =>
  await storageInstance.setMapAsync(key, value); // value stored as string!

export const getString = async (key: string) =>
  await storageInstance.getStringAsync(key);

// Custom hook to get the object as the specified type after
// it was stored as a string in local storage
export function useObject<T>(key: string, defaultValue: T) {
  const [raw, setRaw] = useMMKVStorage<string | null>(key, storageInstance, null);
  const value = raw ? (typeof raw === "string" ? JSON.parse(raw) as T : raw) : defaultValue;

  const setValue = (val: T | ((prev: T) => T)) => {
    const newVal = typeof val === "function" ? (val as (prev: T) => T)(value) : val;
    setRaw(JSON.stringify(newVal));
  };

  return [value, setValue];
}

export default useStorage;
