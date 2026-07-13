import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import LiveDealsFeed from "./components/LiveDealsFeed";
import { AdminPostDeal } from "./pages/admin/AdminPostDeal";

const App = () => {
  const [view, setView] = useState<"feed" | "admin">("feed");

  return (
    <div>
      <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
        <button onClick={() => setView("feed")} style={{ marginRight: "10px", fontWeight: view === "feed" ? "bold" : "normal" }}>
          Feed
        </button>
        <button onClick={() => setView("admin")} style={{ fontWeight: view === "admin" ? "bold" : "normal" }}>
          Post Deal
        </button>
      </nav>
      {view === "feed" && <LiveDealsFeed />}
      {view === "admin" && <AdminPostDeal />}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
