import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebaseConfig";

export const AdminPostDeal: React.FC = () => {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const processProductUrl = httpsCallable(functions, "processProductUrl");

  const handlePasteUrl = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const url = urlInput.trim();
    if (!url) return;

    setLoading(true);
    try {
      const response = await processProductUrl({ url });
      setResult(response.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Post Deal</h1>
      <input
        type="text"
        placeholder="Paste URL and press Enter"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onKeyDown={handlePasteUrl}
        disabled={loading}
        style={{ width: "100%", padding: "10px", fontSize: "16px", marginBottom: "10px" }}
      />
      {loading && <p>Processing...</p>}
      {result && (
        <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
          {result.success ? (
            <>
              <h2>{result.metadata.title}</h2>
              <p><strong>Store:</strong> {result.store}</p>
              <p><strong>Price:</strong> ${result.metadata.currentPrice}</p>
              <p><strong>Time:</strong> {result.processingTimeMs}ms</p>
              {result.metadata.image && (
                <img src={result.metadata.image} alt="product" style={{ maxWidth: "200px", borderRadius: "4px" }} />
              )}
            </>
          ) : (
            <p style={{ color: "red" }}>Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
};
