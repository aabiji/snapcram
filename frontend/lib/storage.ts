import { MMKV, useMMKVObject, useMMKVString } from 'react-native-mmkv'

export const storage = new MMKV({id: "storage", encryptionKey: "hunter2"});

export const useStringStorage = (key: string, defaultValue: any) => {
    const [value, setValue] = useMMKVString(key, storage);
    return [value ?? defaultValue, setValue];
}

export const useStorage = (key: string, defaultValue: any) => {
    const [value, setValue] = useMMKVObject(key, storage);
    return [value ?? defaultValue, setValue];
}

export default storage;