import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";

import { useState, useRef } from "react";

import { Button, Text, View } from "tamagui";
 
async function sendRequest(method: string, endpoint: string, payload?: object) {
  const host = process.env.EXPO_PUBLIC_HOST_ADDRESS;
  const url = `http://${host}:8080${endpoint}`;

  const response = await fetch(url, {
    method: method,
    body: payload ? null : JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  return await response.json();
}

export default function Index() {
  const demo = async () => {
    try {
      const json = await sendRequest("GET", "/");
      console.log("data", json);
    } catch (exception) {
      console.log("whoopsie!", exception);
    }
  };

  return (
    <View>
      <Button onPress={demo}>test!</Button>
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
