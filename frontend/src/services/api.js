import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("inkwell-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function imageUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const apiOrigin = new URL(api.defaults.baseURL).origin;
  return `${apiOrigin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function errorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong. Please try again.";
}
