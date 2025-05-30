import { router } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Input, H4, Text, Spinner, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import {
  storageGet, storageSet, request,
  Asset, Deck, Flashcard
} from "./lib/helpers";
import { Page, Header } from "./components/page";
import ImagePicker from "./components/imagePicker";

enum States { None, Generating, Error };

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [images, setImages] = useState<Asset[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [state, setState] = useState(States.None);
  const [jwt, setJwt] = useState<string>("");

  const updateNumCards = (text: string) => {
    const num = Math.round(Number(text));
    setNumCards(Math.min(num, 50));
  }

  const validateForm = (): boolean => {
    if (name.length == 0) {
      setErrorMessage("Must specify the deck name");
      return false;
    }

    const decks = storageGet<Deck[]>("decks") ?? [];
    const same = decks.find(deck => deck.name == name);
    if (same !== undefined) {
        setErrorMessage("Deck already exists");
        return false;
    }

    if (numCards == 0) {
      setErrorMessage("Must specify the number of cards to generate");
      return false;
    }

    if (images.length == 0) {
      setErrorMessage("Must upload images");
      return false;
    }

    setErrorMessage("");
    return true;
  }

  const processBatch = async (batch: Asset[]): Promise<Flashcard[]> => {
    const formData = new FormData();
    for (let asset of batch) {
      formData.append("files", {
        uri: asset.uri, type: asset.mimetype, name: asset.uri
      });
    }

    const response = await request("POST", "/upload", formData, jwt);
    const json = await response.json();
    if (response.status == 200)
      return json["cards"];
    else {
      throw new Error(`${response.status} ${json["message"]} ${json["details"]}`)
    }
  }

  const createDeck = async () => {
    if (!validateForm()) return;
    setState(States.Generating);

    try {
      const batchSize = 5;
      const numBatches = Math.floor(images.length / batchSize);
      let cards = [];

      for (let i = 0; i < numBatches; i++) {
        const batch = images.slice(i * batchSize, i * batchSize + batchSize);
        const set = await processBatch(batch);
        cards.push(...set);
      }

      const payload = { name, deckSize: numCards, cards };
      const response = await request("POST", "/createDeck", payload, jwt);
      const json = await response.json();

      const list = storageGet<Deck[]>("decks") ?? [];
      storageSet("decks", [...list, json]);
      router.push({pathname: "/viewDeck", params: {index: list.length}})
    } catch (error) {
      console.log(error);
      setState(States.Error);
    }
  }

  useEffect(() => {
      const token = storageGet<string>("jwt")!;
      setJwt(token);
  }, []);

  return (
    <Page header={<Header title="Create deck" />}>
      {state == States.None &&
        <YStack gap={8}>
          <YStack gap={8}>
            <Input onChangeText={(text) => setName(text.trim())} placeholder="Name" />
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
            onPress={() => setState(States.None)}
            iconAfter={<Redo rotate="90deg" />}
          >
            Retry
          </Button>
        </YStack>
      }

      {state == States.Generating &&
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
