import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupChatHandlers = (io: Server, socket: Socket) => {
  const user = socket.data.user;

  joinUserChats(socket);

  socket.on('message:send', async (data) => {
    try {
      const { chatId, content, fileUrl } = data;
      console.log('Sending message:', { chatId, content, fileUrl });
      
      const isMember = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: user.id,
          },
        },
      });
      
      if (!isMember) {
        socket.emit('error', { message: 'Not authorized to send messages to this chat' });
        return;
      }
      
      const message = await prisma.message.create({
        data: {
          content,
          fileUrl,
          senderId: user.id,
          chatId,
        },
        include: {
          sender: true,
        },
      });
      
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageAt: new Date() },
      });
      
      io.to(`chat:${chatId}`).emit('message:new', message);
      
      await prisma.readReceipt.create({
        data: {
          messageId: message.id,
          userId: user.id,
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('message:delete', async (data) => {
    try {
      const { messageId } = data;
      
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });
      
      if (!message || message.senderId !== user.id) {
        socket.emit('error', { message: 'Not authorized to delete this message' });
        return;
      }
      
      await prisma.message.update({
        where: { id: messageId },
        data: { deleted: true },
      });
      
      io.to(`chat:${message.chatId}`).emit('message:deleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });
}

const joinUserChats = async (socket: Socket) => {
  const user = socket.data.user;
  
  const chatMemberships = await prisma.chatMember.findMany({
    where: { userId: user.id },
    select: { chatId: true },
  });
  
  for (const membership of chatMemberships) {
    socket.join(`chat:${membership.chatId}`);
  }
}