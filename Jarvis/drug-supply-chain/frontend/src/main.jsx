import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

try {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} catch (error) {
  console.error("Render error:", error);
  document.getElementById("root").innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;"><h1>Error</h1><pre>${error.message}\n\n${error.stack}</pre></div>`;
}