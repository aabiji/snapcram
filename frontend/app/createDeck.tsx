import { router } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Input, H4, Text, Spinner, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import { storageGet, storageSet } from "./lib/helpers";
import { createFlashcardDeck, Deck, ImageInfo } from "./lib/generate";
import { Page, Header } from "./components/page";
import ImagePicker from "./components/imagePicker";

enum States { GeneratingCards, Error };

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [images, setImages] = useState<ImageInfo[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [state, setState] = useState(-1);
  const [jwt, setJwt] = useState<string>("");

  const updateNumCards = (text: string) => {
    const num = Math.round(Number(text));
    setNumCards(Math.min(num, 50));
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

  const createDeck = () => {
    if (!validateName()) return;

    if (numCards == 0) {
      setErrorMessage("Must specify the number of cards to generate");
      return;
    }

    if (images.length == 0) {
      setErrorMessage("Must upload images");
      return;
    }

    setState(States.GeneratingCards);

    try {
      const deck = createFlashcardDeck(images, jwt, name.trim(), numCards);
      const list = storageGet<Deck[]>("decks") ?? [];
      storageSet("decks", [...list, deck]);
      router.push({pathname: "/viewDeck", params: {index: list.length}})
    } catch (error) {
      console.log(error);
      setState(States.Error);
    }
  };

  useEffect(() => {
      const token = storageGet<string>("jwt")!;
      setJwt(token);
  }, []);

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
                defaultValue="30"
                onChangeText={updateNumCards}
              />
            </XStack>
          </YStack>

          <ImagePicker setImages={setImages} images={images} />

          <Button themeInverse onPress={createDeck}>Create deck</Button>
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
          <H4>Creating flashcards...</H4>
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
