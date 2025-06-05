import { router } from "expo-router";

import { useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Input, H4, Text, Spinner, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import { Asset, Flashcard  } from "@/lib/types";
import request from "@/lib/http";
import { storeObject, useStorage } from "@/lib/storage";

import { Page, Header } from "@/components/page";
import FilePicker from "@/components/filePicker";

enum States { None, Generating, Error };

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [numCards, setNumCards] = useState(0);
  const [files, setFiles] = useState<Asset[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [state, setState] = useState(States.None);

  const [token, _] = useStorage<string>("jwt", "");
  const [decks, setDecks] = useStorage<string[]>("decks", []);

  const updateNumCards = (text: string) => {
    const num = Math.round(Number(text));
    setNumCards(Math.min(num, 50));
  }

  const validateForm = (): boolean => {
    if (name.length == 0) {
      setErrorMessage("Must specify the deck name");
      return false;
    }

    const same = decks.find(deckName => deckName == name);
    if (same !== undefined) {
        setErrorMessage("Deck already exists");
        return false;
    }

    if (numCards == 0) {
      setErrorMessage("Must specify the number of cards to generate");
      return false;
    }

    if (files.length == 0) {
      setErrorMessage("Must upload files");
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

    const response = await request("POST", "/generate", formData, token);
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
      const batchSize = 2;
      const numBatches = Math.ceil(files.length / batchSize);
      let cards = [];

      for (let i = 0; i < numBatches; i++) {
        const batch = files.slice(i * batchSize, i * batchSize + batchSize);
        const set = await processBatch(batch);
        cards.push(...set);
      }

      const payload = { name, size: numCards, drafts: cards };
      const response = await request("POST", "/deck", payload, token);
      const json = await response.json();

      const prevlength = decks.length;
      setDecks(prev => [...prev, json["name"]]);

      storeObject(json["name"], json);
      router.push({pathname: "/viewDeck", params: {index: prevlength}})
    } catch (error) {
      console.log(error);
      setState(States.Error);
    }

    setState(States.None);
  }

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

          <FilePicker setFiles={setFiles} files={files} />

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
