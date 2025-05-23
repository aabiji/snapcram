import { useLocalSearchParams, useNavigation } from "expo-router";

import { useLayoutEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Card, H3, Text, View, XStack, YStack } from "tamagui";
import { Check, X, Redo } from "@tamagui/lucide-icons";

import { storageGet, storageSet, Deck } from "./lib/helpers";
import { Page, Header } from "./components/page";

export default function ViewDeck() {
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

  const setConfidence = (confident: boolean) => {
    // TODO: set the confidence for the card
    // ex: did you know the info on the card, or should we
    // keep showing you this card until you have it memorized?

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
    <Page header={<Header title={deck.name} />}>
      <YStack>
        {done &&
          <Button transparent onPress={restart}>
            <Redo scale={2} color="blue" />
            Restart
          </Button>
        }
      </YStack>

      {!done &&
        <View height="100%">
          <Card
            bordered style={styles.flaschard}
            onPress={() => setShowFront(!showFront)}
          >
            <H3 textAlign="center" fontWeight="bold">
              {
                showFront
                  ? deck.cards[cardIndex].front
                  : deck.cards[cardIndex].back
              }
            </H3>
          </Card>

          <XStack style={styles.controls}>
            <Button transparent
              icon={<X color="red" scale={2.5} />}
              onPress={() => setConfidence(false)}
            />
            <Text>
              {cardIndex + 1}/{deck.cards.length}
            </Text>
            <Button transparent
              icon={<Check color="green" scale={2.5} />}
              onPress={() => setConfidence(true)}
            />
          </XStack>
        </View>
      }
    </Page>
  );
}

const styles = StyleSheet.create({
  flaschard: {
    width: "95%",
    height: "65%",
    alignSelf: "center",
    backgroundColor: "white",
    justifyContent: "center",
  },
  controls: {
    width: "80%",
    height: "25%",
    marginTop: "-15%",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "center",
  },
});
