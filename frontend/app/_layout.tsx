import { Stack } from "expo-router";

import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="viewDeck" options={{ headerShown: false }} />
        <Stack.Screen name="createDeck" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </TamaguiProvider>
  );
}
