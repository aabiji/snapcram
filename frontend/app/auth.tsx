import { StyleSheet } from "react-native";
import { Button, Card, H2, Input } from "tamagui";

import Page from "./components/page";

export default function AuthPage() {
  return (
    <Page>
      <H2>Snapcram</H2>
      <Card>
        <Input placeholder="Email" />
        <Input placeholder="Password" />
        <Button>Authenticate</Button>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
});
