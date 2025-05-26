import { Linking } from "react-native";

import {
  Anchor, Adapt, Button, Dialog, H3, H5,
  Separator, Sheet, Text, Unspaced, XStack
} from "tamagui";
import { Moon, Sun, X } from "@tamagui/lucide-icons";

import { Page, Header } from "./components/page";
import useThemeContext from "./components/themeContext";

function ConfirmAccountDeletion({ deleteAccount }: { deleteAccount: () => void; }) {
  return (
    <Dialog modal>
      <Dialog.Trigger asChild>
        <Button themeInverse borderColor="red" marginBottom={20} borderWidth={2}>
          Delete account
        </Button>
      </Dialog.Trigger>

      <Adapt when="maxMd" platform="touch">
        <Sheet animation="medium" zIndex={200000} modal dismissOnSnapToBottom>
          <Sheet.Frame padding="$4" gap="$4">
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay
            backgroundColor="$shadow6"
            animation="lazy"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
        </Sheet>
      </Adapt>

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay" backgroundColor="$shadow6"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />

        <Dialog.Content
          bordered w={400} elevate borderRadius="$6"
          key="content" animateOnly={['transform', 'opacity']}
          animation={[
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: 20, opacity: 0 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4" width="90%" height="50%" paddingTop={30}
        >

          <H3>Are you sure?</H3>
          <Text>
            If you delete your account, you won't be able to recover your data!
          </Text>
          <Button
            backgroundColor="red" color="white"
            fontWeight="bold"
            onPress={deleteAccount}
          >
            I'm sure
          </Button>

          <Unspaced>
            <Dialog.Close asChild>
              <Button
                marginTop={10} position="absolute"
                padding={20} marginRight={-10}
                right="$3" size="$2" transparent
                icon={<X scale={2}/>}
              />
            </Dialog.Close>
          </Unspaced>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

export default function Settings() {
  const { theme, toggleTheme } = useThemeContext();

  const openSupportEmail = () => {
    const host = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    Linking.openURL(`mailto:${host}`);
  }

  const deleteAccount = () => {
    console.log("TODO: deleting account...")
  }

  return (
    <Page header={<Header title="Settings" />}>
      <XStack justifyContent="space-between">
        <H5>Theme</H5>
        <Button
          transparent
          icon={theme == "light" ? <Moon scale={2} /> : <Sun scale={2} />}
          onPress={toggleTheme}
        />
      </XStack>

      <Separator marginBottom={20} />

      <ConfirmAccountDeletion deleteAccount={deleteAccount} />

      <XStack justifyContent="space-between">
        <Text>Snapcram v0.0.1</Text>
        <Anchor
          color="blue"
          onPress={openSupportEmail}
        >Contact Us</Anchor>
      </XStack>
    </Page>
  )
}