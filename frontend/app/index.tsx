import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { useEffect, useState } from "react";
import { FlatList, StyleSheet } from "react-native";

import { Button, Image, Text, View } from "tamagui";
import { X } from "@tamagui/lucide-icons";

interface Request {
  method: string;
  endpoint: string;
  payload?: object | FormData | undefined;
  token?: string;
};

async function sendRequest(request: Request): Promise<Response> {
  try {
    const host = process.env.EXPO_PUBLIC_HOST_ADDRESS;
    const url = `http://${host}:8080${request.endpoint}`;

    let headers: Record<string, string> = {};
    if (request.token)
      headers["Authorization"] = request.token;

    let body: any = request.payload;
    if (body !== undefined) {
      const isForm = body instanceof FormData;
      if (!isForm) {
        headers["Accept"] = "application/json"
        headers["Content-Type"] = "application/json" 
        body = JSON.stringify(body);
      }
    }

    const r = await fetch(url, { method: request.method, headers, body });
    return r!;
  } catch (error) {
    console.log("WTF?", error);
   }
}

const storageSet = async (key, value) => await SecureStore.setItemAsync(key, value);
const storageGet = async (key) => await SecureStore.getItemAsync(key);

export default function Index() {
  const [token, setToken] = useState("");

  const authenticate = async () => {
    const jwt = await storageGet("jwt");
    if (jwt != null && jwt.length > 0) {
      setToken(jwt);
      return;
    }

    const response = await sendRequest({ method: "POST", endpoint: "/createUser" });
    if (response.status == 200) {
      const json = await response.json();
      await storageSet("jwt", json["token"])
      setToken(json["token"]);
    } else {
      console.log(response.status, response?.toString());
    }
  };

  useEffect(() => {
    try {
      authenticate();
    } catch (exception) {
      console.log("Couldn't authenticate?!");
    }
  }, []);

  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled)
      setImages([...images, ...result.assets]);
  };

  const uploadImages = async () => {
    const formData = new FormData();

    // Add the files
    for (let image of images) {
      formData.append("files", {
        uri: image.uri,
        type: image.mimeType,
        name: image.uri
      });
    }

    // Add the json payload
    const payload = { topicId: "1" };
    formData.append("payload", JSON.stringify(payload));

    const response = await sendRequest({
      token,
      method: "POST",
      endpoint: "/uploadNotes",
      payload: formData
    });
    const json = await response.json();
    if (response.status == 200) {
      console.log("success uploadNotes!", JSON.stringify(json));
    } else {
      console.log("error uploadNotes!", JSON.stringify(json));
    }

    setImages([]);
  }

  const createTopic = async () => {
    const response = await sendRequest({
      token,
      method: "POST",
      endpoint: "/createTopic",
      payload: { name: "example" }
    });
    const json = await response.json();
    if (response.status == 200) {
      console.log("success createTopic!", JSON.stringify(json));
    } else {
      console.log("error createTopic!", JSON.stringify(json));
    }
  };

  return (
    <View>
      <Button onPress={createTopic}>Create an example topic</Button>

      <Text> Select an image </Text>
      <Button onPress={pickImage}>Pick an image</Button>
      <Button onPress={uploadImages}>Upload</Button>

      <Button icon={X}></Button>

      <FlatList
        style={styles.imageGrid}
        data={images}
        numColumns={2}
        renderItem={({ item }) => (
          <Image style={styles.gridItem} source={{ uri: item.uri }} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gridItem: { flex: 1, aspectRatio: 1 },
  imageGrid: {
    height: 300,
    width: "95%",
    margin: "auto"
  }
});
