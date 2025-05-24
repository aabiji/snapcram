import { router } from "expo-router";

import React from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button, H3, XStack } from "tamagui";
import { ChevronLeft, Plus, Settings } from "@tamagui/lucide-icons";

// Headerbar on the main page
export function MainHeader() {
  return (
    <XStack justifyContent="space-between">
      <H3>Time to study!</H3>
      <XStack>
        <Button
          onPress={() => router.push("/createDeck")}
          transparent icon={<Plus scale={1.5} />}
        />
        <Button
          onPress={() => router.push("/settings")}
          transparent icon={<Settings scale={1.5} />}
        />
      </XStack>
    </XStack>
  );
}

// Headerbar on all other pages to navigate back to the main page
export function Header({ title }: { title: string }) {
  return (
    <XStack>
      <Button
        transparent marginLeft={-10} marginRight={10}
        icon={<ChevronLeft scale={2} />}
        onPress={() => router.back()}
      />
      <H3>{title}</H3>
    </XStack>
  );
}

export function Page(
  { children, header }: { children: React.ReactNode, header: React.ReactNode }
) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      {header}
      {children}
    </ScrollView>
  );
}

export default Page;

const styles = StyleSheet.create({
  container: {
    paddingTop: 35,
    paddingRight: 20,
    paddingLeft: 20,
    paddingBottom: 20,
    height: "100%",
  }
});