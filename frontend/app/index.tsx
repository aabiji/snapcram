import { useEffect, useLayoutEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, H3, ListItem, Spinner, XStack, YGroup, YStack } from "tamagui";
import { ChevronRight, Plus } from "@tamagui/lucide-icons";

import { router, useNavigation } from "expo-router";

import { getValue, setValue } from "./lib/storage";
import { ImageData } from "./lib/types";

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

export default function Index() {
  const navigation = useNavigation();

  const [token, setToken] = useState("");

  const decks = [
    {
      name: "Test deck #1",
      cards: [
        { confident: false, front: "What is the capital city of Japan?", back: "Tokyo" },
        { confident: false, front: "Who wrote the play Romeo and Juliet?", back: "William Shakespeare" },
        { confident: false, front: "What is the largest planet in our solar system?", back: "Jupiter" },
        { confident: false, front: "In what year did the Titanic sink?", back: "1912" },
        { confident: false, front: "What element does 'O' represent on the periodic table?", back: "Oxygen" }
      ]
    },
  ];

  const authenticate = async () => {
    // reset:
    //deleteItemAsync("decks");
    //deleteItemAsync("jwt");
    //deleteItemAsync("images");

    await setValue("decks", decks);

    const jwt = await getValue("jwt");
    if (jwt != null && jwt.length > 0) {
      setToken(jwt);
      return;
    }

    const response = await sendRequest({ method: "POST", endpoint: "/createUser" });
    if (response.status == 200) {
      const json = await response.json();
      await setValue("jwt", json["token"])
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

  const viewDeck = (index: number) => {
    router.push({
      pathname: "/deckViewer",
      params: { index: index }
    });
  }

  // TODO: was trying to test the create deck endpoint
  const [uploading, setUploading] = useState(false);
  const uploadImages = async () => {
    setUploading(true);

    const images = (await getValue("images") as any) as ImageData[];
    const formData = new FormData();

    // Add the files
    for (let image of images) {
      formData.append("files", {
        uri: image.uri,
        type: image.mimetype,
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

    setUploading(false);
  }

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Our topic name" });
  }, [navigation]);

  return (
    <YStack>
      <Button onPress={() => router.push("/imagePicker")}>View all images</Button>

      <Button onPress={() => uploadImages()}>
        Upload images
        {uploading && <Spinner size="small" />}
      </Button>

      <XStack>
        <H3>Your decks</H3>
        <Button
          marginLeft="auto"
          onPress={createDeck}
          icon={Plus}
        />
      </XStack>

      <YGroup alignSelf="center" bordered gap={10}>
        {decks.map((item, index) => (
          <YGroup.Item key={index}>
            <ListItem
              bordered
              hoverTheme
              pressTheme
              title={item.name}
              iconAfter={ChevronRight}
              onPress={() => viewDeck(index)}
            />
          </YGroup.Item>
        ))}
      </YGroup>
    </YStack>
  );
}

const styles = StyleSheet.create({
});
