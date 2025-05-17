import { useEffect, useLayoutEffect, useState } from "react";

import { Button, ListItem, YGroup, YStack } from "tamagui";
import { ChevronRight, Plus } from "@tamagui/lucide-icons";

import { router, useNavigation } from "expo-router";

import CreateDeck from "./createDeck";

import { storageGet, storageSet, request, Deck } from "./helpers";

export default function Index() {
  const navigation = useNavigation();

  const [showModal, setShowModal] = useState(false);
  const [token, setToken] = useState("");

  const decks: Deck[] = [
    {
      name: "Test deck #1",
      cards: [
        { confident: false, front: "What is the capital city of Japan?", back: "Tokyo" },
        { confident: false, front: "Who wrote the play Romeo and Juliet?", back: "William Shakespeare" },
        { confident: false, front: "What is the largest planet in our solar system?", back: "Jupiter" },
        { confident: false, front: "In what year did the Titanic sink?", back: "1912" },
        { confident: false, front: "What element does 'O' represent on the periodic table?", back: "Oxygen" }
      ]
    },
  ];

  const authenticate = async () => {
    // reset:
    //deleteItemAsync("decks");
    //deleteItemAsync("jwt");

    storageSet("decks", decks);

    const jwt = storageGet<string>("jwt", true);
    if (jwt != null && jwt.length > 0) {
      setToken(jwt);
      return;
    }

    try {
      const response = await request("POST", "/createUser");

      if (response.status == 200) {
        const json = await response.json();
        storageSet("jwt", json["token"])
        setToken(json["token"]);
      } else {
        console.log("Request failed", response.status, response?.toString());
      }
    } catch (error) {
      console.log("Couldn't send a request!", error);
    }
  };

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
    <YStack>
      {showModal && <CreateDeck setClose={() => setShowModal(false)} />}

      <YGroup alignSelf="center" bordered gap={10}>
        {decks.map((item, index) => (
          <YGroup.Item key={index}>
            <ListItem
              bordered
              hoverTheme
              pressTheme
              title={item.name}
              iconAfter={ChevronRight}
              onPress={() =>
                router.push({pathname: "/deckViewer", params: {index}})
              }
            />
          </YGroup.Item>
        ))}
      </YGroup>
    </YStack>
  );
}
