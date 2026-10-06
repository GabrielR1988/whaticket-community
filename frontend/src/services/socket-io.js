import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

function connectToSocket() {
    const token = localStorage.getItem("token");
    // Solo el origen: si VITE_BACKEND_URL termina en /wtapi, socket.io lo tomaría como namespace.
    // El proxy enruta /socket.io/* directo al backend.
    return openSocket(new URL(getBackendUrl() || "/", window.location.href).origin, {
      transports: ["websocket", "polling", "flashsocket"],
      query: {
        token: JSON.parse(token),
      },
    });
}

export default connectToSocket;
