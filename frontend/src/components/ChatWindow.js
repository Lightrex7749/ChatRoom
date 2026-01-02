import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, Phone, MoreVertical, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

export const ChatWindow = ({ currentUser, selectedUser, messages, onSendMessage, typing, onStartCall }) => {
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Memoize filtered messages for better performance
  const filteredMessages = useMemo(() => 
    messages.filter(
      m => (m.from_user_id === currentUser.id && m.to_user_id === selectedUser.id) ||
           (m.from_user_id === selectedUser.id && m.to_user_id === currentUser.id)
    ),
    [messages, currentUser.id, selectedUser.id]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      onSendMessage({
        type: "send-message",
        from_user_id: currentUser.id,
        from_username: currentUser.username,
        to_user_id: selectedUser.id,
        message: inputMessage.trim()
      });
      setInputMessage("");
      handleStopTyping();
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      onSendMessage({
        type: "typing",
        from_user_id: currentUser.id,
        from_username: currentUser.username,
        to_user_id: selectedUser.id
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      onSendMessage({
        type: "stop-typing",
        from_user_id: currentUser.id,
        to_user_id: selectedUser.id
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm h-screen lg:h-auto">
      {/* Chat Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500">
                  {selectedUser.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                {selectedUser.username}
              </h3>
              {typing[selectedUser.id] && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-blue-500"
                >
                  typing...
                </motion.p>
              )}
            </div>
          </div>

          {/* Call Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              data-testid="video-call-button"
              onClick={onStartCall}
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400"
            >
              <Video className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
        <AnimatePresence>
          {filteredMessages.map((msg, index) => {
            const isOwn = msg.from_user_id === currentUser.id;
            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex items-end space-x-2 max-w-[70%] ${
                  isOwn ? "flex-row-reverse space-x-reverse" : "flex-row"
                }`}>
                  {!isOwn && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-xs">
                        {msg.from_username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <div className={`px-4 py-2 rounded-2xl ${
                      isOwn
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                    }`}>
                      <p className="text-sm break-words" data-testid={`message-${index}`}>{msg.message}</p>
                    </div>
                    <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                      isOwn ? "text-right" : "text-left"
                    }`}>
                      {format(new Date(msg.timestamp), "HH:mm")}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 hidden sm:flex"
          >
            <Smile className="w-5 h-5 text-gray-500" />
          </Button>
          <Input
            data-testid="message-input"
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={handleInputChange}
            onBlur={handleStopTyping}
            className="flex-1 rounded-full border-2 px-4 py-2 sm:py-3 text-sm sm:text-base focus:border-blue-500 dark:bg-gray-700/50"
          />
          <Button
            data-testid="send-message-button"
            type="submit"
            disabled={!inputMessage.trim()}
            className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 flex-shrink-0"
            size="icon"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;