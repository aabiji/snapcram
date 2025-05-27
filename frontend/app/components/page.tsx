import { router } from "expo-router";

import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, H3, ScrollView, XStack } from "tamagui";
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
    <XStack marginBottom={10}>
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
  { children, header }: { children: React.ReactNode, header?: React.ReactNode }
) {
  return (
    <SafeAreaView>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        backgroundColor="$background"
      >
        {header}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export default Page;

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingRight: 20,
    paddingLeft: 20,
    height: "100%",
    width: "100%",
    fontFamily: "Lexend"
  }
});