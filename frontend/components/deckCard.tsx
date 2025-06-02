import { router } from "expo-router";

import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { Button, Card, Text, XStack, YStack } from "tamagui";
import { ChevronRight, ChevronDown, Pen, Repeat, Trash } from "@tamagui/lucide-icons";

import { Deck, request } from "@/lib/helpers";
import useStorage from "@/lib/storage";

export default function DeckCard(
  { name, index }: { name: string, index: number }) {
  const [token, _setToken] = useStorage<string>("jwt", "");
  const [showControls, setShowControls] = useState(false);

  const [deck, _setDeck] = useStorage<Deck>(name, {
    id: 0, name: "", cards: [{front: "", back: ""}]
  });
  const [_decks, setDecks] = useStorage<string[]>("decks", []);

  const deleteSelf = async () => {
    try {
      const response = await request("DELETE", "/deck", {id: deck.id}, token);
      const json = await response.json();
      if (response.status != 200) {
        console.log("TODO: show user that something went wrong!", json);
        return;
      }
    } catch (error) {
      console.log("TODO: show user that something went wrong!", error);
      return;
    }

    setDecks((prev: Deck[]) => {
      let copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  return (
    <Pressable>
      <Card width="100%" padding={15} bordered>
        <XStack justifyContent="space-between" width="100%">
          <YStack>
            <Text fontWeight="bold">{deck.name}</Text>
            <Text>confidence percentage</Text>
          </YStack>
          {showControls &&
            <ChevronDown scale={1.25} onPress={() => setShowControls(false)} />}
          {!showControls &&
            <ChevronRight scale={1.25} onPress={() => setShowControls(true)} />}
        </XStack>

        {showControls &&
          <XStack justifyContent="space-between" width="100%">
            <Button
              padding={0} transparent color="red" icon={<Trash />}
              onPress={deleteSelf}
            >
              Delete
            </Button>
            <Button
              padding={0} transparent color="green" icon={<Pen />}
              onPress={() =>
                router.push({ pathname: "/editDeck", params: { index } })
              }>
              Edit
            </Button>
            <Button
              color="purple" icon={<Repeat />} transparent padding={0}
              onPress={() =>
                router.push({ pathname: "/viewDeck", params: { index } })
            }>
              Practice
            </Button>
          </XStack>
        }
      </Card>
    </Pressable>
  );
}
