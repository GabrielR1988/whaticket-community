import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import RefreshIcon from "@material-ui/icons/Refresh";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import connectToSocket from "../../services/socket-io";
import TemplatePreview from "../../components/TemplatePreview";

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(3) },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  body: {
    whiteSpace: "pre-wrap",
    maxWidth: 420,
    fontSize: 13,
  },
  field: { marginBottom: theme.spacing(2) },
}));

export const STATUS_LABELS = {
  APPROVED: { label: "Aprobada", color: "#43A047" },
  PENDING: { label: "En revisión", color: "#FB8C00" },
  IN_APPEAL: { label: "En apelación", color: "#FB8C00" },
  REJECTED: { label: "Rechazada", color: "#E53935" },
  PAUSED: { label: "Pausada", color: "#757575" },
  DISABLED: { label: "Deshabilitada", color: "#757575" },
};

const CATEGORY_LABELS = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
};

const LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "es_AR", label: "Español (Argentina)" },
  { code: "es_MX", label: "Español (México)" },
  { code: "es_ES", label: "Español (España)" },
  { code: "en_US", label: "Inglés (EE.UU.)" },
  { code: "pt_BR", label: "Portugués (Brasil)" },
];

const EMPTY_FORM = {
  displayName: "",
  category: "MARKETING",
  language: "es",
  header: "",
  body: "",
  bodyExamples: [],
  footer: "",
  buttons: ["", "", ""],
};

// "Seguimiento cotización" -> "seguimiento_cotizacion" (formato que exige Meta)
const toTemplateName = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);

const countVariables = (text) =>
  new Set((text.match(/\{\{\s*(\d+)\s*\}\}/g) || []).map((m) => m.replace(/\D/g, "")))
    .size;

export const getComponent = (template, type) =>
  (template.components || []).find((c) => c.type === type);

const Templates = () => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/meta/templates");
      setEnabled(data.enabled);
      setTemplates(data.templates || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
    const socket = connectToSocket();
    socket.on("metaTemplate", (data) => {
      if (data.action === "status") {
        const status = STATUS_LABELS[data.status]?.label || data.status;
        toast.info(`Plantilla ${data.name}: ${status}`);
      }
      fetchTemplates();
    });
    return () => socket.disconnect();
  }, [fetchTemplates]);

  const varCount = countVariables(form.body);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const setExample = (index, value) =>
    setForm((prev) => {
      const bodyExamples = [...prev.bodyExamples];
      bodyExamples[index] = value;
      return { ...prev, bodyExamples };
    });

  const setButton = (index, value) =>
    setForm((prev) => {
      const buttons = [...prev.buttons];
      buttons[index] = value;
      return { ...prev, buttons };
    });

  const addVariable = () =>
    setField("body", `${form.body}{{${varCount + 1}}}`);

  const handleSave = async () => {
    const name = toTemplateName(form.displayName);
    if (!name) return toast.error("El nombre es obligatorio");
    if (!form.body.trim()) return toast.error("El cuerpo es obligatorio");

    setSaving(true);
    try {
      await api.post("/meta/templates", {
        name,
        category: form.category,
        language: form.language,
        header: form.header,
        body: form.body,
        bodyExamples: form.bodyExamples.slice(0, varCount),
        footer: form.footer,
        buttons: form.buttons,
      });
      toast.success("Plantilla enviada a Meta para revisión");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      fetchTemplates();
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/meta/templates/${toDelete.name}`, {
        params: { hsmId: toDelete.id },
      });
      toast.success("Plantilla eliminada");
      fetchTemplates();
    } catch (err) {
      toastError(err);
    }
    setToDelete(null);
  };

  const previewTemplate = {
    components: [
      form.header && { type: "HEADER", text: form.header },
      { type: "BODY", text: form.body },
      form.footer && { type: "FOOTER", text: form.footer },
      {
        type: "BUTTONS",
        buttons: form.buttons.filter((b) => b.trim()).map((text) => ({ text })),
      },
    ].filter(Boolean),
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5">Plantillas de WhatsApp</Typography>
        <Box display="flex" style={{ gap: 8 }}>
          <Tooltip title="Actualizar estado desde Meta">
            <span>
              <IconButton onClick={fetchTemplates} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled={!enabled}
            onClick={() => {
              setForm(EMPTY_FORM);
              setDialogOpen(true);
            }}
          >
            Nueva plantilla
          </Button>
        </Box>
      </Box>

      {!enabled && (
        <Paper style={{ padding: 16, marginBottom: 16 }}>
          <Typography variant="body2">
            La conexión con la API de WhatsApp de Meta todavía no está configurada
            (faltan META_WHATSAPP_TOKEN y META_WABA_ID en el backend). Cuando esté
            lista, acá vas a poder crear plantillas, mandarlas a aprobar y ver su
            estado.
          </Typography>
        </Paper>
      )}

      <Paper style={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Idioma</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Texto</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => {
              const status = STATUS_LABELS[t.status] || { label: t.status, color: "#757575" };
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{CATEGORY_LABELS[t.category] || t.category}</TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={status.label}
                      style={{ backgroundColor: status.color, color: "#fff" }}
                    />
                    {t.status === "REJECTED" && t.rejected_reason && t.rejected_reason !== "NONE" && (
                      <Typography variant="caption" display="block" color="error">
                        Motivo: {t.rejected_reason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={classes.body}>{getComponent(t, "BODY")?.text}</div>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setToDelete(t)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {enabled && templates.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="textSecondary">
                    Todavía no hay plantillas
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nueva plantilla</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <TextField
                autoFocus
                label="Nombre"
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                value={form.displayName}
                onChange={(e) => setField("displayName", e.target.value)}
                helperText={
                  form.displayName
                    ? `Se guarda como: ${toTemplateName(form.displayName)}`
                    : "Ej: Seguimiento cotización"
                }
              />
              <Box display="flex" style={{ gap: 12 }} className={classes.field}>
                <FormControl variant="outlined" size="small" fullWidth>
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    label="Categoría"
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                  >
                    <MenuItem value="MARKETING">Marketing (promociones, seguimiento)</MenuItem>
                    <MenuItem value="UTILITY">Utilidad (confirmaciones, avisos)</MenuItem>
                  </Select>
                </FormControl>
                <FormControl variant="outlined" size="small" fullWidth>
                  <InputLabel>Idioma</InputLabel>
                  <Select
                    label="Idioma"
                    value={form.language}
                    onChange={(e) => setField("language", e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <MenuItem key={l.code} value={l.code}>
                        {l.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <TextField
                label="Encabezado (opcional)"
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                inputProps={{ maxLength: 60 }}
                value={form.header}
                onChange={(e) => setField("header", e.target.value)}
              />
              <TextField
                label="Cuerpo"
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                size="small"
                inputProps={{ maxLength: 1024 }}
                value={form.body}
                onChange={(e) => setField("body", e.target.value)}
                helperText="Usá {{1}}, {{2}}… para datos que cambian (ej: nombre del cliente)."
              />
              <Box display="flex" justifyContent="flex-end" className={classes.field}>
                <Button size="small" onClick={addVariable}>
                  + Agregar variable
                </Button>
              </Box>
              {Array.from({ length: varCount }).map((_, i) => (
                <TextField
                  key={i}
                  label={`Ejemplo para {{${i + 1}}}`}
                  fullWidth
                  variant="outlined"
                  size="small"
                  className={classes.field}
                  value={form.bodyExamples[i] || ""}
                  onChange={(e) => setExample(i, e.target.value)}
                  helperText={i === 0 ? "Meta pide un ejemplo de cada variable para revisar la plantilla" : ""}
                />
              ))}
              <TextField
                label="Pie (opcional)"
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                inputProps={{ maxLength: 60 }}
                value={form.footer}
                onChange={(e) => setField("footer", e.target.value)}
              />
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Botones de respuesta rápida (opcional)
              </Typography>
              <Box display="flex" style={{ gap: 8 }}>
                {form.buttons.map((b, i) => (
                  <TextField
                    key={i}
                    label={`Botón ${i + 1}`}
                    variant="outlined"
                    size="small"
                    inputProps={{ maxLength: 25 }}
                    value={b}
                    onChange={(e) => setButton(i, e.target.value)}
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Vista previa
              </Typography>
              <TemplatePreview template={previewTemplate} params={form.bodyExamples} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} color="primary" variant="contained" disabled={saving}>
            Enviar a aprobación
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onClose={() => setToDelete(null)}>
        <DialogTitle>Eliminar plantilla</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar la plantilla <strong>{toDelete?.name}</strong> ({toDelete?.language}) en Meta?
            No se puede deshacer y Meta no deja reutilizar el mismo nombre por 30 días.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="secondary" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Templates;
