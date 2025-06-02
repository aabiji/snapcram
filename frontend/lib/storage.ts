import { MMKVLoader, useMMKVStorage, ProcessingModes } from "react-native-mmkv-storage";

const storageInstance = new MMKVLoader()
    .withEncryption()
    .setProcessingMode(ProcessingModes.SINGLE_PROCESS)
    .initialize();

export function useStorage<T>(key: string, defaultValue: T) {
    return useMMKVStorage<T>(key, storageInstance, defaultValue);
}

export const storeObject = async (key: string, value: any) =>
    await storageInstance.setMapAsync(key, value);

export default useStorage;
