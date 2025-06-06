import { useFocusEffect, useRouter } from "expo-router";

import { useCallback, useState } from "react";

import { H4, Spinner, YStack } from "tamagui";

import { Deck } from "@/lib/types";
import { storage, useStringStorage, useStorage } from "@/lib/storage";
import request from "@/lib/http";

import { Page, MainHeader } from "@/components/page";
import DeckCard from "@/components/deckCard";

export default function Index() {
  const router = useRouter();

  const [token, _setToken] = useStringStorage("jwt", "");
  const [decks, setDecks] = useStorage("decks", []);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserInfo = async () => {
    // User hasn't authenticated before
    if (token === undefined || token.length == 0) {
      setLoading(false);
      router.replace("/auth");
      return;
    }

    try {
      const response = await request("GET", "/userInfo", undefined, token);
      const json = await response.json();

      if (response.status != 200 || json["tokenExpired"] == true) {
        setLoading(false);
        router.replace("/auth");
        return;
      }

      // Store all the user's decks
      const names = [];
      for (let i = 0; i < json["decks"].length; i++) {
        const deck: Deck = json["decks"][i];
        storage.set(deck.name, JSON.stringify(deck));
        names.push(deck.name);
      }
      setDecks(names);

      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
      router.replace("/networkIssue");
    }
  }

  useFocusEffect(useCallback(() => { loadUserInfo(); }, []));

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  return (
    <Page header={<MainHeader />}>
      <YStack gap={25} paddingTop={20} flex={1}>
        {decks.length == 0 &&
          <YStack flex={1} justifyContent="center">
            <H4 textAlign="center" color="dimgrey" alignSelf="center">
              Create your first deck
            </H4>
          </YStack>
        }

        {decks.map((item: string, index: number) => (
          <DeckCard name={item} index={index} key={index} />
        ))}
      </YStack>
    </Page>
  );
}
