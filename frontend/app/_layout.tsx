import { Stack } from "expo-router";

import { useState } from "react";

import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

import { ThemeProvider, useThemeContext } from "./components/themeContext";

function LayoutContent() {
  const  { theme } = useThemeContext();

  // TODO: check if the user is authenticated (ensuring the jwt isn't expired)
  //       if the user is authenticated, go to the index route, else auth route,
  //       then obviously, implement user authentication
  const [defaultRoute, setDefaultRoute] = useState("auth");

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
