import axios from "axios";
import { getBackendUrl } from "../config";

const api = axios.create({
  baseURL: "https://mantenertoken-production.up.railway.app",
  withCredentials: true,
});

export default api;
