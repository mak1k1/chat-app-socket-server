import { Server, Socket } from "socket.io"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const onlineUsers = new Map<string, boolean>()

export const setupPresenceHandlers = (io: Server, socket: Socket) => {
  const user = socket.data.user

  onlineUsers.set(user.id, true)
  console.log("User went online:", user.id)

  broadcastUserStatus(io, user.id, true)

  socket.on("presence:get", async (data) => {
    const { userId } = data
    socket.emit("presence:status", {
      userId,
      online: onlineUsers.has(userId),
    })
  })

  socket.on("disconnect", () => {
    onlineUsers.delete(user.id)
    broadcastUserStatus(io, user.id, false)
  })
}

const broadcastUserStatus = async (
  io: Server,
  userId: string,
  online: boolean
) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: userId },
      select: { contactId: true },
    })

    const contactIds = contacts.map((c) => c.contactId)

    for (const contactId of contactIds) {
      io.to(`user:${contactId}`).emit("presence:update", {
        userId,
        online,
        lastSeen: online ? new Date() : undefined,
      })
    }
  } catch (error) {
    console.error("Error broadcasting status:", error)
  }
}
