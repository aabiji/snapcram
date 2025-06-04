import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import {
  MarkdownTextInput, parseExpensiMark
} from '@expensify/react-native-live-markdown';

import { Button, H4, Text, View, XStack, YStack } from "tamagui";
import {
  ChevronLeft, ChevronRight, Rotate3d, Plus, Trash
} from "@tamagui/lucide-icons";

import { Deck } from "@/lib/types";
import { getString, storeObject, useStorage } from "@/lib/storage";

import Flashcard from "@/components/flashcard";
import { Page, Header } from "@/components/page";

export default function EditDeck() {
  const { index } = useLocalSearchParams<{ index: string }>();

  const [decks, _setDecks] = useStorage<string[]>("decks", []);
  const [deck, setDeck] = useState<Deck>({
    id: 0, name: "", cards: [
      {
        front: "", back: "",
        edited: undefined, created: undefined, deleted: undefined
      }
    ]
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [showFront, setShowFront] = useState(true);
  const [leftDisabled, setLeftDisabled] = useState(false);
  const [rightDisabled, setRightDisabled] = useState(false);

  const currentCard = (front: boolean) =>
    front ? deck.cards[cardIndex].front : deck.cards[cardIndex].back;

  // TODO: figure out how to manage the actual card index and the
  //       card index we show to the user. they're different since
  //       we still include deleted flashcards!

  // Get the card index and the number of cards. Since cards that
  // are marked as deleted are intersperced with the others cards,
  // they'll be ignored
  const getProgress = () => {
    console.log(cardIndex);

    const before = deck.cards.slice(0, cardIndex).findIndex(d => d.deleted === undefined);
    const after = deck.cards.slice(0, cardIndex - 1).findIndex(d => d.deleted === undefined);
    const i = before != -1 ? before : after;

    const amount = deck.cards.filter(d => d.deleted === undefined).length;
    return `${i + 1} / ${amount}`;
  }

  const nextCardIndex = (forward: boolean) => {
    // first card before the current card that's not deleted
    const before =
      deck.cards.slice(0, cardIndex).findLastIndex(d => d.deleted === undefined);

    // first card after the current card that's not deleted
    const after =
      deck.cards.findIndex((d, i) => i > cardIndex && d.deleted === undefined);

    return forward ? after : before;
  }

  const changeCard = (forward: boolean) => {
    const next = nextCardIndex(forward);
    setLeftDisabled(next < 0);
    setRightDisabled(next >= deck.cards.length);
    setCardIndex(
      Math.min(Math.max(next, 0), deck.cards.length - 1)
    );
  }

  const editCard = (text: string, front: boolean) => {
    if (text.trim().length == 0) return;

    setDeck((prev) => {
      const newCards = prev.cards.map((card, idx) => {
        if (idx !== cardIndex) return card;
        return {
          ...card,
          ...(front ? { front: text.trim() } : { back: text.trim() }),
          edited: true
        };
      });
      return { ...prev, cards: newCards };
    });
  }

  const deleteCard = () => {
    setDeck((prev: Deck) => {
      const newCards = prev.cards.filter((_, i) => i != cardIndex);
      return { ...prev, cards: newCards };
    });
    setCardIndex(i => i > 0 ? i - 1 : i);

    setDeck((prev: Deck) => {
      // Mark the current card as deleted
      const before = prev.cards.slice(0, cardIndex);
      const after = prev.cards.slice(cardIndex + 1);
      const n = { ...prev.cards[cardIndex], deleted: true };
      return { ...prev, cards: [...before, n, ...after] };
    });
  }

  const insertCard = () => {
    // Insert a new card and mark it as created
    setDeck((prev: Deck) => {
      const before = prev.cards.slice(0, cardIndex + 1);
      const after = prev.cards.slice(cardIndex);
      const n = { front: "", back: "", created: true };
      return { ...prev, cards: [...before, n, ...after] };
    });
    changeCard(true);
  }

  // TODO: send request to the backend
  const saveEdits = () => {
    //storeObject(deck.name, deck);
  }

  // Load the deck from local storage when the page loads
  useEffect(() => {
    const data = getString(decks[Number(index)]);
    const val =
      typeof data === "string" ?
        JSON.parse(data) as unknown as Deck
        : data as unknown as Deck;
    setDeck(val);
  }, []);

  // Save the edits when we leave the page
  useFocusEffect(useCallback(() => saveEdits, [deck]));

  if (deck === undefined) return null;

  return (
    <Page header={<Header title={`Editing ${deck.name}`} />}>
      {deck.cards.length > 0 ?
        <View flex={1}>
          <View flex={1} justifyContent="center" alignItems="center">
            <Flashcard
              showFront={showFront}
              frontContent={
                <MarkdownTextInput style={styles.textbox} multiline={true}
                  value={currentCard(true)} parser={parseExpensiMark}
                  onChangeText={(text: string) => editCard(text, true)} />
              }
              backContent={
                <MarkdownTextInput style={styles.textbox} multiline={true}
                  value={currentCard(false)} parser={parseExpensiMark}
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
              <Text fontWeight="bold">{getProgress()}</Text>
              <Button
                flex={1} borderRadius={0} transparent
                icon={<Plus color="blue" scale={2} />}
                onPress={insertCard}
              />
            </XStack>

            <XStack>
              <Button
                flex={1} borderRadius={0} transparent
                disabled={leftDisabled} onPress={() => changeCard(false)}
                icon={
                  <ChevronLeft color={leftDisabled ? "gray" : "black"} scale={2} />
                }
              />
              <Button
                flex={1} borderRadius={0} transparent
                icon={<Rotate3d scale={1.5} />}
                onPress={() => setShowFront(!showFront)} />
              <Button
                flex={1} borderRadius={0} transparent
                disabled={rightDisabled} onPress={() => changeCard(true)}
                icon={
                  <ChevronRight color={rightDisabled ? "gray" : "black"} scale={2} />
                }
              />
            </XStack>
          </YStack>
        </View>
      :
        <H4>This deck is empty. Create a new card?</H4>
      }
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