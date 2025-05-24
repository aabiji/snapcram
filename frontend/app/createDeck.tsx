import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import {
  Button, Image, Input, H3, Text, Spinner, TextArea, XStack, YStack,
} from "tamagui";
import { Plus, Redo } from "@tamagui/lucide-icons";

import { Deck, ImageInfo, request, storageGet, storageSet } from "./lib/helpers";
import { Page, Header } from "./components/page";

enum States { UploadingImages, GeneratingCards, Error };

export default function CreateDeck({ setDecks }: { setDecks: React.SetStateAction<Deck[]>}) {
  const [name, setName] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [state, setState] = useState(-1);

  const updateNumCards = (text: string) => {
    const num = Math.round(Number(text));
    setNumCards(Math.min(num, 20));
  }

  const pickImage = async () => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"] };
    const result = await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;

    const selection = result.assets
                          .filter(asset => asset.uri && asset.mimeType)
                          .map(asset => ({
                            uri: asset.uri!, mimetype: asset.mimeType!
                          }));
    setImages(prev => [...prev, ...selection]);
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

    const prompt = userPrompt.trim().length == 0
      ? "Nothing from me."
      : userPrompt.trim();

    try {
      const token = storageGet<string>("jwt", true);
      const payload = { name: name.trim(), userPrompt: prompt, numCards, fileIds };
      const response = await request("POST", "/createDeck", payload, token);
      const json = await response.json();

      if (response.status == 200) {
        // Now show the deck we just created...
        const list = storageGet<Deck[]>("decks") ?? [];
        const index = list.length;
        storageSet("decks", [...list, json]);
        setDecks([...list, json]);
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
        <YStack gap={15} height="100%">

          <YStack maxHeight="40%">
            <YStack gap={15}>
              <Input onChangeText={setName} placeholder="Deck name" />
              <XStack alignItems="center">
                <Text width="80%" htmlFor="numCards" height="100%">Number of cards</Text>
                <Input
                  width="20%" id="numCards"
                  value={`${numCards == 0 ? "" : numCards}`}
                  placeholder="0" keyboardType="numeric"
                  onChangeText={updateNumCards}
                />
              </XStack>
              <TextArea
                onChangeText={setUserPrompt}
                placeholder="Additional instructions (optional)"
              />
            </YStack>
          </YStack>

          <YStack height="60%">
            <YStack flex={3}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text> Choose images </Text>
                <Button transparent icon={<Plus scale={1.5} />} onPress={pickImage} />
              </XStack>

              <YStack style={styles.grid}>
                {images.map((item, index) => {
                  <Image style={styles.gridItem} key={index} source={{ uri: item.uri }} />
                })}
              </YStack>
            </YStack>

            <Button
              themeInverse
              disabled={buttonDisabled}
              onPress={uploadImages}
              style={styles.button}
            >
              Create deck
            </Button>
          </YStack>

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
  grid: {
    width: "100%",
    margin: "auto",
    padding: 0,
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 15,
    overflow: "scroll"
  },
  gridItem: {
    width: "30%",
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10
  },
  button: {
    height: "8%",
    fontWeight: "bold"
  },
});
