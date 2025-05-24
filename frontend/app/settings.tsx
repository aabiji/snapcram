import { Text } from "tamagui";

import { Page, Header } from "./components/page";

export default function Settings() {
  return (
    <Page header={<Header title="Settings" />}>
      <Text>this is the settings page</Text>
    </Page>
  )
}