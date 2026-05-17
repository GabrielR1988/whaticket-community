import openSocket from "socket.io-client";
// Podés dejar la línea de import de getBackendUrl, no molesta aunque ya no la usemos.
import { getBackendUrl } from "../config";

function connectToSocket() {
    const token = localStorage.getItem("token");
    // ACÁ ESTÁ LA MAGIA: Reemplazamos getBackendUrl() por tu proxy
    return openSocket("https://mantenertoken-production.up.railway.app", {
      transports: ["websocket", "polling", "flashsocket"],
      query: {
        token: JSON.parse(token),
      },
    });
}

export default connectToSocket;
