// src/websocket/handlers/read-receipts.ts
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupReadReceiptHandlers = (io: Server, socket: Socket) => {
  const user = socket.data.user;
  
  socket.on('message:read', async (data) => {
    try {
      const { messageId } = data;
      
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { chatId: true },
      });
      
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }
      
      const isMember = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: message.chatId,
            userId: user.id,
          },
        },
      });
      
      if (!isMember) {
        socket.emit('error', { message: 'Not authorized to read messages in this chat' });
        return;
      }
      
      const readReceipt = await prisma.readReceipt.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId: user.id,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          messageId,
          userId: user.id,
          readAt: new Date(),
        },
      });
      
      io.to(`chat:${message.chatId}`).emit('message:read', {
        messageId,
        userId: user.id,
        readAt: readReceipt.readAt,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      socket.emit('error', { message: 'Failed to mark message as read' });
    }
  });
}