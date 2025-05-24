import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Button, Card, H3, H5, Text, XStack, YStack } from "tamagui";
import { ChevronRight, Plus, Settings } from "@tamagui/lucide-icons";

import { router } from "expo-router";

import { storageGet, storageSet, request, Deck } from "./lib/helpers";
import Page from "./components/page";

function DeckCard({ deck, index }: { deck: Deck, index: number }) {
  return (
    <Pressable
      onPress={() =>
        router.push({pathname: "/viewDeck", params: {index}})
      }
      >
      <Card elevate style={styles.card}>
        <YStack>
          <H5 fontWeight="bold"> {deck.name} </H5>
          <Text>Deck description</Text>
        </YStack>
        <ChevronRight />
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

  const HeaderBar = () => {
    return (
      <XStack justifyContent="space-between">
        <H3>Time to study!</H3>
        <XStack>
          <Button
            onPress={() => router.navigate("/createDeck")}
            transparent icon={<Plus scale={1.5} />}
          />
          <Button
            onPress={() => router.navigate("/settings")}
            transparent icon={<Settings scale={1.5} />}
          />
        </XStack>
      </XStack>
    );
  };

  return (
    <Page header={<HeaderBar />}>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
  },
});
