import { useEffect, useLayoutEffect, useState } from "react";

import { Button, Card, H3, View, YGroup } from "tamagui";
import { ChevronRight, Plus } from "@tamagui/lucide-icons";

import { router, useNavigation } from "expo-router";

import CreateDeck from "./createDeck";

import { storageGet, storageSet, request, Deck } from "./helpers";

function DeckCard({ deck, index }: { deck: Deck, index: number }) {
  return (
    <Card>
      <H3> {deck.name} </H3>
      <Button
        iconAfter={ChevronRight}
        onPress={() =>
          router.push({pathname: "/deckViewer", params: {index}})
        }
      />
    </Card>
  );
}

export default function Index() {
  const navigation = useNavigation();

  const [showModal, setShowModal] = useState(false);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Your decks",
      headerRight: () => (
        <Button
          transparent
          onPress={() => setShowModal(true)}
          icon={<Plus color="blue" scale={1.5} />} />
      )
    });
  }, [navigation]);

  return (
    <View flex={1}>
      {showModal &&
        <CreateDeck setDecks={setDecks} setClose={() => setShowModal(false)} />
      }

      <YGroup alignSelf="center" bordered gap={10}>
        {decks.map((item, index) => (
          <YGroup.Item key={index}>
            <DeckCard deck={item} index={index} />
          </YGroup.Item>
        ))}
      </YGroup>
    </View>
  );
}
