import { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import "../styles/player.css";

// Types for our podcast data
type Podcast = {
  id: string;
  title: string;
  format: "debate" | "podcast" | "duck";
  createdAt: string;
  duration: number; // in seconds
  audioUrl: string;
  cover_url?: string; // URL to the album cover image
  listened?: boolean; // Whether the podcast has been listened to
};

export function meta() {
  return [
    { title: "My Podcasts | Claude Yap" },
    {
      name: "description",
      content: "View and manage your AI-generated podcasts",
    },
  ];
}

export default function Dashboard() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [podcastToRename, setPodcastToRename] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameMessage, setRenameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isTogglingListened, setIsTogglingListened] = useState(false);
  const [listenedMessage, setListenedMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showVideoConfirmation, setShowVideoConfirmation] = useState(false);
  const [podcastForVideo, setPodcastForVideo] = useState<Podcast | null>(null);

  // Skip forward/backward functions
  const skipForward = () => {
    if (audioElement) {
      const newTime = Math.min(audioElement.duration, audioElement.currentTime + 10);
      audioElement.currentTime = newTime;
    }
  };

  const skipBackward = () => {
    if (audioElement) {
      const newTime = Math.max(0, audioElement.currentTime - 10);
      audioElement.currentTime = newTime;
    }
  };

  // Add keyboard shortcuts for player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if we have a podcast playing
      if (!currentlyPlaying) return;
      
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case " ": // Space bar
          e.preventDefault();
          if (audioElement) {
            if (audioElement.paused) {
              audioElement.play();
            } else {
              audioElement.pause();
              setCurrentlyPlaying(null);
            }
          }
          break;
        case "ArrowLeft": // Left arrow
          e.preventDefault();
          skipBackward();
          break;
        case "ArrowRight": // Right arrow
          e.preventDefault();
          skipForward();
          break;
        case "m": // Mute toggle
        case "M": // Mute toggle (capital M)
          if (audioElement) {
            if (volume > 0) {
              setVolume(0);
              audioElement.volume = 0;
            } else {
              setVolume(1);
              audioElement.volume = 1;
            }
          }
          break;
        // Number keys for playback speed
        case "1":
          handlePlaybackRateChange(0.5);
          break;
        case "2":
          handlePlaybackRateChange(0.75);
          break;
        case "3":
          handlePlaybackRateChange(1);
          break;
        case "4":
          handlePlaybackRateChange(1.25);
          break;
        case "5":
          handlePlaybackRateChange(1.5);
          break;
        case "6":
          handlePlaybackRateChange(2);
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentlyPlaying, audioElement, volume]);

  // Fetch podcasts from the server
  useEffect(() => {
    const fetchPodcasts = async () => {
      try {
        setIsLoading(true);

        // Fetch podcasts from the backend API
        const response = await fetch("http://localhost:5111/api/podcasts");
        if (!response.ok) {
          throw new Error(
            `Failed to fetch podcasts: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        setPodcasts(data.podcasts || []);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching podcasts:", err);
        setError("Failed to load podcasts. Please try again later.");
        setIsLoading(false);
      }
    };

    fetchPodcasts();

    // Cleanup function for audio
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, []);

  // Handle playing/pausing podcasts - now just sets up the player without playing audio directly
  const togglePlayPause = (podcast: Podcast) => {
    // Check if audio URL is valid
    let audioUrl = podcast.audioUrl;
    if (audioUrl && !audioUrl.startsWith("http") && audioUrl !== "#") {
      audioUrl = `http://localhost:5111${audioUrl}`;
    }

    if (!audioUrl || audioUrl === "#") {
      setError(
        "This podcast doesn't have an audio file yet. Please generate audio first."
      );
      return;
    }

    // If we're already playing this podcast, just stop it
    if (currentlyPlaying === podcast.id) {
      if (audioElement) {
        audioElement.pause();
      }
      setCurrentlyPlaying(null);
      setCurrentTime(0);
    } else {
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
      }
      
      // Just set the current podcast - the AudioPlayer component will handle playback
      setCurrentlyPlaying(podcast.id);
    }
  };

  // Format podcast duration (seconds to mm:ss)
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Format time for player display (adds hours if needed)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle seeking in the audio
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioElement) {
      audioElement.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioElement) {
      audioElement.volume = newVolume;
    }
  };

  // Handle playback rate change
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioElement) {
      audioElement.playbackRate = rate;
    }
  };

  // Get currently playing podcast
  const getCurrentPodcast = (): Podcast | undefined => {
    return podcasts.find(podcast => podcast.id === currentlyPlaying);
  };

  // Format creation date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Delete podcast function
  const deletePodcast = async (podcastId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this podcast? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteMessage(null);

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5111/api/podcasts/${podcastId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Remove the podcast from the state
        setPodcasts(podcasts.filter((podcast) => podcast.id !== podcastId));
        setDeleteMessage({
          type: "success",
          text: "Podcast deleted successfully",
        });

        // If this podcast was playing, stop it
        if (currentlyPlaying === podcastId && audioElement) {
          audioElement.pause();
          setCurrentlyPlaying(null);
        }
      } else {
        const errorData = await response.json();
        setDeleteMessage({
          type: "error",
          text: errorData.error || "Failed to delete podcast",
        });
      }
    } catch (error) {
      setDeleteMessage({
        type: "error",
        text: "An error occurred while deleting the podcast",
      });
      console.error("Error deleting podcast:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open rename modal
  const openRenameModal = (podcastId: string, currentTitle: string) => {
    setPodcastToRename(podcastId);
    setNewTitle(currentTitle);
    setIsRenaming(true);
    setRenameMessage(null);
  };

  // Close rename modal
  const closeRenameModal = () => {
    setPodcastToRename(null);
    setNewTitle("");
    setIsRenaming(false);
  };

  // Rename podcast function
  const renamePodcast = async () => {
    if (!podcastToRename || !newTitle.trim()) {
      setRenameMessage({
        type: "error",
        text: "Please enter a valid title",
      });
      return;
    }

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5111/api/podcasts/${podcastToRename}/title`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: newTitle }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the podcast in the state
        setPodcasts(
          podcasts.map((podcast) =>
            podcast.id === podcastToRename
              ? { ...podcast, title: newTitle }
              : podcast
          )
        );

        setRenameMessage({
          type: "success",
          text: "Podcast renamed successfully",
        });

        // Close the modal after a short delay
        setTimeout(() => {
          closeRenameModal();
          setRenameMessage(null);
        }, 1500);
      } else {
        const errorData = await response.json();
        setRenameMessage({
          type: "error",
          text: errorData.error || "Failed to rename podcast",
        });
      }
    } catch (error) {
      setRenameMessage({
        type: "error",
        text: "An error occurred while renaming the podcast",
      });
      console.error("Error renaming podcast:", error);
    }
  };

  // Toggle podcast listened status
  const toggleListened = async (podcastId: string) => {
    setIsTogglingListened(true);
    setListenedMessage(null);

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5111/api/podcasts/${podcastId}/listened`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const updatedPodcast = data.podcast;

        // Update the podcast in the state
        setPodcasts(
          podcasts.map((podcast) =>
            podcast.id === podcastId
              ? { ...podcast, listened: updatedPodcast.listened }
              : podcast
          )
        );

        setListenedMessage({
          type: "success",
          text: `Podcast marked as ${
            updatedPodcast.listened ? "listened" : "unlistened"
          }`,
        });

        // Clear message after a short delay
        setTimeout(() => {
          setListenedMessage(null);
        }, 2000);
      } else {
        const errorData = await response.json();
        setListenedMessage({
          type: "error",
          text: errorData.error || "Failed to update listened status",
        });
      }
    } catch (error) {
      setListenedMessage({
        type: "error",
        text: "An error occurred while updating listened status",
      });
      console.error("Error updating listened status:", error);
    } finally {
      setIsTogglingListened(false);
    }
  };

  // Open video conference confirmation modal
  const openVideoConfirmation = (podcast: Podcast) => {
    setPodcastForVideo(podcast);
    setShowVideoConfirmation(true);
  };

  // Close video conference confirmation modal
  const closeVideoConfirmation = () => {
    setShowVideoConfirmation(false);
    setPodcastForVideo(null);
  };

  // Join video conference
  const joinVideoConference = async () => {
    try {
      // Start a conversation with the replica API
      if (podcastForVideo) {
        try {
          // Get token from localStorage
          const token = localStorage.getItem("token");

          const response = await fetch(
            "http://localhost:5111/api/conversations",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ podcast_id: podcastForVideo.id }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to start conversation with replica");
          }

          const data = await response.json();

          if (data.success && data.conversation_url) {
            // Open the conversation URL in a new tab
            console.log(data.conversation_url);
            window.open(data.conversation_url, "_blank");
            setShowVideoConfirmation(false);
          } else {
            throw new Error("Invalid response from replica service");
          }
        } catch (error) {
          console.error("Error starting conversation:", error);
          setError(
            "Failed to start conversation with the audio replica. Please try again."
          );
        }
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError(
        "Please allow access to camera and microphone to join the video conference."
      );
    }
  };

  // Get icon for podcast format
  const getFormatIcon = (format: "debate" | "podcast" | "duck") => {
    switch (format) {
      case "debate":
        return "🎭";
      case "podcast":
        return "🎙️";
      case "duck":
        return "🦆";
      default:
        return "🎧";
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center">
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 10 }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                  className="text-3xl"
                >
                  🎧
                </motion.div>
                <h1 className="text-2xl font-bold ml-2">Claude Yap</h1>
              </Link>
            </div>
            <Link
              to="/create"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 transition rounded-lg text-sm font-medium"
            >
              Create New Podcast
            </Link>
          </div>
          <h2 className="text-3xl font-bold mt-6 mb-2">My Podcasts</h2>
          <p className="text-indigo-100">
            Manage and listen to your AI-generated podcasts
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Status messages */}
        {(deleteMessage || listenedMessage) && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              deleteMessage?.type === "success" ||
              listenedMessage?.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            }`}
          >
            <div className="flex items-center">
              <span className="mr-2">
                {deleteMessage?.type === "success" ||
                listenedMessage?.type === "success"
                  ? "✓"
                  : "⚠️"}
              </span>
              <p>{deleteMessage?.text || listenedMessage?.text}</p>
              <button
                onClick={() => {
                  setDeleteMessage(null);
                  setListenedMessage(null);
                }}
                className="ml-auto text-sm font-medium"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium underline"
            >
              Try Again
            </button>
          </div>
        ) : podcasts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎙️</div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No podcasts yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You haven't created any podcasts yet.
            </p>
            <Link
              to="/create"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
            >
              Create Your First Podcast
            </Link>
          </div>
        ) : (
          <>
            {/* Dashboard stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                <div className="text-3xl text-indigo-500 mb-2">🎧</div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  {podcasts.length}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Total Podcasts
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                <div className="text-3xl text-indigo-500 mb-2">⏱️</div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  {formatDuration(
                    podcasts.reduce((acc, podcast) => acc + podcast.duration, 0)
                  )}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Total Duration
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                <div className="text-3xl text-indigo-500 mb-2">📅</div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                  {formatDate(podcasts[0].createdAt)}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Latest Podcast
                </p>
              </div>
            </div>

            {/* Podcasts list */}
            <div className="grid grid-cols-1 gap-6">
              {podcasts.map((podcast) => (
                <motion.div
                  key={podcast.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`podcast-card flex flex-col sm:flex-row bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 ${
                    podcast.listened ? "opacity-75 dark:opacity-60" : ""
                  }`}
                >
                  {/* Left part (album art / podcast type) */}
                  <div className="w-full sm:w-48 h-48 relative overflow-hidden">
                    {podcast.cover_url ? (
                      <img
                        src={`http://localhost:5111${podcast.cover_url}`}
                        alt={`Cover art for ${podcast.title}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                        <div className="text-7xl">
                          {getFormatIcon(podcast.format)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right part (details) */}
                  <div className="flex-1 p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {podcast.title}
                    </h3>
                    
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div className="flex items-center mb-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Created on {formatDate(podcast.createdAt)}
                      </div>
                      <div className="flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {formatDuration(podcast.duration)}
                      </div>
                    </div>

                    {/* Mini progress indicator (only for currently playing podcast) */}
                    {currentlyPlaying === podcast.id && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1 mb-3">
                        <div 
                          className="bg-indigo-600 h-1" 
                          style={{ width: `${(currentTime / (duration || podcast.duration)) * 100}%` }}
                        ></div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center">
                        <button
                          onClick={() => togglePlayPause(podcast)}
                          className="podcast-control-btn"
                          aria-label={
                            currentlyPlaying === podcast.id ? "Pause" : "Play"
                          }
                        >
                          {currentlyPlaying === podcast.id ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </button>

                        <a
                          href={`http://localhost:5111${podcast.audioUrl}`}
                          download
                          className="podcast-control-btn-sm ml-2 flex items-center justify-center"
                          aria-label="Download"
                          target="_blank"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRenameModal(podcast.id, podcast.title);
                          }}
                          disabled={isDeleting || isRenaming}
                          className="podcast-control-btn-sm ml-2 flex items-center justify-center text-indigo-500 hover:text-indigo-700 transition-colors"
                          aria-label="Rename podcast"
                          title="Rename podcast"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleListened(podcast.id);
                          }}
                          disabled={isTogglingListened}
                          className={`podcast-control-btn-sm ml-2 flex items-center justify-center ${
                            podcast.listened
                              ? "text-gray-400 hover:text-gray-600"
                              : "text-green-500 hover:text-green-700"
                          } transition-colors`}
                          aria-label={
                            podcast.listened
                              ? "Mark as unlistened"
                              : "Mark as listened"
                          }
                          title={
                            podcast.listened
                              ? "Mark as unlistened"
                              : "Mark as listened"
                          }
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>

                        <button
                          onClick={() => openVideoConfirmation(podcast)}
                          className="podcast-control-btn ml-2"
                          aria-label="Video Chat"
                          title="Join video chat about this podcast"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center">
                        <span className="mr-2">
                          {getFormatIcon(podcast.format)}
                        </span>
                        {podcast.format === "debate"
                          ? "Debate Style"
                          : podcast.format === "podcast"
                          ? "Podcast Style"
                          : "Duck Mode"}

                        <button
                          onClick={() => deletePodcast(podcast.id)}
                          disabled={isDeleting}
                          className="podcast-control-btn-sm ml-4 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Delete podcast"
                          title="Delete podcast"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rename Podcast
              </h3>
              <button
                onClick={closeRenameModal}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {renameMessage && (
              <div
                className={`mb-4 p-3 rounded-md ${
                  renameMessage.type === "success"
                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                }`}
              >
                <p>{renameMessage.text}</p>
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="new-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                New Title
              </label>
              <input
                type="text"
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter new title"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeRenameModal}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={renamePodcast}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Player Bar */}
      {currentlyPlaying && getCurrentPodcast() && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
          <div className="container mx-auto max-w-6xl px-4 py-2">
            <div className="flex items-center">
              {/* Podcast info */}
              <div className="flex items-center mr-4 w-64 shrink-0">
                {getCurrentPodcast()?.cover_url ? (
                  <img 
                    src={`http://localhost:5111${getCurrentPodcast()?.cover_url}`}
                    alt="Cover art" 
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white rounded">
                    <div className="text-xl">
                      {getFormatIcon(getCurrentPodcast()?.format || "podcast")}
                    </div>
                  </div>
                )}
                <div className="ml-3 truncate">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {getCurrentPodcast()?.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(currentTime)} / {formatTime(duration || getCurrentPodcast()?.duration || 0)}
                  </div>
                </div>
              </div>
              
              {/* Professional Audio Player */}
              <div className="flex-1">
                <AudioPlayer
                  ref={(player) => {
                    if (player) {
                      setAudioElement(player.audio.current);
                    }
                  }}
                  src={getCurrentPodcast()?.audioUrl?.startsWith('http') 
                    ? getCurrentPodcast()?.audioUrl 
                    : `http://localhost:5111${getCurrentPodcast()?.audioUrl}`}
                  autoPlay
                  showSkipControls
                  showJumpControls
                  showFilledVolume
                  customAdditionalControls={[
                    <div key="playback-rate" className="relative">
                      <button 
                        onClick={() => setIsPlayerExpanded(!isPlayerExpanded)}
                        className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                      >
                        {playbackRate}x
                      </button>
                      
                      {isPlayerExpanded && (
                        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 w-32 z-10">
                          <div className="flex flex-col space-y-2">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                              <button
                                key={rate}
                                onClick={() => {
                                  handlePlaybackRateChange(rate);
                                  setIsPlayerExpanded(false);
                                }}
                                className={`text-sm py-1 px-2 rounded ${
                                  playbackRate === rate
                                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>,
                    <button 
                      key="mark-listened"
                      onClick={() => toggleListened(getCurrentPodcast()!.id)}
                      disabled={isTogglingListened}
                      className={`ml-2 p-1 rounded-full ${
                        getCurrentPodcast()?.listened
                          ? "text-gray-400 hover:text-gray-600"
                          : "text-green-500 hover:text-green-700"
                      } transition-colors`}
                      aria-label={getCurrentPodcast()?.listened ? "Mark as unlistened" : "Mark as listened"}
                      title={getCurrentPodcast()?.listened ? "Mark as unlistened" : "Mark as listened"}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  ]}
                  onPlay={() => {
                    // Update our state to match the library's state
                    setCurrentlyPlaying(getCurrentPodcast()!.id);
                  }}
                  onPause={() => {
                    // We'll keep the currentlyPlaying state so the player stays visible
                  }}
                  onEnded={() => {
                    setCurrentlyPlaying(null);
                    setCurrentTime(0);
                  }}
                  onListen={(e) => {
                    if (e.target) {
                      setCurrentTime((e.target as HTMLAudioElement).currentTime);
                    }
                  }}
                  onLoadedMetaData={(e) => {
                    if (e.target) {
                      setDuration((e.target as HTMLAudioElement).duration);
                    }
                  }}
                  onVolumeChange={(e) => {
                    if (e.target) {
                      setVolume((e.target as HTMLAudioElement).volume);
                    }
                  }}
                  listenInterval={1000}
                  volume={volume}
                  progressJumpStep={10000}
                  progressUpdateInterval={100}
                  className="rhap_container-custom"
                  layout="horizontal-reverse"
                />
              </div>
              
              {/* Keyboard shortcuts button */}
              <button 
                onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
              
              {/* Close button */}
              <button 
                onClick={() => {
                  if (audioElement) {
                    audioElement.pause();
                  }
                  setCurrentlyPlaying(null);
                }}
                className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close player"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">Space</span>
                <span className="text-gray-600 dark:text-gray-400">Play / Pause</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">Left Arrow</span>
                <span className="text-gray-600 dark:text-gray-400">Rewind 10 seconds</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">Right Arrow</span>
                <span className="text-gray-600 dark:text-gray-400">Forward 10 seconds</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">M</span>
                <span className="text-gray-600 dark:text-gray-400">Mute / Unmute</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">1-6</span>
                <span className="text-gray-600 dark:text-gray-400">Change playback speed</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Conference Confirmation Modal */}
      {showVideoConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Join Video Discussion
              </h3>
              <button
                onClick={closeVideoConfirmation}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Would you like to join a video discussion about "
                {podcastForVideo?.title}"?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeVideoConfirmation}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={joinVideoConference}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
