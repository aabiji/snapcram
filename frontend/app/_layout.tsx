import { Stack } from "expo-router";

import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="deckViewer" />
      </Stack>
    </TamaguiProvider>
  );
}
