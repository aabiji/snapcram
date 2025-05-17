import * as ImagePicker from "expo-image-picker";

import { useState } from "react";
import { FlatList, Modal, StyleSheet } from "react-native";

import {
  Button, Image, Input, Text, TextArea, XStack, YStack
} from "tamagui";
import { Plus } from "@tamagui/lucide-icons";

import { ImageInfo } from "./helpers";

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
    <YStack>
      <YStack padding={15}>

        <YStack height="92%" gap={15}>
          <YStack height="40%" gap={15}>
             <Input height="25%" placeholder="Deck name" />
             <TextArea height="75%" placeholder="Additional instructions (optional)" />
           </YStack>

          <YStack height="60%">
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

        <Button themeInverse fontWeight="bold">Create deck</Button>
      </YStack>
    </YStack>
  );
}

export default function CreateDeck({ setClose }) {
  return (
    <Modal onRequestClose={setClose}>
      <ModalContent />
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
});
