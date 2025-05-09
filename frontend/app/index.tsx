import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";

import * as SecureStore from "expo-secure-store";

import { useEffect, useState, useRef } from "react";

import { Button, Text, View } from "tamagui";

interface Request {
  method: string;
  endpoint: string;
  payload?: object;
  token?: string;
};

async function sendRequest(request: Request) {
  try {
    const host = process.env.EXPO_PUBLIC_HOST_ADDRESS;
    const url = `http://${host}:8080${request.endpoint}`;

    let headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (request.token) {
      headers["Authorization"] = request.token;
    }

    const response = await fetch(url, {
      method: request.method, headers,
      body: request.payload ? JSON.stringify(request.payload) : undefined,
    });

    return response;
  } catch (error) {
    console.log("WTF?", error); 
   }
}

async function localStorageSet(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

async function localStorageGet(key: string): Promise<string | null> {
  let result = await SecureStore.getItemAsync(key);
  return result;
}

export default function Index() {
  const [token, setToken] = useState("");

  const authenticate = async () => {
    const jwt = await localStorageGet("jwt");
    if (jwt != null && jwt.length > 0) {
      setToken(jwt);
      return;
    }

    const response = await sendRequest({ method: "GET", endpoint: "/create-user" });
    if (response.status == 200) {
      const json = await response.json();
      await localStorageSet("jwt", json["token"])
      setToken(json["token"]);
    }
  };

  useEffect(() => {
    try {
      authenticate();
    } catch (exception) {
      console.log("Couldn't authenticate?!");
    }
  }, []);

  return (
    <View>
      <Text>Implement me!</Text>
    </View>
  );

  /*
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [imageData, setImageData] = useState<string | undefined>("");

  const takePicture = async () => {
    const photo = await camera.current?.takePictureAsync({ base64: true });
    setImageUri(photo?.uri);
    setImageData(photo?.base64);
  };

  // Camera permission is still loading
  if (!permission) return null;

  // Permission not granted yet
  if (!permission.granted) {
    return (
      <View>
        <Text>This app requires permission to use the camera</Text>
        <Button onPress={requestPermission}>Grant permission</Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      { !imageUri &&
        <CameraView
          facing="back"
          mode="picture"
          ref={camera}
          style={{ flex: 1, width: "100%" }}>
          <Button onPress={takePicture}> Take picture </Button>
        </CameraView>
      }
      { imageUri &&
        <View>
          <Image
            source={{ uri: imageUri }}
            contentFit="contain"
            style={{ aspectRatio: 1, width: 300 }}
          />
          <Button onPress={() => setImageUri(undefined)}>Take another image!</Button>
        </View>
      }
    </View>
  );
  */
}
