import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "inline-block",
    border: "1px solid #ccc",
  },
  colorInput: {
    width: 60,
    height: 36,
    padding: 0,
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
  },
}));

const Tags = () => {
  const classes = useStyles();
  const [tags, setTags] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#25D366");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);

  const fetchTags = async () => {
    try {
      const { data } = await api.get("/tags");
      setTags(data);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleOpenDialog = (tag = null) => {
    if (tag) {
      setEditingTag(tag);
      setName(tag.name);
      setColor(tag.color || "#25D366");
    } else {
      setEditingTag(null);
      setName("");
      setColor("#25D366");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTag(null);
    setName("");
    setColor("#25D366");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      if (editingTag) {
        await api.put(`/tags/${editingTag.id}`, { name, color });
        toast.success("Etiqueta actualizada");
      } else {
        await api.post("/tags", { name, color });
        toast.success("Etiqueta creada");
      }
      fetchTags();
      handleCloseDialog();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteConfirm = (tag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tags/${tagToDelete.id}`);
      toast.success("Etiqueta eliminada");
      fetchTags();
    } catch (err) {
      toastError(err);
    }
    setDeleteConfirmOpen(false);
    setTagToDelete(null);
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5">Etiquetas</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Etiqueta
        </Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Color</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <span
                    className={classes.colorCircle}
                    style={{ backgroundColor: tag.color || "#7C7C7C" }}
                  />
                </TableCell>
                <TableCell>{tag.name}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpenDialog(tag)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteConfirm(tag)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tags.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No hay etiquetas creadas todavía
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingTag ? "Editar Etiqueta" : "Nueva Etiqueta"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Nombre"
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Box display="flex" alignItems="center" style={{ gap: 12 }}>
            <Typography variant="body1">Color:</Typography>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={classes.colorInput}
            />
            <span
              className={classes.colorCircle}
              style={{ backgroundColor: color, width: 32, height: 32 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar eliminación */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Eliminar Etiqueta</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro que querés eliminar la etiqueta{" "}
            <strong>{tagToDelete?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="secondary" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Tags;
