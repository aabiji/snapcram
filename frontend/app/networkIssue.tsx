import { H3, Text } from "tamagui";
import Page from "@/components/page";

// TODO: keep showing this until the network issues on the user's side have been resolved
export default function NetworkIssue() {
  return (
    <Page>
      <H3>Something's going wrong!</H3>
      <Text>Maybe check your internet?</Text>
    </Page>
  )
}
