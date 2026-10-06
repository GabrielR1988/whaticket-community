const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const buildDir = path.join(__dirname, "build");

const publicEnv = {
  VITE_BACKEND_URL: process.env.VITE_BACKEND_URL,
  VITE_HOURS_CLOSE_TICKETS_AUTO: process.env.VITE_HOURS_CLOSE_TICKETS_AUTO,
};

const envScript = `<script>var ENV=${JSON.stringify(publicEnv)}</script>`;
const placeholder = '<noscript id="env-insertion-point"></noscript>';
const rawHtml = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
const indexHtml = rawHtml.includes(placeholder)
  ? rawHtml.replace(placeholder, () => envScript)
  : rawHtml.replace("</head>", () => `${envScript}</head>`);

const frameAncestors = process.env.FRAME_ANCESTORS || "*";

app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", `frame-ancestors ${frameAncestors}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
  next();
});

app.use(express.static(buildDir, { index: false }));

app.get(/(.*)/, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(indexHtml);
});

app.listen(process.env.PORT || 3333, "0.0.0.0");