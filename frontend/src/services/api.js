import axios from "axios";
import { getBackendUrl } from "../config";

const api = axios.create({
  // OJO: Terminamos en /wtapi (sin barra al final)
  baseURL: getBackendUrl(),
  withCredentials: true,
});

export default api;
