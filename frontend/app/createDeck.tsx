import { router } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Input, H4, Text, Spinner, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import { Deck, ImageInfo, request, storageGet, storageSet } from "./lib/helpers";
import { Page, Header } from "./components/page";
import ImagePicker from "./components/imagePicker";

enum States { UploadingImages, GeneratingCards, Error };

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [images, setImages] = useState<ImageInfo[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [buttonDisabled, setButtonDisabled] = useState(true);
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
        console.log(json);
      }
    } catch (error) {
      setState(States.Error);
    }
  }

  const validateName = (): boolean => {
    setErrorMessage("");
    const n = name.trim();
    if (n.length == 0) return false;

    const decks = storageGet<Deck[]>("decks") ?? [];
    for (let deck of decks) {
      if (deck.name == n) {
        setErrorMessage("Deck already exists");
        return false;
      }
    }

    return true;
  }

  useEffect(() => {
    if (!validateName()) return;
    if (numCards == 0 || images.length == 0)
      setButtonDisabled(true);
    else
      setButtonDisabled(false);
  }, [name, numCards, images]);

  return (
    <Page header={<Header title="Create deck" />}>
      {state == -1 &&
        <YStack gap={8}>
          <YStack gap={8}>
            <Input onChangeText={setName} placeholder="Name" />
            {errorMessage.length > 0 && <Text style={styles.error}>{errorMessage}</Text>}

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
          >
            Create deck
          </Button>
        </YStack>
      }

      {state == States.Error &&
        <YStack flex={1} justifyContent="center" alignItems="center">
          <H4>Something went wrong! </H4>
          <Button
            themeInverse marginTop={25}
            onPress={() => setState(-1)}
            iconAfter={<Redo rotate="90deg" />}
          >
            Retry
          </Button>
        </YStack>
      }

      {state != -1 && state != States.Error &&
        <YStack flex={1} justifyContent="center" alignItems="center">
          <H4>
            {state == States.UploadingImages
              ? "Uploading your notes..."
              : "Creating flashcards..."
            }
          </H4>
          <Spinner style={styles.spinner} size="large" color="$blue10Light" />
        </YStack>
      }
    </Page>
  );
}

const styles = StyleSheet.create({
  spinner: {
    transform: [{ scale: 2.5 }],
    marginTop: 45
  },
  error: {
    fontSize: 12,
    color: "red"
  }
});
