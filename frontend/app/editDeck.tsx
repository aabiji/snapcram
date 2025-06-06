import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";

import {
  MarkdownTextInput, parseExpensiMark
} from '@expensify/react-native-live-markdown';

import { Button, H4, Text, View, XStack, YStack } from "tamagui";
import {
  ChevronLeft, ChevronRight, Rotate3d, Plus, Trash
} from "@tamagui/lucide-icons";

import { Deck } from "@/lib/types";
import request from "@/lib/http";
import { getString, storeObject, useStorage } from "@/lib/storage";

import Flashcard from "@/components/flashcard";
import { Page, Header } from "@/components/page";

export default function EditDeck() {
  const { index } = useLocalSearchParams<{ index: string }>();

  const [decks, _setDecks] = useStorage<string[]>("decks", []);
  const [token, _setToken] = useStorage<string>("jwt", "");
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
  const [leftDisabled, setLeftDisabled] = useState(true);
  const [rightDisabled, setRightDisabled] = useState(false);

  // Get the card index and the number of cards. Since cards that
  // are marked as deleted are intersperced with the others cards,
  // they'll be ignored
  const getProgress = () => {
    // The number of cards before the current one that aren't deleted
    const i = deck.cards
      .slice(0, cardIndex + 1)
      .filter(d => d.deleted === undefined)
      .length;

    const amount = deck.cards.filter(d => d.deleted === undefined).length;
    return `${i} / ${amount}`;
  }

  const nextCardIndex = (forward: boolean) => {
    // first card before the current card that's not deleted
    let before =
      deck.cards.slice(0, cardIndex).findLastIndex(d => d.deleted === undefined);
    if (before == -1) before = cardIndex;

    // first card after the current card that's not deleted
    let after =
      deck.cards.findIndex((d, i) => i > cardIndex && d.deleted === undefined);
    if (after == -1) after = deck.cards.length;

    return forward ? after : before;
  }

  const moveToNextCard = (forward: boolean) => {
    const next = nextCardIndex(forward);
    setLeftDisabled(cardIndex == next);
    setRightDisabled(next >= deck.cards.length - 1);
    setCardIndex(Math.min(Math.max(next, 0), deck.cards.length - 1));
    setShowFront(true);
  }

  // TODO: don't allow the user to make duplicate cards
  const editCard = (text: string, front: boolean) => {
    setDeck((prev) => {
      const newCards = prev.cards.map((card, i) => {
        if (i !== cardIndex) return card;
        return {
          ...card,
          ...(front ? { front: text } : { back: text }),
          edited: true
        };
      });
      return { ...prev, cards: newCards };
    });
  }

  const insertCard = () => {
    const last = cardIndex == deck.cards.length - 1;
    setDeck((prev: Deck) => {
      const cards = [
        ...prev.cards.slice(0, cardIndex + 1),
        { front: "", back: "", created: true },
        ...prev.cards.slice(cardIndex + 1)
      ];
      return {...prev, cards};
    })

    if (last)
      // Edge case: the user's appending to the deck
      setCardIndex(deck.cards.length)
    else
      moveToNextCard(true);
  }

  const removeCard = () => {
    const firstValid = deck.cards.findIndex(d => d.deleted === undefined);
    const first = cardIndex == firstValid;

    setDeck((prev: Deck) => {
      const cards = [
        ...prev.cards.slice(0, cardIndex),
        { ...prev.cards[cardIndex], deleted: true },
        ...prev.cards.slice(cardIndex + 1)
      ];
      return { ...prev, cards };
    });

    if (first) {
      // Edge case: the user's deleting the first card in the deck
      moveToNextCard(true);
      setLeftDisabled(true);
    } else
      moveToNextCard(false);
  }

  const saveEdits = async (d: Deck) => {
    try {
      const payload = { cards: d.cards, id: d.id };
      const response = await request("PATCH", "/deck", payload, token);
      const json = await response.json();

      if (response.status == 200) {
        storeObject(deck.name, { ...deck, cards: json["cards"] });
      } else {
        console.log("TODO: tell the user something went wrong!", json);
      }
    } catch (error) {
      console.log("TODO: tell the user something went wrong!", error);
    }
  }

  // Save the edits when we leave the page
  const deckRef = useRef(deck);
  useEffect(() => { deckRef.current = deck }, [deck]);
  useFocusEffect(useCallback(() => () => saveEdits(deckRef.current), []));

  // Load the deck from local storage when the page loads
  // TODO: the state doesn't update when we navgiate back to the page after successfully editing!
  useFocusEffect(useCallback(() => {
    const data = getString(decks[Number(index)]);
    const val =
      typeof data === "string" ?
        JSON.parse(data) as unknown as Deck
        : data as unknown as Deck;
    setDeck(val);
  }, [index]));

  if (deck === undefined) return null;

  return (
    <Page header={<Header title={`Editing ${deck.name}`} />}>
      {deck.cards.length > 0 ?
          <View flex={1} justifyContent="center" alignItems="center">
            <Flashcard
              showFront={showFront} key={cardIndex}
              frontContent={
                <MarkdownTextInput
                  placeholder="Front of the card"
                  style={styles.textbox} multiline={true}
                  value={deck.cards[cardIndex].front} parser={parseExpensiMark}
                  onChangeText={(text: string) => editCard(text, true)} />
              }
              backContent={
                <MarkdownTextInput
                  placeholder="Back of the card"
                  style={styles.textbox} multiline={true}
                  value={deck.cards[cardIndex].back} parser={parseExpensiMark}
                  onChangeText={(text: string) => editCard(text, false)} />
              }
            />
          </View>
      :
        <View flex={1} justifyContent="center" alignItems="center">
          <H4>This deck is empty</H4>
        </View>
      }

      <YStack width="100%" alignSelf="flex-end" gap={10}>
        <XStack alignItems="center">
          {deck.cards.length > 0 &&
            <Button
              flex={1} borderRadius={0} transparent
              icon={<Trash color="red" scale={2} />}
              onPress={removeCard}
            />
          }
          {deck.cards.length > 0 &&
            <Text fontWeight="bold">{getProgress()}</Text>
          }
          <Button
            flex={1} borderRadius={0} transparent
            icon={<Plus color="blue" scale={2} />}
            onPress={insertCard}
          />
        </XStack>

        {deck.cards.length > 0 &&
          <XStack>
            <Button
              flex={1} borderRadius={0} transparent
              disabled={leftDisabled} onPress={() => moveToNextCard(false)}
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
              disabled={rightDisabled} onPress={() => moveToNextCard(true)}
              icon={
                <ChevronRight color={rightDisabled ? "gray" : "black"} scale={2} />
              }
            />
          </XStack>
        }
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