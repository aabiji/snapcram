import { useLocalSearchParams } from "expo-router";

import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import {
  MarkdownTextInput, parseExpensiMark
} from '@expensify/react-native-live-markdown';

import { Button, Text, View, XStack, YStack } from "tamagui";
import {
  ChevronLeft, ChevronRight, Rotate3d, Plus, Trash
} from "@tamagui/lucide-icons";

import { Deck } from "@/lib/helpers";
import { getString, storeObject, useStorage } from "@/lib/storage";

import Flashcard from "@/components/flashcard";
import { Page, Header } from "@/components/page";

export default function EditDeck() {
  const { index } = useLocalSearchParams<{ index: string }>();

  const [decks, _setDecks] = useStorage<string[]>("decks", []);
  const [deck, setDeck] = useState<Deck>({
    id: 0, name: "", cards: [{front: "", back: ""}]
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [showFront, setShowFront] = useState(true);

  // mod handles negative values as well
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const next = () => setCardIndex(mod(cardIndex + 1, deck!.cards.length));
  const prev = () => setCardIndex(mod(cardIndex - 1, deck!.cards.length));

  const getCard = (front: boolean) =>
    front ? deck.cards[cardIndex].front : deck.cards[cardIndex].back;

  const editCard = (text: string, front: boolean) => {
    setDeck((prev) => {
      const newCards = prev.cards.map((card, idx) => {
        if (idx !== cardIndex) return card;
        return {
          ...card,
          ...(front ? { front: text } : { back: text }),
        };
      });
      console.log(newCards[cardIndex].front, text);

      return { ...prev, cards: newCards };
    });
  }

  const deleteCard = () => {
    setDeck((prev: Deck) => {
      const newCards = prev.cards.filter((_, i) => i != cardIndex);
      return { ...prev, cards: newCards };
    });
    setCardIndex(i => i > 0 ? i - 1 : i);
  }

  const insertCard = () => {
    setDeck((prev: Deck) => {
      const before = prev.cards.slice(0, cardIndex);
      const after = prev.cards.slice(cardIndex);
      return { ...prev, cards: [...before, { front: "", back: "" }, ...after] };
    });
  }

  useEffect(() => {
    // Load the deck from local storage
    const load = async () => {
      const val = await getString(decks[Number(index)]);
      setDeck(
        typeof val === "string" ?
          JSON.parse(val) as unknown as Deck
          : val as unknown as Deck
      );
    }
    load();
  }, []);

  // Store the value in local storage when it changes
  // TODO: this doesn't work!
  useEffect(() => {
    if (!deck.name) return; // Not loaded yet
    const store = async () => await storeObject(deck.name, deck);
    store();
  }, [deck]);

  if (deck === undefined) return null;

  return (
    <Page header={<Header title={`Editing ${deck.name}`} />}>
        <View flex={1} justifyContent="center" alignItems="center">
          <Flashcard
            showFront={showFront}
            frontContent={
              <MarkdownTextInput style={styles.textbox} multiline={true}
                value={getCard(true)} parser={parseExpensiMark}
                onChangeText={(text: string) => editCard(text, true)} />
            }
            backContent={
              <MarkdownTextInput style={styles.textbox} multiline={true}
                value={getCard(false)} parser={parseExpensiMark}
                onChangeText={(text: string) => editCard(text, false)} />
            }
          />
        </View>

        <YStack width="100%" alignSelf="flex-end" gap={10}>
          <XStack alignItems="center">
            <Button
              flex={1} borderRadius={0} transparent
              icon={<Trash color="red" scale={2} />}
              onPress={deleteCard}
            />
            <Text fontWeight="bold">{cardIndex + 1} / {deck.cards.length}</Text>
            <Button
              flex={1} borderRadius={0} transparent
              icon={<Plus color="blue" scale={2} />}
              onPress={insertCard}
            />
          </XStack>

          <XStack>
            <Button
              flex={1} borderRadius={0} transparent
              icon={<ChevronLeft scale={2} />} onPress={prev} />
            <Button
              flex={1} borderRadius={0} transparent
              icon={<Rotate3d scale={1.5} />}
              onPress={() => setShowFront(!showFront)} />
            <Button
              flex={1} borderRadius={0} transparent
              icon={<ChevronRight scale={2} />} onPress={next} />
          </XStack>
        </YStack>
    </Page>
  );
}

const styles = StyleSheet.create({
  textbox: {
    width: "100%",
    maxHeight: "100%",
    textAlign: "center",
    fontSize: 20,
  }
});