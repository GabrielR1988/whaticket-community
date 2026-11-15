import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import TemplatePreview from "../TemplatePreview";

const countVariables = (text = "") =>
  new Set((text.match(/\{\{\s*(\d+)\s*\}\}/g) || []).map((m) => m.replace(/\D/g, "")))
    .size;

// Envia una plantilla aprobada por Meta al contacto del ticket (sirve aunque
// hayan pasado mas de 24 h desde el ultimo mensaje del cliente).
const SendTemplateModal = ({ open, onClose, ticketId }) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState({ enabled: true, canSend: true });
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [params, setParams] = useState([]);

  useEffect(() => {
    if (!open) return;
    setSelectedKey("");
    setParams([]);
    setLoading(true);
    api
      .get("/meta/templates")
      .then(({ data }) => {
        setInfo({ enabled: data.enabled, canSend: data.canSend });
        setTemplates((data.templates || []).filter((t) => t.status === "APPROVED"));
      })
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [open]);

  const template = templates.find((t) => `${t.name}|${t.language}` === selectedKey);
  const bodyText = (template?.components || []).find((c) => c.type === "BODY")?.text || "";
  const varCount = countVariables(bodyText);

  const setParam = (i, value) =>
    setParams((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  const handleSend = async () => {
    if (!template) return;
    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/template`, {
        name: template.name,
        language: template.language,
        params: params.slice(0, varCount),
      });
      toast.success("Plantilla enviada");
      onClose();
    } catch (err) {
      toastError(err);
    }
    setSending(false);
  };

  const unavailable = !info.enabled || !info.canSend;

  const renderContent = () => {
    if (loading) return <CircularProgress size={24} />;
    if (unavailable) {
      return (
        <Typography variant="body2">
          La API de WhatsApp de Meta todavía no está configurada (faltan
          META_WHATSAPP_TOKEN, META_WABA_ID o META_PHONE_NUMBER_ID).
        </Typography>
      );
    }
    if (templates.length === 0) {
      return (
        <Typography variant="body2">
          No hay plantillas aprobadas. Creálas en el menú Plantillas.
        </Typography>
      );
    }
    return (
      <>
        <FormControl variant="outlined" size="small" fullWidth style={{ marginBottom: 16 }}>
          <InputLabel>Plantilla</InputLabel>
          <Select
            label="Plantilla"
            value={selectedKey}
            onChange={(e) => {
              setSelectedKey(e.target.value);
              setParams([]);
            }}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={`${t.name}|${t.language}`}>
                {t.name} ({t.language})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {Array.from({ length: varCount }).map((_, i) => (
          <TextField
            key={i}
            label={`Valor para {{${i + 1}}}`}
            fullWidth
            variant="outlined"
            size="small"
            style={{ marginBottom: 12 }}
            value={params[i] || ""}
            onChange={(e) => setParam(i, e.target.value)}
          />
        ))}
        {template && <TemplatePreview template={template} params={params} />}
      </>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enviar plantilla</DialogTitle>
      <DialogContent>{renderContent()}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSend}
          disabled={!template || sending || unavailable}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendTemplateModal;
