import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  chips: { display: "flex", flexWrap: "wrap" },
  chip: { margin: 2, height: 20, fontSize: "0.7em", color: "#fff" },
  formControl: { minWidth: 80, maxWidth: 120 },
}));

const TicketsTagSelect = ({ selectedTagIds = [], onChange }) => {
  const classes = useStyles();
  const [tags, setTags] = useState([]);

  useEffect(() => {
    api.get("/tags").then(({ data }) => setTags(data)).catch(toastError);
  }, []);

  return (
    <FormControl className={classes.formControl} margin="dense" variant="outlined">
      <InputLabel>Tags</InputLabel>
      <Select
        multiple
        value={selectedTagIds}
        onChange={e => onChange(e.target.value)}
        label="Tags"
        renderValue={selected => (
          <div className={classes.chips}>
            {selected.map(id => {
              const tag = tags.find(t => t.id === id);
              return tag ? (
                <Chip
                  key={id}
                  label={tag.name}
                  size="small"
                  className={classes.chip}
                  style={{ backgroundColor: tag.color || "#7C7C7C" }}
                />
              ) : null;
            })}
          </div>
        )}
      >
        {tags.map(tag => (
          <MenuItem key={tag.id} value={tag.id}>
            <span style={{
              display: "inline-block", width: 12, height: 12,
              borderRadius: "50%", backgroundColor: tag.color || "#7C7C7C",
              marginRight: 8
            }} />
            {tag.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default TicketsTagSelect;
