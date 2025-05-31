import { MMKVLoader, useMMKVStorage, ProcessingModes } from "react-native-mmkv-storage";

const storageInstance = new MMKVLoader()
    .withEncryption()
    .setProcessingMode(ProcessingModes.SINGLE_PROCESS)
    .initialize();

export const useStorage = (key: any, defaultValue: any) =>
    useMMKVStorage(key, storageInstance, defaultValue);
export default useStorage;
