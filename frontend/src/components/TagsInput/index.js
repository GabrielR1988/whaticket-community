import React, { useEffect, useState } from "react";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  tag: {
    margin: "2px"
  }
}));

const TagsInput = ({ ticketId }) => {
  const classes = useStyles();
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Cargar todas las tags disponibles
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data } = await api.get("/tags");
        setAllTags(data);
      } catch (err) {
        toastError(err);
      }
    };
    fetchTags();
  }, []);

  // Cargar tags actuales del ticket
  useEffect(() => {
    if (!ticketId) return;
    const fetchTicketTags = async () => {
      try {
        const { data } = await api.get(`/tickets/${ticketId}/tags`);
        setSelectedTags(data);
      } catch (err) {
        toastError(err);
      }
    };
    fetchTicketTags();
  }, [ticketId]);

  const handleChange = async (event, newTags) => {
    setSelectedTags(newTags);
    try {
      await api.post(`/tickets/${ticketId}/tags/sync`, {
        tagIds: newTags.map(t => t.id)
      });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Autocomplete
      multiple
      size="small"
      options={allTags}
      value={selectedTags}
      onChange={handleChange}
      getOptionLabel={option => option.name}
      getOptionSelected={(option, value) => option.id === value.id}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            key={index}
            variant="outlined"
            label={option.name}
            size="small"
            className={classes.tag}
            style={{
              backgroundColor: option.color || "#7C7C7C",
              color: "#fff",
              borderColor: option.color || "#7C7C7C"
            }}
            {...getTagProps({ index })}
          />
        ))
      }
      renderInput={params => (
        <TextField
          {...params}
          variant="outlined"
          placeholder="Etiquetas"
          size="small"
        />
      )}
    />
  );
};

export default TagsInput;
