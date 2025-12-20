// flashradar/hooks/usePulseAnimation.ts
import { useRef, useEffect } from "react";
import { Animated } from "react-native";

/**
 * usePulseAnimation
 * Creates a subtle solid stroke pulse expanding behind the heart icon.
 */
export function usePulseAnimation(duration: number = 500, scale: number = 1.3) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const triggerPulse = () => {
    scaleAnim.setValue(0);
    opacityAnim.setValue(0.6);

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: scale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const ringStyle = {
    position: "absolute" as const,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FF6600",
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  };

  return { triggerPulse, ringStyle };
}
