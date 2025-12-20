import React from "react";
import { createRoot } from "react-dom/client";
import LiveDealsFeed from "./components/LiveDealsFeed";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<LiveDealsFeed />);
}
