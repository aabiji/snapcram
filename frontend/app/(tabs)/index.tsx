import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Card, H3, H5, Text, ScrollView, YStack } from "tamagui";
import { ChevronRight } from "@tamagui/lucide-icons";

import { router, useNavigation } from "expo-router";

import { storageGet, storageSet, request, Deck } from "../lib/helpers";

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
  const navigation = useNavigation();

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
    <ScrollView flex={1} style={styles.container}>
      <H3>Your decks</H3>
      <YStack gap={25} paddingTop={20}>
        {decks.map((item, index) => (
          <DeckCard deck={item} index={index} />
        ))}
      </YStack>
    </ScrollView>
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
  container: {
    paddingTop: 50,
    paddingRight: 20,
    paddingLeft: 20,
    paddingBottom: 20,
  },
});
