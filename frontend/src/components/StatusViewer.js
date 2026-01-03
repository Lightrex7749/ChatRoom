import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const StatusViewer = ({ user }) => {
  const [statuses, setStatuses] = useState([]);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [statusContent, setStatusContent] = useState("");
  const [statusFile, setStatusFile] = useState(null);
  const [statusPreview, setStatusPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadStatuses();
      const interval = setInterval(loadStatuses, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadStatuses = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/statuses/${user.id}`);
      // Group statuses by user
      const grouped = response.data.reduce((acc, status) => {
        if (!acc[status.user_id]) {
          acc[status.user_id] = {
            user_id: status.user_id,
            username: status.username,
            statuses: []
          };
        }
        acc[status.user_id].statuses.push(status);
        return acc;
      }, {});
      setStatuses(Object.values(grouped));
    } catch (error) {
      console.error("Error loading statuses:", error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStatusFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setStatusPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadStatus = async () => {
    if (!statusContent && !statusFile) {
      toast.error("Please add text or media");
      return;
    }

    setUploading(true);
    try {
      let media_url = null;
      let media_type = null;

      if (statusFile) {
        const formData = new FormData();
        formData.append("file", statusFile);
        const uploadResponse = await axios.post(`${BACKEND_URL}/api/upload`, formData);
        media_url = uploadResponse.data.file_url;
        media_type = uploadResponse.data.file_type;
      }

      await axios.post(`${BACKEND_URL}/api/statuses`, {
        user_id: user.id,
        username: user.username,
        content: statusContent,
        media_url,
        media_type
      });

      toast.success("Status posted!");
      setShowUploadModal(false);
      setStatusContent("");
      setStatusFile(null);
      setStatusPreview(null);
      loadStatuses();
    } catch (error) {
      console.error("Error uploading status:", error);
      toast.error("Failed to upload status");
    } finally {
      setUploading(false);
    }
  };

  const viewStatus = async (statusGroup, index = 0) => {
    setViewingStatus(statusGroup);
    setCurrentStatusIndex(index);

    // Mark as viewed
    try {
      await axios.post(`${BACKEND_URL}/api/statuses/${statusGroup.statuses[index].id}/view`, {
        user_id: user.id
      });
    } catch (error) {
      console.error("Error marking status as viewed:", error);
    }
  };

  const nextStatus = () => {
    if (!viewingStatus) return;
    
    if (currentStatusIndex < viewingStatus.statuses.length - 1) {
      const newIndex = currentStatusIndex + 1;
      setCurrentStatusIndex(newIndex);
      viewStatus(viewingStatus, newIndex);
    } else {
      // Move to next user's status
      const currentUserIndex = statuses.findIndex(s => s.user_id === viewingStatus.user_id);
      if (currentUserIndex < statuses.length - 1) {
        viewStatus(statuses[currentUserIndex + 1], 0);
      } else {
        setViewingStatus(null);
      }
    }
  };

  const previousStatus = () => {
    if (!viewingStatus) return;
    
    if (currentStatusIndex > 0) {
      const newIndex = currentStatusIndex - 1;
      setCurrentStatusIndex(newIndex);
      viewStatus(viewingStatus, newIndex);
    } else {
      // Move to previous user's status
      const currentUserIndex = statuses.findIndex(s => s.user_id === viewingStatus.user_id);
      if (currentUserIndex > 0) {
        viewStatus(statuses[currentUserIndex - 1], statuses[currentUserIndex - 1].statuses.length - 1);
      }
    }
  };

  const currentStatus = viewingStatus?.statuses[currentStatusIndex];

  return (
    <div className="p-4">
      {/* Status List */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {/* Add Status Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex-shrink-0 flex flex-col items-center gap-2"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Plus className="w-8 h-8" />
          </div>
          <span className="text-xs font-medium">Your Status</span>
        </button>

        {/* Friend Statuses */}
        {statuses.map((statusGroup) => {
          const hasViewed = statusGroup.statuses.every(s => s.views.includes(user.id));
          return (
            <button
              key={statusGroup.user_id}
              onClick={() => viewStatus(statusGroup)}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div className={`w-16 h-16 rounded-full p-0.5 ${hasViewed ? 'bg-gray-300' : 'bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500'}`}>
                <Avatar className="w-full h-full border-4 border-white dark:border-gray-900">
                  <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white">
                    {statusGroup.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs font-medium truncate max-w-[64px]">{statusGroup.username}</span>
            </button>
          );
        })}
      </div>

      {/* Status Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Create Status</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowUploadModal(false);
                  setStatusContent("");
                  setStatusFile(null);
                  setStatusPreview(null);
                }}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <Input
                type="text"
                placeholder="What's on your mind?"
                value={statusContent}
                onChange={(e) => setStatusContent(e.target.value)}
              />
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="status-file"
              />
              <label
                htmlFor="status-file"
                className="block w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                {statusPreview ? (
                  <img src={statusPreview} alt="Preview" className="w-full h-48 object-cover rounded" />
                ) : (
                  <div>
                    <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Add photo or video</span>
                  </div>
                )}
              </label>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button
                onClick={uploadStatus}
                disabled={uploading || (!statusContent && !statusFile)}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
              >
                {uploading ? "Posting..." : "Post Status"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Status Viewer */}
      {viewingStatus && currentStatus && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* Progress bars */}
          <div className="absolute top-4 left-4 right-4 flex gap-1">
            {viewingStatus.statuses.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: index < currentStatusIndex ? "100%" : "0%" }}
                  animate={{ width: index === currentStatusIndex ? "100%" : index < currentStatusIndex ? "100%" : "0%" }}
                  transition={{ duration: index === currentStatusIndex ? 5 : 0 }}
                  onAnimationComplete={() => {
                    if (index === currentStatusIndex) nextStatus();
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-8 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white">
                  {viewingStatus.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{viewingStatus.username}</div>
                <div className="text-xs opacity-80">
                  {new Date(currentStatus.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingStatus(null)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Content */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            onClick={(e) => {
              const clickX = e.clientX;
              const screenWidth = window.innerWidth;
              if (clickX < screenWidth / 2) {
                previousStatus();
              } else {
                nextStatus();
              }
            }}
          >
            {currentStatus.media_url ? (
              currentStatus.media_type === "image" ? (
                <img
                  src={`${BACKEND_URL}${currentStatus.media_url}`}
                  alt="Status"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <video
                  src={`${BACKEND_URL}${currentStatus.media_url}`}
                  controls
                  autoPlay
                  className="max-w-full max-h-full object-contain"
                />
              )
            ) : (
              <div className="text-white text-2xl font-bold text-center px-8">
                {currentStatus.content}
              </div>
            )}
          </div>

          {/* Footer */}
          {currentStatus.content && currentStatus.media_url && (
            <div className="absolute bottom-8 left-4 right-4 text-white text-center">
              <p className="text-lg">{currentStatus.content}</p>
            </div>
          )}

          {/* View count */}
          <div className="absolute bottom-4 left-4 text-white flex items-center gap-2 opacity-80">
            <Eye className="w-4 h-4" />
            <span className="text-sm">{currentStatus.views.length} views</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusViewer;
