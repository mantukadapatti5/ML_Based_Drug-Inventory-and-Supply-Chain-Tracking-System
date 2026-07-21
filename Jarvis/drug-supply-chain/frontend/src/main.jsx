console.log("TEST 1 - Before imports");

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

console.log("TEST 2 - All imports successful!");

try {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  console.log("✅ Root created");
  
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  console.log("✅ App rendered");
} catch (error) {
  console.error("❌ Render error:", error);
  document.getElementById("root").innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;"><h1>Error</h1><pre>${error.message}\n\n${error.stack}</pre></div>`;
}







