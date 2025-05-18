import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useState } from "react";
import { FlatList, Modal, StyleSheet, TouchableOpacity } from "react-native";

import {
  Button, Image, Input, H3, Text, Spinner,
  TextArea, useWindowDimensions, XStack, YStack,
} from "tamagui";
import { Plus, Redo } from "@tamagui/lucide-icons";

import { Deck, ImageInfo, request, storageGet, storageSet } from "./helpers";

enum States { UploadingImages, GeneratingCards, Error };

function ModalContent({ setClose }: { setClose: () => void }) {
  const [name, setName] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [numCards, setNumCards] = useState(0);

  const [images, setImages] = useState<ImageInfo[]>([]);
  const [state, setState] = useState(-1);

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
  }

  const uploadImages = async () => {
    setState(States.UploadingImages);

    // Add the files
    const formData = new FormData();
    for (let image of images) {
      formData.append("files", {
        uri: image.uri, type: image.mimetype, name: image.uri
      });
    }

    try {
      const token = storageGet<string>("jwt", true);
      const response = await request("POST", "/uploadFiles", formData, token);
      const json = await response.json();

      if (response.status == 200) {
        generateFlashcards(json["files"]);
      } else {
        setState(States.Error);
      }
    } catch (error) {
      setState(States.Error);
    }
  }

  const generateFlashcards = async (fileIds: string[]) => {
    setState(States.GeneratingCards);

    try {
      const token = storageGet<string>("jwt", true);
      const payload = { name, userPrompt, numCards, fileIds };
      const response = await request("POST", "/createDeck", payload, token);
      const json = await response.json();

      if (response.status == 200) {
        // Now show the deck we just created...
        const list = storageGet<Deck[]>("decks") ?? [];
        const index = list.length;
        storageSet("decks", [...list, json]);
        setClose();
        router.push({pathname: "/deckViewer", params: {index}})
      } else {
        setState(States.Error);
      }
    } catch (error) {
      setState(States.Error);
    }
  }

  const startCreationProcess = () => {
    // TODO: validate form input
    // TODO: change the border of the input causing trouble
    uploadImages();
  }

  const Form = () => (
    <>
      <YStack gap={15} height="92%">
        <YStack height="40%" gap={15}>
          <Input height="25%" placeholder="Deck name" />

          <XStack alignItems="center" height="10%">
            <Text width="80%" htmlFor="numCards" height="100%">Number of cards</Text>
            <Input width="20%" id="numCards" placeholder="0" keyboardType="numeric" />
          </XStack>

          <TextArea
            onChangeText={setUserPrompt}
            height="55%"
            placeholder="Additional instructions (optional)"
          />
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

      <Button
        themeInverse
        onPress={startCreationProcess}
        style={styles.button}
      >
        Create deck
      </Button>
    </>
  );

  return (
    <YStack padding={15}>
      {state == -1 && <Form />}

      {state == States.Error &&
        <>
          <H3>Something went wrong :(</H3>
          <Button
            onPress={() => setState(-1)}
            themeInverse
            iconAfter={<Redo rotate="180deg" />}
          >
            Retry
          </Button>
        </>
      }

      {state != -1 && state != States.Error &&
        <>
          <H3>
            {state == States.UploadingImages
              ? "Uploading your notes..."
              : "Generating flashcards..."
            }</H3>
          <Spinner size="large" color="$blue10Light" />
        </>
      }
    </YStack>
  );
}

export default function CreateDeck({ setClose }: { setClose: () => void }) {
  const height = useWindowDimensions().height * 0.9;
  return (
    <Modal
      transparent
      statusBarTranslucent
      onRequestClose={setClose}
      >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalContainer}
        onPress={setClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ ...styles.modal, height }}
        >
          <ModalContent setClose={setClose} />
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
    top: 0
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  }
});
