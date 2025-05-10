import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { useEffect, useState } from "react";

import { Button, Text, View, Image } from "tamagui";

interface Request {
  method: string;
  endpoint: string;
  payload?: object | FormData;
  token?: string;
};

async function sendRequest(request: Request) {
  try {
    const host = process.env.EXPO_PUBLIC_HOST_ADDRESS;
    const url = `http://${host}:8080${request.endpoint}`;

    let headers = {};
    if (request.token)
      headers["Authorization"] = request.token;

    let body = request.payload;
    if (body !== undefined) {
      const isForm = body instanceof FormData;
      if (!isForm) {
        headers["Accept"] = "application/json"
        headers["Content-Type"] = "application/json" 
        body = JSON.stringify(body);
      } else {
        headers["Content-Type"] = "multipart/form-data";
      }
    }

    return await fetch(url, { method: request.method, headers, body });
  } catch (error) {
    console.log("WTF?", error); 
   }
}

const storageSet = async (key, value) => await SecureStore.setItemAsync(key, value);
const storageRemove = async (key) => await SecureStore.deleteItemAsync(key);
const storageGet = async (key) => await SecureStore.getItemAsync(key);

export default function Index() {
  const [token, setToken] = useState("");

  const authenticate = async () => {
    await storageRemove("jwt");

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

  const [imageUris, setImageUris] = useState<string[]>([]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      const paths = result.assets.map((file) => file.uri);
      setImageUris([...imageUris, ...paths]);
    }
  };

  const uploadImages = async () => {
    const formData = new FormData();
    for (let uri of imageUris) {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append("file", blob);
    }

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

      <View>
          {imageUris.map((uri, index) => (
            <Image
              id={`${index}`}
              source={{uri}}
              style={{ aspectRatio: 1 }}
            />
          ))}
      </View>
    </View>
  );
}
