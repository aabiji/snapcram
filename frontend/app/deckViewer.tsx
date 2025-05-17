import { useLocalSearchParams, useNavigation } from "expo-router";

import { useLayoutEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, H4, Text, View, XStack, YStack } from "tamagui";
import { Check, X, Redo } from "@tamagui/lucide-icons";

import { storageGet, storageSet, Deck } from "./helpers";

export default function DeckViewer() {
  const navigation = useNavigation();
  const routeParams = useLocalSearchParams();
  const index = Number(routeParams.index);

  const [deck, setDeck] = useState<Deck | undefined>(undefined);
  const [_, setDecks] = useState<Deck[]>([]);

  const [cardIndex, setCardIndex] = useState(0);
  const [showFront, setShowFront] = useState(true);
  const [done, setDone] = useState(false);

  const loadDeck = async () => {
    const list = storageGet<Deck[]>("decks")!;
    const current = list[index];
    navigation.setOptions({title: current.name});
    setDeck(current);
    setDecks(list);
  }

  useLayoutEffect(() => { loadDeck(); }, [navigation]);

  if (deck === undefined) return null;

  // ex: did you know the info on the card, or should we
  // keep showing you this card until you have it memorized?
  const setConfidence = (confident: boolean) => {
    deck.cards[cardIndex].confident = confident;

    setDecks((prev: Deck[]) => {
      const copy = [...prev];
      copy[index] = deck;
      storageSet("decks", copy);
      return copy;
    });

    if (cardIndex + 1 < deck.cards.length)
      setCardIndex(cardIndex + 1);
    else
      setDone(true);
  }

  const restart = () => {
    setCardIndex(0);
    setDone(false);
  }

  return (
    <YStack style={styles.container}>
      <H4 alignSelf="center">
        {cardIndex + 1}/{deck.cards.length}
      </H4>

      {done &&
        <Button
          onPress={restart}
          icon={<Redo scale={2} color="blue" />}
        >
          Restart
        </Button>
      }

      {!done &&
        <View>
          <View
            style={styles.flaschard}
            onPress={() => setShowFront(!showFront)}
          >
            {showFront && <Text>{deck.cards[cardIndex].front}</Text>}
            {!showFront && <Text>{deck.cards[cardIndex].back}</Text>}
          </View>

          <XStack style={styles.controls}>
            <Button
              icon={<X color="red" />}
              onPress={() => setConfidence(false)}
            />
            <Button
              icon={<Check color="green" />}
              onPress={() => setConfidence(true)}
            />
          </XStack>
        </View>
      }
    </YStack>
  );
}

const styles = StyleSheet.create({
  flaschard: {
    width: "100%",
    height: "50%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white"
  },
  controls: {
    height: "auto",
    alignItems: "center",
    width: "40%",
    justifyContent: "space-between",
    alignSelf: "center"
  },
  container: {
    flex: 1,
    justifyContent: "center"
  }
});
