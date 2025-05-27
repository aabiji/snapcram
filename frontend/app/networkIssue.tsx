import { Text } from "tamagui";
import Page from "./components/page";

// TODO: keep showing this until the network issues on the user's side have been resolved
export default function NetworkIssue() {
  return (
    <Page>
      <Text>Something went wrong! Maybe check your internet?</Text>
    </Page>
  )
}