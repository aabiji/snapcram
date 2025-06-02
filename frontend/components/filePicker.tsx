import * as DocumentPicker from 'expo-document-picker';

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { Button, Image, Text, XStack, YStack } from "tamagui";
import { Plus, Trash } from "@tamagui/lucide-icons";

import { Asset } from "@/lib/helpers";

export default function FilePicker({ files, setFiles }) {
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  const toggleFileSelection = (index: number) => {
    setSelectedFiles(prev => {
      const copy = [...prev];
      if (copy.includes(index))
        copy.splice(copy.indexOf(index), 1);
      else
        copy.push(index);
      return copy;
    });
  }

  const removeSelectedFiles = () => {
    setFiles(prev => {
      let arr = [];
      for (let i = 0; i < prev.length; i++) {
        if (!selectedFiles.includes(i))
          arr.push(files[i]);
      }
      setSelectedFiles([]);
      return arr;
    });
  }

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"] });
    if (result.canceled) return;

    const selection = result.assets
      .filter(asset => asset.uri && asset.mimeType && asset.name)
      .map(asset => ({
        uri: asset.uri!, mimetype: asset.mimeType!, name: asset.name!
      }));

    setFiles(prev => {
      let arr = [...prev];
      for (const file of selection) {
        let duplicate = false;
        for (const p of prev) {
          if (p.name == file.name) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate)
          arr.push(file);
      }
      return arr;
    });
  }

  return (
    <YStack style={styles.container}>
      <XStack justifyContent="space-between" alignItems="center">
        <Text> Files </Text>
        <XStack>
          {selectedFiles.length > 0 &&
            <Button
              transparent
              icon={<Trash color="red" scale={1.5} />}
              onPress={removeSelectedFiles}
            />
          }
          <Button transparent icon={<Plus scale={1.5} />} onPress={pickFiles} />
        </XStack>
      </XStack>

      <ScrollView style={styles.gridContainer}>
        <XStack style={styles.grid}>
          {files.map((item: Asset, index: number) => (
            <Pressable
              style={styles.gridItem}
              key={index}
              onPress={() => toggleFileSelection(index)}
            >
              <Image
                style={
                  selectedFiles.includes(index)
                    ? styles.selectedFile
                    : styles.file
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
  file: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10
  },
  selectedFile: {
    transform: [{ scale: 0.95 }],
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "red"
  },
});
