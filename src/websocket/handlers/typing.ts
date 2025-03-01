import { Server, Socket } from 'socket.io';

const typingUsers = new Map<string, NodeJS.Timeout>();

export const setupTypingHandlers = (io: Server, socket: Socket) => {
  const user = socket.data.user;
  
  socket.on('typing:start', async (data) => {
    const { chatId } = data;
    const key = `${chatId}:${user.id}`;
    
    if (typingUsers.has(key)) {
      clearTimeout(typingUsers.get(key)!);
    }
    
    const timeout = setTimeout(() => {
      typingUsers.delete(key);
      io.to(`chat:${chatId}`).emit('typing:stop', {
        userId: user.id,
        chatId,
      });
    }, 3000);
    
    typingUsers.set(key, timeout);
    
    socket.to(`chat:${chatId}`).emit('typing:start', {
      userId: user.id,
      chatId,
    });
  });
  
  socket.on('typing:stop', (data) => {
    const { chatId } = data;
    const key = `${chatId}:${user.id}`;
    
    if (typingUsers.has(key)) {
      clearTimeout(typingUsers.get(key)!);
      typingUsers.delete(key);
    }
    
    socket.to(`chat:${chatId}`).emit('typing:stop', {
      userId: user.id,
      chatId,
    });
  });
}