import { useState, useEffect, useRef, useCallback } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export const useWebSocket = (user) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const messageHandlersRef = useRef({});

  const connect = useCallback(() => {
    if (!user) return;

    try {
      const ws = new WebSocket(`${WS_URL}/api/ws/${user.id}/${encodeURIComponent(user.username)}`);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
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
                from_username: data.from_username
              });
              break;
              
            default:
              // Pass to WebRTC handler
              if (messageHandlersRef.current[data.type]) {
                messageHandlersRef.current[data.type](data);
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
        console.log("WebSocket disconnected");
        setIsConnected(false);
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
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