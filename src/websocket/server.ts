import { Server as HttpServer } from "http"
import { Server, Socket } from "socket.io"
import { PrismaClient } from "@prisma/client"

import { setupChatHandlers } from "./handlers/chat"
import { setupTypingHandlers } from "./handlers/typing"
import { setupPresenceHandlers } from "./handlers/presence"
import { setupReadReceiptHandlers } from "./handlers/read-receipts"
import { createClerkClient } from "@clerk/backend"
import { ExtendedError } from "socket.io/dist/namespace"

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
})
const prisma = new PrismaClient()

const convertHandshakeToRequest = (socket: Socket) => {
  const { headers } = socket.handshake;
  const origin = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = new URL("/", origin);

  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    requestHeaders.set(key, value as string);
  }

  if (socket.handshake.auth.token) {
    requestHeaders.set('authorization', `Bearer ${socket.handshake.auth.token}`);
  }

  return new Request(url, {
    method: 'GET',
    headers: requestHeaders,
  });
}

export const initializeWebSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  })

  io.use(async (socket: Socket, next: (err?: ExtendedError) => void) => {
    console.log("Socket.IO middleware running")
    console.log("Socket handshake auth:", socket.handshake.auth)
    
    try {
      // Convert Socket.IO handshake to a Request object for Clerk
      // https://github.com/orgs/clerk/discussions/2824
      const request = convertHandshakeToRequest(socket);
      
      const authStatus = await clerkClient.authenticateRequest(request);
      
      if (!authStatus.isSignedIn) {
        return next(new Error("Authentication error: Not signed in"));
      }
      
      const auth = authStatus.toAuth();
      
      socket.data.user = {
        id: auth.userId,
      };
      
      next();
    } catch (error: any) {
      console.error("Authentication error:", error);
      next(new Error(`Authentication failed: ${error.message}`));
    }
  })

  io.on("connection", (socket) => {
    const user = socket.data.user
    console.log(
      `User connected: ${user.id}`
    )

    socket.join(`user:${user.id}`)

    setupChatHandlers(io, socket)
    setupPresenceHandlers(io, socket)
    setupTypingHandlers(io, socket)
    setupReadReceiptHandlers(io, socket)

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${user.id}`)

      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeen: new Date() },
      })
    })
  })

  return io
}
