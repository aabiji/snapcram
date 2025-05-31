import { useCallback, useState } from "react";
import { Pressable } from "react-native";

import { Button, Card, H4, Text, XStack, YStack } from "tamagui";
import { ChevronRight, ChevronDown, Pen, Repeat, Trash } from "@tamagui/lucide-icons";

import { router, useFocusEffect } from "expo-router";

import { Deck, request, storageGet, storageSet  } from "./lib/helpers";
import { Page, MainHeader } from "./components/page";

function DeckCard(
  { deck, index, deleteSelf }: {
    deck: Deck, index: number, deleteSelf: () => void;
}) {
  const [showControls, setShowControls] = useState(false);

  return (
    <Pressable>
      <Card width="100%" padding={15} bordered>
        <XStack justifyContent="space-between" width="100%">
          <YStack>
            <Text fontWeight="bold">{deck.name}</Text>
            <Text>80% confident</Text>
          </YStack>
          {showControls && <ChevronDown scale={1.25} onPress={() => setShowControls(false)} />}
          {!showControls && <ChevronRight scale={1.25} onPress={() => setShowControls(true)} />}
        </XStack>

        {showControls &&
          <XStack justifyContent="space-between" width="100%">
            <Button
              padding={0} transparent color="red" icon={<Trash />}
              onPress={deleteSelf}
            >
              Delete
            </Button>
            <Button padding={0} transparent color="green" icon={<Pen />}>
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

export default function Index() {
  // Update user data when the page loads
  const [decks, setDecks] = useState<Deck[]>([]);
  useFocusEffect(
    useCallback(() => {
      const stored = storageGet<Deck[]>("decks") ?? [];
      setDecks(stored);
    }, [])
  );

  const deleteDeck = async (index: number) => {
    const token = storageGet<string>("jwt")!;
    const deck = decks[index];

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

    setDecks((prev) => {
      let copy = [...prev];
      copy.splice(index, 1);
      storageSet("decks", copy);
      return copy;
    });
  };

  return (
    <Page header={<MainHeader />}>
      <YStack gap={25} paddingTop={20} flex={1}>
        {decks.length == 0 &&
          <YStack flex={1} justifyContent="center">
            <H4
              textAlign="center"
              color="dimgrey"
              alignSelf="center"
            >
              Create a new flashcard deck to get started
            </H4>
          </YStack>
        }

        {decks.map((item, index) => (
          <DeckCard
            deck={item} index={index} key={index}
            deleteSelf={() => deleteDeck(index)}
          />
        ))}
      </YStack>
    </Page>
  );
}
