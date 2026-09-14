import React, { createContext, useContext, useRef, useCallback } from "react";
import { Animated } from "react-native";

type BottomBarContextValue = {
  onScroll: (event: any) => void;
  translateY: Animated.Value;
};

const BottomBarContext = createContext<BottomBarContextValue>({
  onScroll: () => {},
  translateY: new Animated.Value(0),
});

export function BottomBarProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const visible = useRef(true);

  const onScroll = useCallback(
    (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const goingDown = y > lastY.current && y > 20;
      const goingUp = y < lastY.current;

      if (goingDown && visible.current) {
        visible.current = false;
        Animated.timing(translateY, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (goingUp && !visible.current) {
        visible.current = true;
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      lastY.current = y;
    },
    [translateY]
  );

  return (
    <BottomBarContext.Provider value={{ onScroll, translateY }}>
      {children}
    </BottomBarContext.Provider>
  );
}

export function useBottomBarScroll() {
  return useContext(BottomBarContext);
}
