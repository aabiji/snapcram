import * as ImagePicker from "expo-image-picker";

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { Button, Image, Text, XStack, YStack } from "tamagui";
import { Plus, Trash } from "@tamagui/lucide-icons";

export default function ImageGrid({ images, setImages }) {
  const [selectedImages, setSelectedImages] = useState<number[]>([]);

  const toggleImageSelection = (index: number) => {
    setSelectedImages(prev => {
      const copy = [...prev];
      if (copy.includes(index))
        copy.splice(copy.indexOf(index), 1);
      else
        copy.push(index);
      return copy;
    });
  }

  const removeSelectedImages = () => {
    setImages(prev => {
      let arr = [];
      for (let i = 0; i < prev.length; i++) {
        if (!selectedImages.includes(i))
          arr.push(images[i]);
      }
      setSelectedImages([]);
      return arr;
    });
  }

  const pickImages = async () => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"] };
    const result = await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;

    const selection = result.assets
      .filter(asset => asset.uri && asset.mimeType && asset.fileName)
      .map(asset => ({
        uri: asset.uri!, mimetype: asset.mimeType!, name: asset.fileName!
      }));

    setImages(prev => {
      let arr = [...prev];
      for (const image of selection) {
        let duplicate = false;
        for (const p of prev) {
          if (p.name == image.name) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate)
          arr.push(image);
      }
      return arr;
    });
  }

  return (
    <YStack style={styles.container}>
      <XStack justifyContent="space-between" alignItems="center">
        <Text> Images </Text>
        <XStack>
          {selectedImages.length > 0 &&
            <Button
              transparent
              icon={<Trash color="red" scale={1.5} />}
              onPress={removeSelectedImages}
            />
          }
          <Button transparent icon={<Plus scale={1.5} />} onPress={pickImages} />
        </XStack>
      </XStack>

      <ScrollView style={styles.gridContainer}>
        <XStack style={styles.grid}>
          {images.map((item, index) => (
            <Pressable
              style={styles.gridItem}
              key={index}
              onPress={() => toggleImageSelection(index)}
            >
              <Image
                style={
                  selectedImages.includes(index)
                    ? styles.selectedImage
                    : styles.image
                  }
                source={{ uri: item.uri }}
              />
            </Pressable>
          ))}
        </XStack>
      </ScrollView>
    </YStack>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "101%",
    height: 400,
  },
  gridContainer: {
    overflowY: "scroll",
    borderWidth: 1,
    borderRadius: 15,
    borderStyle: "dashed",
    padding: 8
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: "48%",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10
  },
  selectedImage: {
    transform: [{ scale: 0.95 }],
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "red"
  },
});