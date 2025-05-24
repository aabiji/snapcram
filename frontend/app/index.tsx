import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Button, Card, Text, XStack, YStack } from "tamagui";
import { ChevronRight, ChevronDown, Pen, Repeat, Trash } from "@tamagui/lucide-icons";

import { router } from "expo-router";

import { storageGet, storageSet, request, Deck } from "./lib/helpers";
import { Page, MainHeader } from "./components/page";

function DeckCard({ deck, index }: { deck: Deck, index: number }) {
  const [showControls, setShowControls] = useState(false);

  return (
    <Pressable>
      <Card style={styles.card} bordered>
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
      const jwt = storageGet<string>("jwt", true);
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

  const authenticate = async () => {
    const jwt = storageGet<string>("jwt", true);
    if (jwt != null && jwt.length > 0) {
      fetchUserInfo();
      return;
    }

    try {
      const response = await request("POST", "/createUser");

      if (response.status == 200) {
        const json = await response.json();
        storageSet("jwt", json["token"]);
      } else {
        console.log("Request failed", response.status, response?.toString());
      }
    } catch (error) {
      console.log("Couldn't send a request!", error);
    }

    fetchUserInfo();
  }

  useEffect(() => { authenticate(); }, []);

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

const styles = StyleSheet.create({
  card: {
    width: "100%",
    padding: 15,
  },
});
