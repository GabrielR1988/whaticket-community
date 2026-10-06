FROM node:18-bullseye AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-bullseye-slim
WORKDIR /app
RUN npm install express
COPY --from=build /app/build ./build
COPY server.js .
ENV PORT=3333
EXPOSE 3333
CMD ["node", "server.js"]