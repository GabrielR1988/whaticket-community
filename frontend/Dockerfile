FROM node:18-bullseye
WORKDIR /usr/src/app

# Copiamos e instalamos
COPY package*.json ./
RUN npm install
RUN npm install express

# Copiamos todo el resto
COPY . ./

# EL MARTILLAZO: Forzamos la creación del archivo físico con tu link real.
# (Ponemos los 3 formatos posibles para que Vite no tenga excusas)
RUN echo "REACT_APP_BACKEND_URL=https://whaticket-community-production-d61c.up.railway.app" > .env
RUN echo "VITE_BACKEND_URL=https://whaticket-community-production-d61c.up.railway.app" >> .env
RUN echo "VITE_REACT_APP_BACKEND_URL=https://whaticket-community-production-d61c.up.railway.app" >> .env

# Construimos la pagina con la URL ya inyectada
RUN npm run build

# Exponemos e iniciamos
EXPOSE 3333
CMD ["node", "server.js"]
