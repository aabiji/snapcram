import { router } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Input, H3, Text, Spinner, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import { Deck, ImageInfo, request, storageGet, storageSet } from "./lib/helpers";
import { Page, Header } from "./components/page";
import ImagePicker from "./components/imagePicker";

enum States { UploadingImages, GeneratingCards, Error };

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [images, setImages] = useState<ImageInfo[]>([]);

  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [state, setState] = useState(-1);

  const updateNumCards = (text: string) => {
    const num = Math.round(Number(text));
    setNumCards(Math.min(num, 20));
  }

  const uploadImages = async () => {
    setState(States.UploadingImages);

    // Add the files
    const formData = new FormData();
    for (let image of images) {
      formData.append("files", {
        uri: image.uri, type: image.mimetype, name: image.uri
      });
    }

    try {
      const token = storageGet<string>("jwt", true);
      const response = await request("POST", "/uploadFiles", formData, token);
      const json = await response.json();

      if (response.status == 200) {
        generateFlashcards(json["files"]);
      } else {
        setState(States.Error);
      }
    } catch (error) {
      setState(States.Error);
    }
  }

  const generateFlashcards = async (fileIds: string[]) => {
    setState(States.GeneratingCards);

    try {
      const token = storageGet<string>("jwt", true);
      const payload = { name: name.trim(), numCards, fileIds };
      const response = await request("POST", "/createDeck", payload, token);
      const json = await response.json();

      if (response.status == 200) {
        // Now show the deck we just created...
        const list = storageGet<Deck[]>("decks") ?? [];
        const index = list.length;
        storageSet("decks", [...list, json]);
        router.push({pathname: "/viewDeck", params: {index}})
      } else {
        setState(States.Error);
      }
    } catch (error) {
      setState(States.Error);
    }
  }

  useEffect(() => {
    if (name.trim().length == 0 || numCards == 0 || images.length == 0)
      setButtonDisabled(true);
    else
      setButtonDisabled(false);
  }, [name, numCards, images]);

  return (
    <Page header={<Header title="Create deck" />}>
      {state == -1 &&
        <YStack gap={15} height="100%" overflowY="scroll">
          <YStack gap={15}>
            <Input onChangeText={setName} placeholder="Name" />

            <XStack alignItems="center" justifyContent="space-between">
              <Text>Number of cards</Text>
              <Input
                width="20%" id="numCards"
                value={`${numCards == 0 ? "" : numCards}`}
                placeholder="0" keyboardType="numeric"
                onChangeText={updateNumCards}
              />
            </XStack>
          </YStack>

          <ImagePicker setImages={setImages} images={images} />

          <Button
            themeInverse
            disabledStyle={{ backgroundColor: "grey" }}
            disabled={buttonDisabled}
            onPress={uploadImages}
            style={styles.button}
          >
            Create deck
          </Button>
        </YStack>
      }

      {state == States.Error &&
        <>
          <H3>Something went wrong :(</H3>
          <Button
            onPress={() => setState(-1)}
            themeInverse
            iconAfter={<Redo rotate="180deg" />}
          >
            Retry
          </Button>
        </>
      }

      {state != -1 && state != States.Error &&
        <>
          <H3>
            {state == States.UploadingImages
              ? "Uploading your notes..."
              : "Generating flashcards..."
            }</H3>
          <Spinner size="large" color="$blue10Light" />
        </>
      }
    </Page>
  );
}

const styles = StyleSheet.create({
  button: {
    height: "8%",
    fontWeight: "bold"
  }
});
