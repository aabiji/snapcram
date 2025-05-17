import * as ImagePicker from "expo-image-picker";
import { ImageInfo } from "./helpers";

import { useEffect, useState } from "react";
import {
  FlatList, Keyboard, Modal, StyleSheet, TouchableOpacity
} from "react-native";

import {
  Button, Image, Input, Text, TextArea,
  useWindowDimensions, XStack, YStack
} from "tamagui";
import { Plus } from "@tamagui/lucide-icons";

function ModalContent() {
  const [images, setImages] = useState<ImageInfo[]>([]);

  const pickImage = async () => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"] };
    const result = await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;

    const selection = result.assets
                          .filter(asset => asset.uri && asset.mimeType)
                          .map(asset => ({
                            uri: asset.uri!, mimetype: asset.mimeType!
                          }));
    setImages(prev => [...prev, ...selection]);
  };


  return (
    <YStack padding={15}>

      <YStack gap={15} height="92%">
        <YStack height="40%" gap={15}>
          <Input height="25%" placeholder="Deck name" />
          <TextArea height="75%" placeholder="Additional instructions (optional)" />
          </YStack>

        <YStack flex={3}>
          <XStack justifyContent="space-between" alignItems="center">
            <Text> Choose images </Text>
            <Button transparent icon={<Plus scale={1.5} />} onPress={pickImage} />
          </XStack>

          <FlatList
            data={images}
            style={styles.grid}
            contentContainerStyle={styles.imageContainer}
            numColumns={3}
            renderItem={({ item }) => (
              <Image style={styles.gridItem} source={{ uri: item.uri }} />
            )}
          />
        </YStack>
      </YStack>

      <Button themeInverse style={styles.button}>Create deck</Button>
    </YStack>
  );
}

export default function CreateDeck({ setClose }: { setClose: () => void }) {
  const [top, setTop] = useState(0);
  const height = useWindowDimensions().height * 0.85;

  // Overlay the keyboard on top of the modal, instead of squishing it up
  useEffect(() => {
    Keyboard.addListener("keyboardDidShow", () => setTop(20));
    Keyboard.addListener("keyboardDidHide", () => setTop(0));
  }, []);

  return (
    <Modal
      transparent
      statusBarTranslucent
      keyboardShouldPersistTaps
      onRequestClose={setClose}
      >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalContainer}
        onPress={setClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ ...styles.modal, height, top }}
        >
          <ModalContent />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 15,
  },
  grid: {
    width: "100%",
    margin: "auto",
    padding: 0
  },
  gridItem: {
    width: "30%",
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10
  },
  button: {
    height: "8%",
    fontWeight: "bold",
    marginTop: 5
  },
  modal: {
    margin: "auto",
    width: "88%",
    borderRadius: 10,
    backgroundColor: "white",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  }
});
