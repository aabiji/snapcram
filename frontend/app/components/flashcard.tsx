import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Card, View } from "tamagui";

interface FlashcardProps {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;

  showFront: boolean;
  setShowFront: React.Dispatch<React.SetStateAction<boolean>>;
}

// A component that flips front to back then back to front when clicked
export default function Flashcard(
  { frontContent, backContent, showFront, setShowFront }: FlashcardProps
) {
  const flipAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flipAnimation, {
      toValue: showFront ? 0 : 180,
      useNativeDriver: true, duration: 300,
    }).start();
  }, [showFront]);

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "-180deg"]
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ["-180deg", "-360deg"]
  });

  const frontAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
    opacity: flipAnimation.interpolate({
      inputRange: [89, 90],
      outputRange: [1, 0] // Hide front when flipping past 90 degrees
    }),
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0
  };

  const backAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
    opacity: flipAnimation.interpolate({
      inputRange: [89, 90],
      outputRange: [0, 1], // Show back when flipping past 90 degrees
    }),
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0
  };

  return (
    <View style={styles.cardContainer}>
      <Animated.View style={[styles.flashcard, frontAnimatedStyle]}>
        <Card style={styles.card} bordered onPress={() => setShowFront(!showFront)}>
          {frontContent}
        </Card>
      </Animated.View>

      <Animated.View style={[styles.flashcard, backAnimatedStyle]}>
        <Card style={styles.card} bordered onPress={() => setShowFront(!showFront)}>
          {backContent}
        </Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: "95%",
    height: "75%",
    position: "relative",
    marginTop: "-20%"
  },
  flashcard: {
    width: "100%",
    height: "100%",
  },
  card: {
    flex: 1,
    backgroundColor: "$background",
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden", // Don't see through the card
  },
})