import { Stack } from "expo-router";

import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

import { ThemeProvider, useThemeContext } from "./components/themeContext";

function LayoutContent() {
  const  { theme } = useThemeContext();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="viewDeck" options={{ headerShown: false }} />
        <Stack.Screen name="createDeck" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return <ThemeProvider><LayoutContent /></ThemeProvider>;
}
