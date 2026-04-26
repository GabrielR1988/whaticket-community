FROM node:18-bullseye
WORKDIR /usr/src/app

# Copiamos los archivos de configuracion e instalamos dependencias
COPY package*.json ./
RUN npm install

# Por las dudas instalamos express que lo pide el server.js
RUN npm install express

# Copiamos todo el resto del codigo
COPY . ./

# Construimos la pagina (Acá lee tu variable REACT_APP_BACKEND_URL de Railway)
RUN npm run build

# Exponemos el puerto que usa server.js
EXPOSE 3333

# Iniciamos el sistema
CMD ["node", "server.js"]
