import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { useEffect, useLayoutEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Text, Button, Image, XStack, YStack } from "tamagui";
import { X, Plus, Trash } from "@tamagui/lucide-icons";
import { useNavigation } from "expo-router";

type ImageData = { uri: string; mimetype: string; };

// TODO: use this instead: https://docs.expo.dev/versions/latest/sdk/media-library
// And ensure that no duplicates iamges can exist

export default function PickerPopup() {
  const navigation = useNavigation();

  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImage, setCurrentImage] = useState<number>(-1);

  const saveImages = async (list: ImageData[]) => {
    const str = JSON.stringify(list);
    await SecureStore.setItemAsync("images", str);
  }

  const loadImages = async () => {
    const valueStr = await SecureStore.getItemAsync("images");
    const imageList = JSON.parse(valueStr ?? "[]");
    setImages(imageList);
  }

  const addImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      const selection = result.assets.map((file) => ({
        uri: file.uri ?? "",
        mimetype: file.mimeType ?? ""
      }));

      setImages(prev => {
        const updated = [...prev, ...selection];
        saveImages(updated);
        return updated;
      });
      setCurrentImage(-1);
    }
  }

  const removeImage = () => {
    setImages(prev => {
      let copy = [...prev];
      copy.splice(currentImage, 1);
      saveImages(copy);
      return copy;
    });
    setCurrentImage(-1);
  }

  useEffect(() => { loadImages(); }, []);

  useLayoutEffect(() => {
    // Set the custom header bar button
    navigation.setOptions({
      headerRight: () => (
        <XStack>
          <Button
            transparent
            onPress={addImages}
            icon={<Plus color="blue" scale={1.5} />} />
        </XStack>
      )
    });
  }, [navigation]);

  return (
    <YStack justifyContent="space-between" flex={1}>
      {currentImage != -1 &&
        <View style={styles.imageOverlay}>
          <XStack style={styles.exitButtons}>
            <Button
              transparent
              icon={<Trash color="red" scale={2} />}
              onPress={() => removeImage()}
            />
            <Button
              transparent
              icon={<X color="white" scale={2} />}
              onPress={() => setCurrentImage(-1)}
            />
          </XStack>
          <Image style={styles.image} source={{ uri: images[currentImage].uri }} />
        </View>
      }

      {images.length == 0 &&
        <Text>Add images of your notes and assignments</Text>
      }

      {images.length > 0 &&
        <FlatList
          data={images}
          style={styles.grid}
          numColumns={2}
          renderItem={({ item, index }) => (
            <Pressable
              key={index}
              style={styles.gridItem}
              onPress={() => setCurrentImage(index)}>
              <Image style={styles.image} source={{ uri: item.uri }} />
            </Pressable>
          )}
        />
      }
    </YStack>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: "97%",
    margin: "auto",
  },
  gridItem: {
    width: "50%",
    aspectRatio: 1,
    margin: 2
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  imageOverlay: {
    top: 0,
    zIndex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  exitButtons: {
    position: "absolute",
    right: 0,
    top: 0,
  }
});
