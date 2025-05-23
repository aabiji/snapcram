import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Compass, Plus } from "@tamagui/lucide-icons";

export default function RootLayout() {
  return (
    <Tabs
        screenOptions={({ route }) => ({
          tabBarIcon: () => {
            if (route.name == "index")
              return <Compass />;
            return <Plus />;
          },
          tabBarShowLabel: false,
          tabBarStyle: {
            marginBottom: -10, // Remove bottom padding
            elevation: 0
          },
          tabBarButton: (props) => <TouchableOpacity {...props} />
        })}
    >
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="createDeck" options={{ headerShown: false }} />
      <Tabs.Screen name="viewDeck" options={{ href: null }} />
    </Tabs>
  );
}