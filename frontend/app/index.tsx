import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { Button, Card, H4, Text, XStack, YStack } from "tamagui";
import { ChevronRight, ChevronDown, Pen, Repeat, Trash } from "@tamagui/lucide-icons";

import { router } from "expo-router";

import { storageGet } from "./lib/helpers";
import { Deck } from "./lib/generate";
import { Page, MainHeader } from "./components/page";

function DeckCard({ deck, index }: { deck: Deck, index: number }) {
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
            <Button padding={0} transparent color="red" icon={<Trash />}>Delete</Button>
            <Button padding={0} transparent color="green" icon={<Pen />}>Edit</Button>
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
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    const stored = storageGet<Deck[]>("decks") ?? [];
    setDecks(stored);
  }, []);

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
          <DeckCard deck={item} index={index}  key={index} />
        ))}
      </YStack>
    </Page>
  );
}
