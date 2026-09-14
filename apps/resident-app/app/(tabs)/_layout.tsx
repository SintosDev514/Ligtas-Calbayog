import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { BottomBar } from "../../components/BottomBar";
import { BottomBarProvider } from "../../context/BottomBarContext";

const TAB_PATHS = ["/home", "/announcements", "/my-reports", "/profile"];

export default function Layout() {
  const pathname = usePathname();
  const showBottomBar = TAB_PATHS.some((p) => pathname === p || pathname.endsWith(p));
  return (
    <BottomBarProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        {showBottomBar && <BottomBar />}
      </View>
    </BottomBarProvider>
  );
}
