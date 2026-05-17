import axios from "axios";
import { getBackendUrl } from "../config";

const api = axios.create({
  // OJO: Terminamos en /wtapi (sin barra al final)
  baseURL: "https://mantenertoken-production.up.railway.app/wtapi",
  withCredentials: true,
});

export default api;
