import { useLocalSearchParams } from "expo-router";

import { useState } from "react";
import { StyleSheet } from "react-native";

import { Button, H4, View, XStack, YStack } from "tamagui";
import { Redo } from "@tamagui/lucide-icons";

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useStorage } from "@/lib/storage";

import Flashcard from "@/components/flashcard";
import { Page, Header } from "@/components/page";

export default function ViewDeck() {
  const { index } = useLocalSearchParams<{ index: string }>();

  const [decks, _setDecks] = useStorage("decks", []);
  const [deck, _setDeck] = useStorage(decks[Number(index)], {
    id: 0, name: "", cards: [{front: "", back: ""}]
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [showFront, setShowFront] = useState(true);

  const setConfidence = (_value: number) => {
    // TODO: set the confidence for the card
    // ex: did you know the info on the card, or should we
    // keep showing you this card until you have it memorized?
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
          <View flex={1}>
            <View height="90%" alignItems="center">
              <Flashcard
                showFront={showFront} setShowFront={setShowFront}
                frontContent={
                  <H4 textAlign="center">{deck.cards[cardIndex].front}</H4>
                }
                backContent={
                  <H4 textAlign="center">{deck.cards[cardIndex].back}</H4>
                }
              />
            </View>

            <XStack style={styles.controls}>
              <Button flex={1} borderRadius={0} backgroundColor="red"
                onPress={() => setConfidence(0)}>
                <MaterialCommunityIcons
                  name="emoticon-sad-outline" size={32} color="white" />
              </Button>
              <Button flex={1} borderRadius={0} backgroundColor="orange"
                onPress={() => setConfidence(0.5)}>
                <MaterialCommunityIcons
                  name="emoticon-neutral-outline" size={32} color="white" />
              </Button>
              <Button
                flex={1} borderRadius={0} backgroundColor="green"
                onPress={() => setConfidence(1)}>
                <MaterialCommunityIcons
                  name="emoticon-happy-outline" size={32} color="white" />
              </Button>
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
    justifyContent: "center",
    alignItems: "center",
  },
});
