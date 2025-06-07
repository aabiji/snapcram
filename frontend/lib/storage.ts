import { MMKV, useMMKVObject, useMMKVString } from 'react-native-mmkv'
import { Platform } from "react-native";

const key = process.env.EXPO_PUBLIC_STORAGE_ENCRYPTION_KEY;
const isWeb = Platform.OS === "web";
export const storage = new MMKV({id: "storage", encryptionKey: isWeb ? undefined : key });

export const useStringStorage = (key: string, defaultValue: any) => {
    const [value, setValue] = useMMKVString(key, storage);
    return [value ?? defaultValue, setValue];
}

export const useStorage = (key: string, defaultValue: any) => {
    const [value, setValue] = useMMKVObject(key, storage);
    return [value ?? defaultValue, setValue];
}

export default storage;