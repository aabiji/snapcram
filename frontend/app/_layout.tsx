import { Stack } from "expo-router";

import { useEffect, useState } from "react";

import { Spinner, TamaguiProvider, View } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

import { ThemeProvider, useThemeContext } from "./components/themeContext";
import { request, storageGet } from "./lib/helpers";

function LayoutContent() {
  const  { theme } = useThemeContext();

  const [defaultRoute, setDefaultRoute] = useState<string | undefined>(undefined);

  // Figure out the first page we show the user when they open the app.
  // If they're aren't authenticated into a valid session, redirect them
  // to the authentication page, if they are, redirect them to the home page
  const determineFirstPage = async () => {
    const token = storageGet<string>("jwt", true);
    if (token === undefined || token.length == 0) {
      setDefaultRoute("auth");
      return;
    }

    try {
      const response = await request("GET", "/checkExpired", undefined, token);
      const json = await response.json();

      const jwtExpired = response.status == 200 && json["expired"];
      const requestIssue = response.status == 406;

      setDefaultRoute(jwtExpired || requestIssue ? "auth" : "index");
    } catch (error) {
      setDefaultRoute("networkIssue");
    }
  }

  useEffect(() => { determineFirstPage(); }, []);

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
        <Stack.Screen name="viewDeck" options={{ headerShown: false }} />
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
