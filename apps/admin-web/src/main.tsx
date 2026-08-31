import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { AlarmProvider } from "./context/AlarmContext";
import "./App.css";

const savedTheme = (() => {
  try {
    const t = localStorage.getItem("admin-theme");
    return t === "light" || t === "dark" ? t : "light";
  } catch {
    return "light";
  }
})();
document.documentElement.setAttribute("data-theme", savedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AlarmProvider>
            <App />
          </AlarmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
