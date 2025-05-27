import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { Button, Card, Text, XStack, YStack } from "tamagui";
import { ChevronRight, ChevronDown, Pen, Repeat, Trash } from "@tamagui/lucide-icons";

import { router } from "expo-router";

import { storageGet, storageSet, request, Deck } from "./lib/helpers";
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

  const fetchUserInfo = async () => {
    const fallbackDecks = storageGet<Deck[]>("decks") ?? [];

    try {
      const jwt = storageGet<string>("jwt");
      const response = await request("GET", "/userInfo", undefined, jwt);
      const json = await response.json();

      if (response.status == 200) {
        storageSet("decks", json["decks"]);
        setDecks(json["decks"]);
      } else {
        console.log("error!", json);
        setDecks(fallbackDecks);
      }
    } catch (error) {
        console.log("error!", error);
        setDecks(fallbackDecks);
    }
  }

  useEffect(() => { fetchUserInfo(); }, []);

  return (
    <Page header={<MainHeader />}>
      <YStack gap={25} paddingTop={20}>
        {decks.map((item, index) => (
          <DeckCard deck={item} index={index}  key={index} />
        ))}
      </YStack>
    </Page>
  );
}
