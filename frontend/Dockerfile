FROM node:18-bullseye
WORKDIR /usr/src/app

# 1. Le decimos a Docker que atrape la variable de Railway
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# 2. Copiamos e instalamos dependencias
COPY package*.json ./
RUN npm install
RUN npm install express

# 3. Copiamos el resto del codigo
COPY . ./

# 4. Construimos la pagina (¡Ahora sí tiene la URL del Backend pegada!)
RUN npm run build

# 5. Exponemos e iniciamos
EXPOSE 3333
CMD ["node", "server.js"]
