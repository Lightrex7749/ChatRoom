import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, Phone, MoreVertical, Smile, Trash2, CheckCheck, Check, Paperclip, Image as ImageIcon, X, ArrowLeft, Edit2, Camera, Reply, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import axios from "axios";

const getBackendUrl = () => {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';
  return `${protocol}${window.location.hostname}:8000`;
};

const BACKEND_URL = getBackendUrl();

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export const ChatWindow = ({ currentUser, selectedUser, messages, onSendMessage, typing, onStartCall, onDeleteMessage, onMarkAsRead, onBack }) => {
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // messageId
  const [editingMessage, setEditingMessage] = useState(null); // {id, text}
  const [replyingTo, setReplyingTo] = useState(null); // {id, text, username}
  const [imagePreviewModal, setImagePreviewModal] = useState(null); // file object
  const [imageCaption, setImageCaption] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Load message history when selected user changes
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/messages/${currentUser.id}/${selectedUser.id}`
        );
        console.log("Loaded message history:", response.data);
        setHistoryMessages(response.data);
      } catch (error) {
        console.error("Error loading message history:", error);
      }
    };
    
    if (selectedUser) {
      loadHistory();
    }
  }, [currentUser.id, selectedUser?.id]);

  // Memoize combined and filtered messages (history + realtime)
  const filteredMessages = useMemo(() => {
    const realtimeMessages = messages.filter(
      m => (m.from_user_id === currentUser.id && m.to_user_id === selectedUser.id) ||
           (m.from_user_id === selectedUser.id && m.to_user_id === currentUser.id)
    );
    
    // Combine history with realtime, remove duplicates by id
    const allMessages = [...historyMessages, ...realtimeMessages];
    const uniqueMessages = allMessages.reduce((acc, msg) => {
      if (!acc.find(m => m.id === msg.id)) {
        acc.push(msg);
      }
      return acc;
    }, []);
    
    // Sort by timestamp
    const sorted = uniqueMessages.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    return sorted;
  }, [historyMessages, messages, currentUser.id, selectedUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll on new messages, not when loading history
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (filteredMessages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      // New message arrived, scroll to bottom
      scrollToBottom();
    }
    prevMessageCountRef.current = filteredMessages.length;
  }, [filteredMessages]);

  // Initial scroll when chat opens
  useEffect(() => {
    if (selectedUser) {
      setTimeout(() => scrollToBottom(), 100);
      
      // Mark unread messages from selected user as read
      if (onMarkAsRead) {
        filteredMessages.forEach(msg => {
          if (!msg.read && msg.from_user_id === selectedUser.id) {
            onMarkAsRead(msg.id, msg.from_user_id);
          }
        });
      }
    }
  }, [selectedUser, filteredMessages, onMarkAsRead]);

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
          file_name: response.data.file_name,
          reply_to_id: replyingTo?.id,
          reply_to_text: replyingTo?.text,
          reply_to_username: replyingTo?.username
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
        message: inputMessage.trim(),
        reply_to_id: replyingTo?.id,
        reply_to_text: replyingTo?.text,
        reply_to_username: replyingTo?.username
      });
    }
    
    setInputMessage("");
    setReplyingTo(null);
    handleStopTyping();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show preview modal for images
      if (file.type.startsWith('image/')) {
        setImagePreviewModal(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        // For non-images, upload directly
        setSelectedFile(file);
        if (file.type.startsWith('video/')) {
          setFilePreview('video');
        } else {
          setFilePreview('file');
        }
      }
    }
  };

  const confirmImageUpload = async () => {
    if (!imagePreviewModal) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", imagePreviewModal);
      
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData);
      
      onSendMessage({
        type: "send-message",
        from_user_id: currentUser.id,
        from_username: currentUser.username,
        to_user_id: selectedUser.id,
        message: imageCaption || "",
        file_url: response.data.file_url,
        file_type: response.data.file_type,
        file_name: response.data.file_name,
        reply_to_id: replyingTo?.id,
        reply_to_text: replyingTo?.text,
        reply_to_username: replyingTo?.username
      });
      
      setImagePreviewModal(null);
      setImageCaption("");
      setFilePreview(null);
      setReplyingTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleReaction = (messageId, emoji) => {
    onSendMessage({
      type: "react-message",
      message_id: messageId,
      user_id: currentUser.id,
      to_user_id: selectedUser.id,
      emoji: emoji
    });
    setShowEmojiPicker(null);
  };

  const startEdit = (msg) => {
    setEditingMessage({ id: msg.id, text: msg.message });
    setReplyingTo(null);
  };

  const saveEdit = () => {
    if (!editingMessage || !editingMessage.text.trim()) return;
    
    onSendMessage({
      type: "edit-message",
      message_id: editingMessage.id,
      new_message: editingMessage.text,
      from_user_id: currentUser.id,
      to_user_id: selectedUser.id
    });
    
    setEditingMessage(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
  };

  const startReply = (msg) => {
    setReplyingTo({
      id: msg.id,
      text: msg.message,
      username: msg.from_username
    });
    setEditingMessage(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
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
    
    if (!isTyping && selectedUser) {
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
    if (isTyping && selectedUser) {
      setIsTyping(false);
      onSendMessage({
        type: "stop-typing",
        from_user_id: currentUser.id,
        to_user_id: selectedUser.id
      });
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Upload voice message
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", audioFile);
          
          const response = await axios.post(`${BACKEND_URL}/api/upload`, formData);
          
          onSendMessage({
            type: "send-message",
            from_user_id: currentUser.id,
            from_username: currentUser.username,
            to_user_id: selectedUser.id,
            message: "🎤 Voice message",
            file_url: response.data.file_url,
            file_type: "audio",
            file_name: response.data.file_name
          });
        } catch (error) {
          console.error("Voice upload error:", error);
          alert("Failed to send voice message");
        } finally {
          setUploading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const insertEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowInputEmojiPicker(false);
  };

  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🙏', '😍', '🤔', '👏', '✨', '💪', '🎊', '😎', '🥳'];

  return (
    <div className="flex flex-col bg-[#efeae2] dark:bg-[#0b141a] h-full w-full relative overflow-hidden">
      {/* WhatsApp-style background pattern */}
      <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23000000\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
        backgroundSize: '100px 100px'
      }} />
      {/* Chat Header */}
      <div className="p-3 sm:p-3.5 border-b border-gray-200 dark:border-gray-700 bg-[#f0f2f5] dark:bg-[#202c33] backdrop-blur-sm flex-shrink-0">
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
              <Avatar className="h-10 w-10 sm:h-11 sm:w-11 ring-2 ring-white/50 dark:ring-gray-700/50">
                {selectedUser.avatar_url && (
                  <AvatarImage 
                    src={`${BACKEND_URL}${selectedUser.avatar_url}`} 
                    alt={selectedUser.username} 
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-gradient-to-br from-[#008069] via-[#00a884] to-[#00bfa5] text-white font-bold">
                  {selectedUser.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">
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
              data-testid="phone-call-button"
              onClick={() => onStartCall(false)}
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-[#008069]/10 dark:hover:bg-[#008069]/20 text-[#008069] dark:text-[#00a884] transition-all duration-200"
              title="Voice call"
            >
              <Phone className="w-5 h-5" />
            </Button>
            <Button
              data-testid="video-call-button"
              onClick={() => onStartCall(true)}
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-[#008069]/10 dark:hover:bg-[#008069]/20 text-[#008069] dark:text-[#00a884] transition-all duration-200"
              title="Video call"
            >
              <Video className="w-5 h-5" />
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMenuDropdown(!showMenuDropdown)}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
              {showMenuDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50"
                >
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      // Add functionality here
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    View contact info
                  </button>
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      // Clear chat functionality
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Clear messages
                  </button>
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      // Mute notifications
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mute notifications
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" data-testid="messages-container" style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <div className="space-y-4">
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
                      {selectedUser.avatar_url && (
                        <AvatarImage 
                          src={`${BACKEND_URL}${selectedUser.avatar_url}`} 
                          alt={msg.from_username} 
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-xs">
                        {msg.from_username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="group relative">
                    {msg.type === 'call-log' ? (
                      // Call Log Message
                      <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        {msg.call_status === 'missed' ? (
                          <Phone className="w-4 h-4 text-red-500" />
                        ) : msg.call_status === 'rejected' ? (
                          <Phone className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Video className="w-4 h-4 text-green-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {msg.call_status === 'missed' ? '📞 Missed Call' : 
                             msg.call_status === 'rejected' ? '📞 Call Rejected' : 
                             msg.call_status === 'completed' ? '📞 Call Ended' :
                             '📞 Call'}
                          </p>
                          {msg.duration && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Duration: {Math.floor(msg.duration / 60)}:{(msg.duration % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : msg.deleted ? (
                      <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 italic text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Message deleted</p>
                      </div>
                    ) : (
                      <>
                        <div className={`rounded-2xl relative shadow-md hover:shadow-lg transition-shadow ${
                          isOwn
                            ? "bg-gradient-to-br from-[#d9fdd3] to-[#c3f3c0] dark:from-[#005c4b] dark:to-[#004d40] text-gray-900 dark:text-white rounded-br-sm"
                            : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700"
                        }`}>
                          {/* Reply preview */}
                          {msg.reply_to_id && (
                            <div className={`mx-2 mt-2 p-2 rounded border-l-4 ${
                              isOwn 
                                ? "bg-[#c3f3c0] dark:bg-[#004d40] border-[#008069]" 
                                : "bg-gray-100 dark:bg-[#1a2930] border-gray-400 dark:border-gray-600"
                            }`}>
                              <div className={`text-xs font-semibold mb-1 ${
                                isOwn ? "text-[#008069]" : "text-blue-600 dark:text-blue-400"
                              }`}>
                                {msg.reply_to_username}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {msg.reply_to_text}
                              </div>
                            </div>
                          )}
                          
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
                          {msg.file_url && msg.file_type === 'audio' && (
                            <div className="mb-2 p-2 bg-white/20 dark:bg-black/20 rounded-lg">
                              <audio 
                                src={`${BACKEND_URL}${msg.file_url}`} 
                                controls 
                                className="w-full max-w-xs"
                              />
                            </div>
                          )}
                          {msg.file_url && msg.file_type === 'file' && (
                            <div className="mb-2 p-2 bg-white/20 dark:bg-black/20 rounded-lg">
                              <a 
                                href={`${BACKEND_URL}${msg.file_url}`} 
                                download={msg.file_name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 hover:underline"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span className="text-sm">{msg.file_name || 'File'}</span>
                              </a>
                            </div>
                          )}
                          {msg.message && (
                            <p className="text-sm break-words px-4 py-2" data-testid={`message-${index}`}>
                              {msg.message}
                              {msg.edited_at && <span className="text-xs opacity-70 ml-2">(edited)</span>}
                            </p>
                          )}
                          
                          {/* Action buttons */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -right-28 top-0 flex gap-1 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startReply(msg)}
                              className="h-6 w-6 p-0"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                              className="h-6 w-6 p-0"
                              title="React"
                            >
                              <Smile className="w-4 h-4" />
                            </Button>
                            {isOwn && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEdit(msg)}
                                  className="h-6 w-6 p-0"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteMessage(msg.id, selectedUser.id)}
                                  className="h-6 w-6 p-0"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                                  userIds.includes(currentUser.id)
                                    ? 'bg-blue-100 dark:bg-blue-900 border border-blue-500'
                                    : 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-gray-600 dark:text-gray-400">{userIds.length}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === msg.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex gap-1 mt-1"
                          >
                            {REACTION_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="text-2xl hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </>
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

        {/* Typing Indicator */}
        {typing && typing[selectedUser?.id] && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex justify-start mt-4"
          >
            <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-gray-200 dark:bg-gray-700">
              <div className="flex space-x-1">
                <motion.div
                  className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{selectedUser?.username} is typing...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-2 sm:p-3 bg-[#f0f2f5] dark:bg-[#202c33] flex-shrink-0">
        {/* Replying Mode */}
        {replyingTo && (
          <div className="mb-2 p-2 bg-white dark:bg-[#2a3942] rounded-lg border-l-4 border-[#008069]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Reply className="w-3.5 h-3.5 text-[#008069]" />
                  <span className="text-xs font-semibold text-[#008069]">
                    {replyingTo.username}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {replyingTo.text}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelReply}
                className="h-6 w-6 p-0 ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Editing Mode */}
        {editingMessage && (
          <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Edit2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Editing message</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              className="h-6 text-xs"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* File Preview (for non-image files) */}
        {filePreview && !imagePreviewModal && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {filePreview === 'video' && <Video className="w-5 h-5 text-blue-500" />}
              {filePreview === 'file' && <Paperclip className="w-5 h-5 text-gray-500" />}
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
        
        <form onSubmit={editingMessage ? (e) => { e.preventDefault(); saveEdit(); } : handleSend} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!editingMessage && !isRecording && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => photoInputRef.current?.click()}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                title="Quick photo"
              >
                <Camera className="w-5 h-5 text-gray-500" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5 text-gray-500" />
              </Button>
            </>
          )}
          
          {isRecording ? (
            <>
              <div className="flex-1 flex items-center space-x-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-full">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-3 h-3 bg-red-500 rounded-full"
                />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <Button
                type="button"
                onClick={stopRecording}
                className="rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11"
                size="icon"
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
              </Button>
            </>
          ) : (
            <>
              <Input
                data-testid="message-input"
                type="text"
                placeholder={editingMessage ? "Edit message..." : selectedFile ? "Add a caption..." : "Type a message..."}
                value={editingMessage ? editingMessage.text : inputMessage}
                onChange={(e) => editingMessage ? setEditingMessage({...editingMessage, text: e.target.value}) : handleInputChange(e)}
                onBlur={!editingMessage ? handleStopTyping : undefined}
                className="flex-1 rounded-full border-2 px-4 py-2 sm:py-3 text-sm sm:text-base focus:border-blue-500 dark:bg-gray-700/50"
              />
              {!editingMessage && !inputMessage.trim() && !selectedFile ? (
                <Button
                  type="button"
                  onClick={startRecording}
                  className="rounded-full bg-[#008069] hover:bg-[#017561] text-white shadow-md hover:shadow-lg transition-all duration-200 flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11"
                  size="icon"
                  title="Record voice message"
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              ) : (
                <Button
                  data-testid="send-message-button"
                  type="submit"
                  disabled={editingMessage ? !editingMessage.text.trim() : ((!inputMessage.trim() && !selectedFile) || uploading)}
                  className="rounded-full bg-[#008069] hover:bg-[#017561] text-white shadow-md hover:shadow-lg transition-all duration-200 flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11"
                  size="icon"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : editingMessage ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
              )}
            </>
          )}
        </form>
      </div>

      {/* Image Preview Modal */}
      {imagePreviewModal && filePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Send Image</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setImagePreviewModal(null);
                  setFilePreview(null);
                  setImageCaption("");
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <img
                src={filePreview}
                alt="Preview"
                className="w-full h-auto max-h-96 object-contain rounded-lg"
              />
              <Input
                type="text"
                placeholder="Add a caption..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                className="mt-4"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImagePreviewModal(null);
                  setFilePreview(null);
                  setImageCaption("");
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmImageUpload}
                disabled={uploading}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;