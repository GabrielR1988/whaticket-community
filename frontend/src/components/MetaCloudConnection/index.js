import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  makeStyles,
  Paper,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import connectToSocket from "../../services/socket-io";
import { AuthContext } from "../../context/Auth/AuthContext";

// Tarjeta "WhatsApp API (Meta)" en Conexiones: alta de la Cloud API con Embedded Signup
// (coexistencia: el numero sigue funcionando en la app WhatsApp Business del celular).
// Es independiente de las conexiones por QR de WhatsApp Web de la tabla de abajo.

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  details: {
    marginTop: theme.spacing(1),
    fontSize: 13,
  },
  pre: {
    fontSize: 12,
    background: theme.palette.type === "dark" ? "#222" : "#f5f5f5",
    padding: theme.spacing(1),
    borderRadius: 4,
    overflowX: "auto",
  },
}));

const loadFacebookSdk = (appId, version) =>
  new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      return resolve(window.FB);
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () =>
      reject(new Error("No se pudo cargar el SDK de Facebook (¿bloqueador de anuncios?)"));
    document.body.appendChild(script);
  });

const MetaCloudConnection = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // Datos que manda la ventana de Meta por postMessage (WABA, numero, tipo de alta).
  const sessionInfo = useRef(null);

  const fetchInfo = useCallback(async () => {
    try {
      const { data } = await api.get("/meta/connection");
      setInfo(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInfo();
    const socket = connectToSocket();
    socket.on("metaConnection", fetchInfo);
    return () => socket.disconnect();
  }, [fetchInfo]);

  useEffect(() => {
    const onMessage = (event) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(event.origin)) return;
      let data;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (String(data.event).startsWith("FINISH")) {
        sessionInfo.current = { event: data.event, ...(data.data || {}) };
      } else if (data.event === "CANCEL") {
        const step = data.data?.current_step;
        toast.info(`Alta cancelada${step ? ` (paso: ${step})` : ""}`);
      } else if (data.event === "ERROR") {
        toast.error(`Meta: ${data.data?.error_message || "error en el alta"}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const waitForSessionInfo = async () => {
    for (let i = 0; i < 20 && !sessionInfo.current; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
    return sessionInfo.current || {};
  };

  const finishSignup = async (code) => {
    try {
      const session = await waitForSessionInfo();
      const { data } = await api.post("/meta/connection", {
        code,
        wabaId: session.waba_id,
        phoneNumberId: session.phone_number_id,
        event: session.event,
      });
      toast.success(
        `Conectado: ${data.displayPhone || data.phoneNumberId} (${
          data.mode === "coexistence" ? "coexistencia" : "solo API"
        })`
      );
      (data.warnings || []).forEach((w) => toast.warn(w));
      fetchInfo();
    } catch (err) {
      toastError(err);
    }
    setConnecting(false);
  };

  const handleConnect = async () => {
    const { appId, configId, apiVersion } = info.app;
    setConnecting(true);
    sessionInfo.current = null;
    try {
      const FB = await loadFacebookSdk(appId, apiVersion);
      // El callback de FB.login no puede ser async (lo exige el SDK).
      FB.login(
        (response) => {
          const code = response?.authResponse?.code;
          if (code) {
            finishSignup(code);
          } else {
            setConnecting(false);
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        }
      );
    } catch (err) {
      toast.error(err.message);
      setConnecting(false);
    }
  };

  const handleCheck = async () => {
    try {
      const { data } = await api.get("/meta/connection/check");
      setCheckResult(data);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete("/meta/connection");
      toast.success("Credenciales borradas del CRM");
      setCheckResult(null);
      fetchInfo();
    } catch (err) {
      toastError(err);
    }
    setConfirmDisconnect(false);
  };

  if (loading || !info) {
    return (
      <Paper className={classes.paper} variant="outlined">
        <CircularProgress size={20} />
      </Paper>
    );
  }

  const { app, connection } = info;

  const statusChip = connection.enabled ? (
    <Chip
      size="small"
      label={connection.source === "env" ? "Conectada (variables de entorno)" : "Conectada"}
      style={{ backgroundColor: "#43A047", color: "#fff" }}
    />
  ) : (
    <Chip size="small" label="Sin conectar" />
  );

  return (
    <Paper className={classes.paper} variant="outlined">
      <Box className={classes.row}>
        <Box>
          <Typography variant="subtitle1">
            WhatsApp API (Meta) — coexistencia {statusChip}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Plantillas, eventos de anuncios y webhook. Los chats siguen entrando por la
            conexión QR de abajo.
          </Typography>
        </Box>
        {isAdmin && (
          <Box display="flex" style={{ gap: 8 }}>
            {connection.enabled && (
              <Button size="small" variant="outlined" onClick={handleCheck}>
                Verificar
              </Button>
            )}
            {connection.enabled && connection.source === "crm" && (
              <Button size="small" onClick={() => setConfirmDisconnect(true)}>
                Desconectar
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              color="primary"
              disabled={!app.ready || connecting}
              onClick={handleConnect}
            >
              {connecting ? (
                <CircularProgress size={18} />
              ) : connection.enabled ? (
                "Reconectar con Meta"
              ) : (
                "Conectar con Meta"
              )}
            </Button>
          </Box>
        )}
      </Box>

      <Box className={classes.details}>
        {connection.enabled && (
          <Typography variant="body2">
            Número: <strong>{connection.displayPhone || connection.phoneNumberId || "—"}</strong>
            {connection.verifiedName && ` · ${connection.verifiedName}`} · WABA {connection.wabaId}
          </Typography>
        )}
        {!app.ready && (
          <Typography variant="body2" color="error">
            Para habilitar el botón faltan variables en el backend: META_APP_ID, META_APP_SECRET y
            META_ES_CONFIG_ID (ver docs/META_CAPI.md).
          </Typography>
        )}
        {app.ready && !app.webhookConfigured && (
          <Typography variant="body2" color="textSecondary">
            Falta META_WEBHOOK_VERIFY_TOKEN para el webhook (identificador de clic de anuncios y
            estado de plantillas).
          </Typography>
        )}
        {checkResult && (
          <pre className={classes.pre}>{JSON.stringify(checkResult, null, 2)}</pre>
        )}
      </Box>

      <Dialog open={confirmDisconnect} onClose={() => setConfirmDisconnect(false)}>
        <DialogTitle>Desconectar WhatsApp API</DialogTitle>
        <DialogContent>
          <Typography>
            Se borran el token y los IDs guardados en el CRM: dejan de funcionar las plantillas y
            el webhook. El número no se elimina de Meta ni se desconecta del celular.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisconnect(false)}>Cancelar</Button>
          <Button color="secondary" variant="contained" onClick={handleDisconnect}>
            Desconectar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default MetaCloudConnection;
