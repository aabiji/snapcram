import { Stack } from "expo-router";

import { useEffect, useState } from "react";

import { Spinner, TamaguiProvider, View } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

import { ThemeProvider, useThemeContext } from "./components/themeContext";
import { request, storageGet, storageSet  } from "./lib/helpers";

function LayoutContent() {
  const  { theme } = useThemeContext();

  const [defaultRoute, setDefaultRoute] = useState<string | undefined>(undefined);

  const loadUserInfo = async () => {
    // User hasn't authenticated before
    const token = storageGet<string>("jwt");
    if (token === undefined || token.length == 0) {
      setDefaultRoute("auth");
      return;
    }

    try {
      const response = await request("GET", "/userInfo", undefined, token);
      const json = await response.json();

      if (response.status != 200 || json["tokenExpired"] == true) {
        setDefaultRoute("auth");
        return;
      }

      storageSet("decks", json["decks"]);
      setDefaultRoute("index");
    } catch (error) {
      setDefaultRoute("networkIssue");
    }
  }

  useEffect(() => { loadUserInfo(); }, []);

  if (defaultRoute == undefined) {
    return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <View flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </View>
    </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <Stack initialRouteName={defaultRoute}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="networkIssue" options={{ headerShown: false }} />
        <Stack.Screen name="viewDeck" options={{ headerShown: false }} />
        <Stack.Screen name="editDeck" options={{ headerShown: false }} />
        <Stack.Screen name="createDeck" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return <ThemeProvider><LayoutContent /></ThemeProvider>;
}
