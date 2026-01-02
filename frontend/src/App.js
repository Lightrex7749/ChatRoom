import { useState, useEffect } from "react";
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

  const handleJoin = (username) => {
    const newUser = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      username: username,
      friends: [],
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
      </div>
    </ThemeProvider>
  );
}

export default App;