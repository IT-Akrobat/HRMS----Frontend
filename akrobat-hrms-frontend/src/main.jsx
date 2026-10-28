import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/common/Errorboundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RegionProvider } from "./context/RegionContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RegionProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </RegionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
