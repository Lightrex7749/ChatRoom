import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import "@/App.css";
import JoinScreen from "@/components/JoinScreen";
import ChatScreen from "@/components/ChatScreen";
import { ThemeProvider } from "@/contexts/ThemeContext";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem("connecthub_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleJoin = (userData) => {
    // userData comes from backend with id, username, etc.
    const newUser = {
      ...userData,
      friends: [], // Initialize empty friends list locally if needed, though backend manages it
      status: "online"
    };
    setUser(newUser);
    localStorage.setItem("connecthub_user", JSON.stringify(newUser));
  };

  const handleLeave = () => {
    setUser(null);
    localStorage.removeItem("connecthub_user");
  };

  return (
    <ThemeProvider>
      <div className="App min-h-screen">
        {!user ? (
          <JoinScreen onJoin={handleJoin} />
        ) : (
          <ChatScreen user={user} onLeave={handleLeave} />
        )}
        <Toaster position="top-right" richColors />
      </div>
    </ThemeProvider>
  );
}

export default App;