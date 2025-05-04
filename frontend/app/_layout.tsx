import { Stack } from "expo-router";

import { TamaguiProvider, createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v4";

const config = createTamagui(defaultConfig);

// make imports typed
type Config = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends Config {}
}

export default function RootLayout() {
  return <TamaguiProvider config={config}><Stack /></TamaguiProvider>;
}
