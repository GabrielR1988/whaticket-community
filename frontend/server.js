const express = require("express");
const path = require("path");
const app = express();

// Bajar los escudos de seguridad para permitir el Iframe
app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    next();
});

app.use(express.static(path.join(__dirname, "build")));

app.get(/(.*)/, function (req, res) {
	res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(3333);
