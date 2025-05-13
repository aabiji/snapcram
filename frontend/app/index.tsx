import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { useEffect, useState } from "react";
import { FlatList, StyleSheet } from "react-native";

import { Button, Card, H1, H3, Image, ScrollView, Text, YStack } from "tamagui";
import { LinearGradient } from "tamagui/linear-gradient";
import { Plus } from "@tamagui/lucide-icons";

/*
TODO:
- Fix the page so that the content actually fits in the view area
- Splits this page into different components
- The image grid at the top should have at most 4 images,
  the images should be smaller, with a fade at the bottom.
  When the user clicks the view all noets button, it should
  open another screen where the user can add, delete and view assets
- The deck grid should initially have at most 4 decks,
  with a bottom fade and a show more button if there are more.
  When you click the show more button, the list should just collapse,
  (no extra sceen)
  The tiles should be nicely styles, maybe pop off the page
- The card backgrounds should be the same as the background,
  no border
- the buttons should hvae a white background and a border,
  not a background color per say
*/

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

  const createDeck = () => {};

  const decks = [
    { name: "Test deck #1" },
    { name: "Test deck #2" },
    { name: "Test deck #3" },
    { name: "Test deck #4" }
  ];

  return (
    <ScrollView backgroundColor="$background">
      <H1>Topic name</H1>

      <Card
        padding="$2"
        margin="$2"
        borderRadius="$4"
      >
        <YStack>
          {images === undefined || images.length == 0 &&
            <Button onPress={pickImage}>Add pictures of your notes or assignments</Button>
          }
          {images !== undefined && images.length > 0 &&
          <YStack position="relative" flex={1}>
              <FlatList
                style={styles.grid}
                data={images}
                numColumns={2}
                renderItem={({ item }) => (
                  <Image style={styles.gridItem} source={{ uri: item.uri }} />
                )}
                scrollEnabled={false}
              />
              <LinearGradient
                position="absolute"
                bottom={0}
                left={0}
                right={0}
                height={200}
                colors={['transparent', '$background']}
                pointerEvents="none"
              />
              <Button>View all notes</Button>
            </YStack>
          }
        </YStack>
      </Card>

      <Card
        borderRadius="$4"
        padding="$2"
        margin="$2"
      >
        <Card.Header flexDirection="row">
          <H3>Decks</H3>
          <Button marginLeft="auto" icon={Plus} onPress={createDeck}></Button>
        </Card.Header>
        <YStack>
          {decks === undefined || decks.length == 0 &&
            <Text>Create a flashcard deck</Text>
          }
          {decks !== undefined && decks.length > 0 &&
            <FlatList
              style={styles.grid}
              data={decks}
              numColumns={2}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <YStack backgroundColor="$gray5" style={styles.tile}><Text>{item.name}</Text></YStack>
              )}
            />
          }
        </YStack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 1
  },
  grid: {
    height: "auto",
    width: "96%",
    borderRadius: 10,
    margin: "auto",
  },
  tile: {
    width: "50%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "black",
  }
});
