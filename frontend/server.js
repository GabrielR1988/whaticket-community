const express = require("express");
const path = require("path");
const app = express();

// Bajar los escudos de seguridad para permitir Iframes y recursos compartidos (CORS)
app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    // El pase libre para los archivos de diseño (js, css, etc.)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
    
    next();
});

app.use(express.static(path.join(__dirname, "build")));

app.get(/(.*)/, function (req, res) {
	res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(3333);
