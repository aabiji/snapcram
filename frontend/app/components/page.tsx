import { router } from "expo-router";

import { ScrollView, StyleSheet } from "react-native";
import { ChevronLeft } from "@tamagui/lucide-icons";
import { Button, H3, XStack } from "tamagui";
import React from "react";

export function Header({ title }: { title: string }) {
  return (
    <XStack>
      <Button
        transparent marginLeft={-10} marginRight={10}
        icon={<ChevronLeft scale={2} />}
        onPress={() => router.push("/")}
      />
      <H3>{title}</H3>
    </XStack>
  );
}

interface PageProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function Page({ children, header }: PageProps) {
  return (
    <ScrollView style={styles.container}>
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