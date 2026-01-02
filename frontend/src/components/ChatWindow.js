import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, Phone, MoreVertical, Smile, Trash2, CheckCheck, Check, Paperclip, Image as ImageIcon, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const ChatWindow = ({ currentUser, selectedUser, messages, onSendMessage, typing, onStartCall, onDeleteMessage, onBack }) => {
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (selectedFile) {
      // Upload file first
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Send message with file
        onSendMessage({
          type: "send-message",
          from_user_id: currentUser.id,
          from_username: currentUser.username,
          to_user_id: selectedUser.id,
          message: inputMessage.trim() || `Sent ${response.data.file_type}`,
          file_url: response.data.file_url,
          file_type: response.data.file_type,
          file_name: response.data.file_name
        });
        
        setSelectedFile(null);
        setFilePreview(null);
      } catch (error) {
        console.error("File upload error:", error);
        alert("Failed to upload file");
      } finally {
        setUploading(false);
      }
    } else if (inputMessage.trim()) {
      // Send text message
      onSendMessage({
        type: "send-message",
        from_user_id: currentUser.id,
        from_username: currentUser.username,
        to_user_id: selectedUser.id,
        message: inputMessage.trim()
      });
    }
    
    setInputMessage("");
    handleStopTyping();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setFilePreview('video');
      } else {
        setFilePreview('file');
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            {/* Back Button - Mobile Only */}
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                size="icon"
                className="lg:hidden rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
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
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-1"
                >
                  <span className="text-xs text-blue-500 font-medium">typing</span>
                  <div className="flex space-x-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
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
                  <div className="group">
                    {msg.deleted ? (
                      <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 italic text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Message deleted</p>
                      </div>
                    ) : (
                      <div className={`rounded-2xl relative ${
                        isOwn
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                      }`}>
                        {/* File preview */}
                        {msg.file_url && msg.file_type === 'image' && (
                          <div className="mb-2 overflow-hidden rounded-lg">
                            <img 
                              src={`${BACKEND_URL}${msg.file_url}`} 
                              alt={msg.file_name || 'Image'} 
                              className="max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(`${BACKEND_URL}${msg.file_url}`, '_blank')}
                            />
                          </div>
                        )}
                        {msg.file_url && msg.file_type === 'video' && (
                          <div className="mb-2 overflow-hidden rounded-lg">
                            <video 
                              src={`${BACKEND_URL}${msg.file_url}`} 
                              controls 
                              className="max-w-full max-h-64 object-contain"
                            />
                          </div>
                        )}
                        {msg.file_url && msg.file_type === 'file' && (
                          <div className="mb-2 p-2 bg-white/20 dark:bg-black/20 rounded-lg">
                            <a 
                              href={`${BACKEND_URL}${msg.file_url}`} 
                              download={msg.file_name}
                              className="flex items-center space-x-2 hover:underline"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-sm">{msg.file_name || 'File'}</span>
                            </a>
                          </div>
                        )}
                        {msg.message && (
                          <p className="text-sm break-words px-4 py-2" data-testid={`message-${index}`}>{msg.message}</p>
                        )}
                        {isOwn && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteMessage(msg.id, selectedUser.id)}
                            className="opacity-0 group-hover:opacity-100 absolute -right-8 top-0 h-6 w-6 p-0 text-xs transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 ${
                      isOwn ? "justify-end" : "justify-start"
                    }`}>
                      {format(new Date(msg.timestamp), "HH:mm")}
                      {isOwn && msg.read && (
                        <CheckCheck className="w-3 h-3 text-blue-400" />
                      )}
                      {isOwn && !msg.read && (
                        <Check className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
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
        {/* File Preview */}
        {filePreview && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {filePreview === 'video' && <Video className="w-5 h-5 text-blue-500" />}
              {filePreview === 'file' && <Paperclip className="w-5 h-5 text-gray-500" />}
              {filePreview !== 'video' && filePreview !== 'file' && (
                <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                {selectedFile?.name}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearFile}
              className="h-6 w-6 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </Button>
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
            placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
            value={inputMessage}
            onChange={handleInputChange}
            onBlur={handleStopTyping}
            className="flex-1 rounded-full border-2 px-4 py-2 sm:py-3 text-sm sm:text-base focus:border-blue-500 dark:bg-gray-700/50"
          />
          <Button
            data-testid="send-message-button"
            type="submit"
            disabled={(!inputMessage.trim() && !selectedFile) || uploading}
            className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 flex-shrink-0"
            size="icon"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;