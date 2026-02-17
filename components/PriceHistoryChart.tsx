import React from "react";
import { View } from "react-native";
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme } from "victory-native";

export default function PriceHistoryChart({ data }: { data: { x: string; y: number }[] }) {
  return (
    <View>
      <VictoryChart theme={VictoryTheme.material} height={220}>
        <VictoryAxis fixLabelOverlap />
        <VictoryAxis dependentAxis />
        <VictoryLine data={data} interpolation="monotoneX" />
      </VictoryChart>
    </View>
  );
}
