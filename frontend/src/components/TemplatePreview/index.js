import React from "react";
import { makeStyles, Typography } from "@material-ui/core";

const useStyles = makeStyles(() => ({
  wrapper: {
    backgroundColor: "#e5ddd5",
    padding: 16,
    borderRadius: 8,
  },
  bubble: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: "8px 10px",
    maxWidth: 320,
    boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
    color: "#111",
  },
  header: { fontWeight: "bold", marginBottom: 4 },
  body: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14 },
  footer: { color: "#8696a0", fontSize: 12, marginTop: 4 },
  button: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxWidth: 320,
    marginTop: 4,
    padding: 6,
    textAlign: "center",
    color: "#00a5f4",
    fontSize: 14,
    boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
  },
}));

// Reemplaza {{n}} por el valor cargado (o deja la variable si esta vacio).
export const renderTemplateText = (text = "", params = []) =>
  text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => params[Number(n) - 1] || match);

const TemplatePreview = ({ template, params = [] }) => {
  const classes = useStyles();
  const get = (type) => (template?.components || []).find((c) => c.type === type);
  const header = get("HEADER");
  const body = get("BODY");
  const footer = get("FOOTER");
  const buttons = get("BUTTONS")?.buttons || [];

  return (
    <div className={classes.wrapper}>
      <div className={classes.bubble}>
        {header?.text && <div className={classes.header}>{header.text}</div>}
        <div className={classes.body}>
          {body?.text ? (
            renderTemplateText(body.text, params)
          ) : (
            <Typography variant="caption" color="textSecondary">
              (sin texto)
            </Typography>
          )}
        </div>
        {footer?.text && <div className={classes.footer}>{footer.text}</div>}
      </div>
      {buttons.map((b, i) => (
        <div key={i} className={classes.button}>
          {b.text}
        </div>
      ))}
    </div>
  );
};

export default TemplatePreview;
