import { useState, useEffect, useRef, useCallback } from "react";

const getBackendUrl = () => {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  // Dynamic fallback: use current hostname with port 8000
  const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';
  return `${protocol}${window.location.hostname}:8000`;
};

const BACKEND_URL = getBackendUrl();
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Exponential backoff for reconnection
const getReconnectDelay = (attemptCount) => {
  const maxDelay = 30000; // Max 30 seconds
  const delay = Math.min(1000 * Math.pow(2, attemptCount), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
};

export const useWebSocket = (user) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const messageHandlersRef = useRef({});
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!user) return;

    try {
      const ws = new WebSocket(`${WS_URL}/api/ws/${user.id}/${encodeURIComponent(user.username)}`);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on success
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "users-update":
              setUsers(data.users);
              break;
              
            case "receive-message":
              setMessages(prev => [...prev, data.message]);
              break;
              
            case "typing":
              setTyping(prev => ({ ...prev, [data.from_user_id]: true }));
              break;
              
            case "stop-typing":
              setTyping(prev => {
                const newTyping = { ...prev };
                delete newTyping[data.from_user_id];
                return newTyping;
              });
              break;
              
            case "message-read":
              setMessages(prev => 
                prev.map(m => 
                  m.id === data.message_id ? { ...m, read: true } : m
                )
              );
              break;
              
            case "delete-message":
              setMessages(prev => 
                prev.map(m => 
                  m.id === data.message_id ? { ...m, deleted: true } : m
                )
              );
              break;

            case "edit-message":
              setMessages(prev => 
                prev.map(m => 
                  m.id === data.message_id ? { ...m, message: data.new_message, edited_at: data.edited_at } : m
                )
              );
              break;

            case "message-reaction":
              setMessages(prev => 
                prev.map(m => 
                  m.id === data.message_id ? { ...m, reactions: data.reactions } : m
                )
              );
              break;
              
            case "incoming-call":
              setIncomingCall({
                from_user_id: data.from_user_id,
                from_username: data.from_username,
                video_enabled: data.video_enabled !== false
              });
              break;

            case "call-ended":
              // Handle call-ended directly to ensure it always works
              let callEndedHandled = false;
              
              // Try handler first
              if (window.webrtcHandlers && window.webrtcHandlers["call-ended"]) {
                window.webrtcHandlers["call-ended"](data);
                callEndedHandled = true;
              } else if (messageHandlersRef.current["call-ended"]) {
                messageHandlersRef.current["call-ended"](data);
                callEndedHandled = true;
              }
              
              // Emergency fallback: if handler wasn't found/called, directly invoke endCall
              if (!callEndedHandled) {
                if (window.webrtcEndCall) {
                  window.webrtcEndCall(true); // true = skipNotify, don't send message back
                } else {
                  console.error("[WEBSOCKET-CALL-ENDED] CRITICAL: No handler and no window.webrtcEndCall!");
                }
              }
              break;
              
            default:
              // Pass to WebRTC handler
              const handler = messageHandlersRef.current[data.type] || (window.webrtcHandlers && window.webrtcHandlers[data.type]);
              
              if (handler) {
                handler(data);
              }
              break;
          }
        } catch (error) {
          // Silent fail for non-critical parsing errors
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        setIsConnected(false);
        
        // Exponential backoff reconnection
        const delay = getReconnectDelay(reconnectAttemptsRef.current);
        console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }, [user]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Sync handlers from window.webrtcHandlers periodically
  useEffect(() => {
    const syncHandlers = () => {
      if (window.webrtcHandlers) {
        messageHandlersRef.current = { ...window.webrtcHandlers };
      }
    };

    // Sync immediately and every 500ms
    syncHandlers();
    const interval = setInterval(syncHandlers, 500);

    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const registerMessageHandler = useCallback((type, handler) => {
    messageHandlersRef.current[type] = handler;
  }, []);

  const acceptCall = useCallback((fromUserId) => {
    sendMessage({
      type: "accept-call",
      from_user_id: user.id,
      to_user_id: fromUserId
    });
    setIncomingCall(null);
  }, [sendMessage, user]);

  const rejectCall = useCallback((fromUserId) => {
    sendMessage({
      type: "reject-call",
      from_user_id: user.id,
      from_username: user.username,
      to_user_id: fromUserId
    });
    setIncomingCall(null);
  }, [sendMessage, user]);

  const deleteMessage = useCallback((messageId, toUserId) => {
    sendMessage({
      type: "delete-message",
      message_id: messageId,
      from_user_id: user.id,
      to_user_id: toUserId
    });
  }, [sendMessage, user]);

  const markAsRead = useCallback((messageId, fromUserId) => {
    sendMessage({
      type: "message-read",
      message_id: messageId,
      from_user_id: user.id,
      to_user_id: fromUserId
    });
  }, [sendMessage, user]);

  return {
    isConnected,
    users,
    messages,
    typing,
    incomingCall,
    sendMessage,
    registerMessageHandler,
    acceptCall,
    rejectCall,
    deleteMessage,
    markAsRead
  };
};