import { useLocalSearchParams } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, H4, View, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import { storageGet, storageSet } from "./lib/helpers";
import { Deck } from "./lib/generate";
import Flashcard from "./components/flashcard";
import { Page, Header } from "./components/page";

export default function ViewDeck() {
  const routeParams = useLocalSearchParams();
  const index = Number(routeParams.index);

  const [deck, setDeck] = useState<Deck | undefined>(undefined);
  const [_, setDecks] = useState<Deck[]>([]);

  const [cardIndex, setCardIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [showFront, setShowFront] = useState(true);

  const loadDeck = async () => {
    const list = storageGet<Deck[]>("decks")!;
    const current = list[index];
    setDeck(current);
    setDecks(list);
  }

  useEffect(() => { loadDeck(); }, []);

  const setConfidence = (value: number) => {
    // TODO: set the confidence for the card
    // ex: did you know the info on the card, or should we
    // keep showing you this card until you have it memorized?

    setDecks((prev: Deck[]) => {
      const copy = [...prev];
      copy[index] = deck;
      storageSet("decks", copy);
      return copy;
    });
    setShowFront(true);
    if (cardIndex + 1 < deck.cards.length)
      setCardIndex(cardIndex + 1);
    else
      setDone(true);
  }

  const restart = () => {
    setCardIndex(0);
    setDone(false);
    setShowFront(true);
  }

  if (deck === undefined) return null;

  return (
    <Page header={<Header title={deck.name} />}>
        {done &&
          <YStack>
            {done &&
              <Button transparent onPress={restart}>
                <Redo scale={2} color="blue" />
                Restart
              </Button>
            }
          </YStack>
        }

        {!done &&
          <View flex={1} justifyContent="center" alignItems="center">
            <Flashcard
              showFront={showFront} setShowFront={setShowFront}
              frontContent={
                <H4 textAlign="center">{deck.cards[cardIndex].front}</H4>
              }
              backContent={
                <H4 textAlign="center">{deck.cards[cardIndex].back}</H4>
              }
            />

            <XStack style={styles.controls}>
              <Button flex={1} borderRadius={0} backgroundColor="red"
                onPress={() => setConfidence(0)}>😔</Button>
              <Button flex={1} borderRadius={0} backgroundColor="orange"
                onPress={() => setConfidence(0.5)}>😐</Button>
              <Button
                flex={1} borderRadius={0} backgroundColor="green"
                onPress={() => setConfidence(1)}>😊</Button>
            </XStack>
          </View>
        }
    </Page>
  );
}

const styles = StyleSheet.create({
  controls: {
    width: "100%",
    position: "absolute",
    bottom: 0,
    margin: 0,
    padding: 0,
  },
});
