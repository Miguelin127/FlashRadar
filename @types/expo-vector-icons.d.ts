declare module "@expo/vector-icons/build/createIconSet" {
  import { ComponentClass } from "react";
  import {
    TextProps,
    ViewProps,
    TextStyle,
    ViewStyle,
    ColorValue,
  } from "react-native";

  export interface IconProps<GLYPHS extends string> extends TextProps {
    size?: number;
    name: GLYPHS;
    color?: string;
  }

  // Simplified: removed TouchableHighlightProps to prevent conflicts
  export interface IconButtonProps<GLYPHS extends string>
    extends IconProps<GLYPHS>,
      ViewProps {
    color?: string;
    borderRadius?: number;
    iconStyle?: TextStyle;
    style?: ViewStyle | TextStyle;
    backgroundColor?: string;
  }

  export interface Icon<G extends string, FN extends string> {
    Button: ComponentClass<IconButtonProps<G>>;
  }

  export default function <G extends string, FN extends string>(
    glyphMap: Record<G, number | string>,
    fontName: FN,
    expoAssetId: any,
    fontStyle?: any
  ): Icon<G, FN>;
}
