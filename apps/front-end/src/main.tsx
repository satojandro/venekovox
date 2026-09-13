import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import App from "./App.tsx";
import { BootErrorBoundary } from "./BootErrorBoundary";
import { installGlobalErrorReporting } from "./lib/clientError";
import "./styles/index.css";
import "./styles/editorial.css";
import "./styles/collage-boards.css";

// Route uncaught client errors to the backend log: the test machine's devtools
// are not readily reachable, and a raw ethers error there is unreadable anyway.
installGlobalErrorReporting();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </BootErrorBoundary>
  </React.StrictMode>,
);
