import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import type { AppStackParamList, AuthStackParamList } from "@/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export default function RootNavigator() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted session to come back from SecureStore before
  // deciding which stack to render -- otherwise every cold start flashes
  // the login screen for a frame, even for an already-signed-in user.
  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AppStack.Navigator screenOptions={{ headerTitle: "Vrodux ERP" }}>
          <AppStack.Screen name="Home" component={HomeScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="TwoFactor"
            component={TwoFactorScreen}
            options={{ headerShown: true, headerTitle: "Verify" }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
