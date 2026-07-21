import { io } from "socket.io-client";

let socketInstance = null;

/**
 * Shared Socket.IO client — same origin + /ws path (Vite/nginx proxy to FastAPI).
 * @param {string} role - admin | vendor | distributor
 */
export function getSocket(role = "admin") {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  const baseUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

  socketInstance = io(baseUrl, {
    path: "/ws/socket.io",
    transports: ["websocket", "polling"],
    query: { role },
    auth: { role },
    reconnection: true,
    reconnectionDelay: 1000,
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
