import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

const App = () => {
  const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "&::-webkit-scrollbar-thumb": {
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
          backgroundColor: "#e8e8e8",
        },
      },
      palette: {
        primary: { main: "#2576d2" },
      },
    },
    locale
  );

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Routes />
    </ThemeProvider>
  );
};

window.addEventListener("message", (event) => {
  // Por seguridad, siempre validamos el origen del CRM
  if (event.origin !== "https://tu-dominio-expocrm.com") return;

  if (event.data && event.data.type === "SET_WHATICKET_TOKEN") {
    // Guardamos el token que viene del CRM en el localStorage
    localStorage.setItem("token", JSON.stringify(event.data.token));
    
    // Opcional: recargar la ventana para que los hooks de autenticación tomen el nuevo token
    window.location.reload();
  }
});  

export default App;
