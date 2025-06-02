import { useLocalSearchParams } from "expo-router";

import { useState } from "react";

import {
  MarkdownTextInput, parseExpensiMark
} from '@expensify/react-native-live-markdown';

import { Button, Text, View, XStack, YStack } from "tamagui";
import {
  ChevronLeft, ChevronRight, Rotate3d, Plus, Trash
} from "@tamagui/lucide-icons";

import { Deck } from "@/lib/helpers";
import useStorage from "@/lib/storage";

import Flashcard from "@/components/flashcard";
import { Page, Header } from "@/components/page";

export default function EditDeck() {
  const { index } = useLocalSearchParams<{ index: string }>();

  const [decks, _setDecks] = useStorage<string[]>("decks", []);
  const [deck, _setDeck] = useStorage<Deck>(decks[Number(index)], {
    id: 0, name: "", cards: [{front: "", back: ""}]
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [showFront, setShowFront] = useState(true);

  // mod handles negative values as well
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const next = () => setCardIndex(mod(cardIndex + 1, deck!.cards.length));
  const prev = () => setCardIndex(mod(cardIndex - 1, deck!.cards.length));

  const getCard = (front: boolean) => {
    return front ? deck!.cards[cardIndex].front : deck!.cards[cardIndex].back;
  }

  const editCard = (text: string, front: boolean) => {
   setDeck((prev: Deck) => {
     const newFront = front ? text : prev!.front;
     const newBack = !front ? text : prev!.back;
     return { ...prev, front: newFront, back: newBack };
   });
  }

  const deleteCard = () => {
    console.log("TODO!");
  }

  const insertCard = () => {
    console.log("TODO!");
  }

  if (deck === undefined) return null;

  return (
    <Page header={<Header title={`Editing ${deck.name}`} />}>
        <View flex={1} justifyContent="center" alignItems="center">
          <Flashcard
            showFront={showFront} setShowFront={setShowFront}
            frontContent={
              <MarkdownTextInput
                value={getCard(true)} parser={parseExpensiMark}
                onChangeText={(text: string) => editCard(text.trim(), true)} />
            }
            backContent={
              <MarkdownTextInput
                value={getCard(false)} parser={parseExpensiMark}
                onChangeText={(text: string) => editCard(text.trim(), false)} />
            }
          />

          <YStack width="100%" alignSelf="flex-end" gap={20}>
            <XStack>
              <Button
                flex={1} borderRadius={0} transparent
                icon={<Trash color="red" scale={1.5} />}
                onPress={deleteCard}
              />
              <Text>{cardIndex + 1} / {deck.cards.length}</Text>
              <Button
                flex={1} borderRadius={0} transparent
                icon={<Plus color="blue" scale={1.5} />}
                onPress={insertCard}
              />
            </XStack>

            <XStack>
              <Button
                flex={1} borderRadius={0} transparent
                icon={<ChevronLeft scale={2} />} onPress={prev} />
              <Button
                flex={1} borderRadius={0} transparent
                icon={<Rotate3d scale={2} />} 
                onPress={() => setShowFront(!showFront)} />
              <Button
                flex={1} borderRadius={0} transparent
                icon={<ChevronRight scale={2} />} onPress={next} />
            </XStack>
          </YStack>
        </View>
    </Page>
  );
}
