import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { isTauri } from "@/utils/tauri";

const DEFAULT_WORK_DURATION = 25; // minutes
const DEFAULT_SHORT_BREAK = 10; // minutes
const DEFAULT_LONG_BREAK = 15; // minutes
const DEFAULT_SESSIONS_BEFORE_LONG_BREAK = 4;

interface PomodoroSettings {
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  sound_enabled: boolean;
  sound_volume: number;
}

interface PomodoroContextType {
  timeLeft: number;
  isRunning: boolean;
  sessionType: "work" | "short_break" | "long_break";
  completedSessions: number;
  settings: PomodoroSettings;
  isCompleted: boolean;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  updateSettings: (newSettings: PomodoroSettings) => Promise<void>;
  fetchSettings: () => Promise<void>;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export const PomodoroProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PomodoroSettings>({
    work_duration: DEFAULT_WORK_DURATION,
    short_break_duration: DEFAULT_SHORT_BREAK,
    long_break_duration: DEFAULT_LONG_BREAK,
    sessions_before_long_break: DEFAULT_SESSIONS_BEFORE_LONG_BREAK,
    sound_enabled: true,
    sound_volume: 50,
  });
  
  // Load persisted timer state from localStorage
  const loadPersistedState = () => {
    try {
      const saved = localStorage.getItem('pomodoro_timer_state');
      if (saved) {
        const state = JSON.parse(saved);
        const savedEndTime = state.endTime as number | null;
        
        // Check if timer was running and calculate remaining time
        if (savedEndTime && state.isRunning) {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((savedEndTime - now) / 1000));
          
          // If timer has expired, mark as completed
          if (remaining <= 0) {
            return {
              timeLeft: 0,
              isRunning: false,
              sessionType: state.sessionType || "work",
              completedSessions: state.completedSessions || 0,
              isCompleted: false,
              endTime: null,
            };
          }
          
          return {
            timeLeft: remaining,
            isRunning: true, // Timer was running, keep it running
            sessionType: state.sessionType || "work",
            completedSessions: state.completedSessions || 0,
            isCompleted: false,
            endTime: savedEndTime,
          };
        }
        
        // Timer was paused or not running
        return {
          timeLeft: state.timeLeft || DEFAULT_WORK_DURATION * 60,
          isRunning: false,
          sessionType: state.sessionType || "work",
          completedSessions: state.completedSessions || 0,
          isCompleted: false,
          endTime: null,
        };
      }
    } catch (error) {
      console.error("Error loading persisted timer state:", error);
    }
    
    return null;
  };

  const persistedState = loadPersistedState();
  
  const [timeLeft, setTimeLeft] = useState(persistedState?.timeLeft ?? DEFAULT_WORK_DURATION * 60);
  const [isRunning, setIsRunning] = useState(persistedState?.isRunning ?? false);
  const [sessionType, setSessionType] = useState<"work" | "short_break" | "long_break">(persistedState?.sessionType ?? "work");
  const [completedSessions, setCompletedSessions] = useState(persistedState?.completedSessions ?? 0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const initialDurationRef = useRef<number>(DEFAULT_WORK_DURATION * 60);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isCompletingRef = useRef<boolean>(false);
  const timeLeftRef = useRef<number>(DEFAULT_WORK_DURATION * 60);
  const endTimeRef = useRef<number | null>(persistedState?.endTime ?? null); // Restore end time from localStorage

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    try {
      const state = {
        timeLeft,
        isRunning,
        sessionType,
        completedSessions,
        endTime: endTimeRef.current,
      };
      localStorage.setItem('pomodoro_timer_state', JSON.stringify(state));
    } catch (error) {
      console.error("Error saving timer state:", error);
    }
  }, [timeLeft, isRunning, sessionType, completedSessions]);

  // Load settings and completed sessions from database
  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchCompletedSessions();
    }
  }, [user]);

  // Check if timer expired while page was closed (will be checked after handleSessionComplete is defined)
  // This is handled in a useEffect after handleSessionComplete is defined

  // Initialize audio context
  useEffect(() => {
    let isMounted = true;
    let handleUserInteraction: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const initAudioContext = async () => {
      try {
        if (!audioContextRef.current && isMounted) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
          
          if (audioContextRef.current.state === 'suspended' && isMounted) {
            await audioContextRef.current.resume();
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error initializing audio context:", error);
        }
      }
    };

    if (isTauri()) {
      timeoutId = setTimeout(() => {
        if (isMounted) {
          initAudioContext();
        }
      }, 100);
    } else {
      handleUserInteraction = () => {
        if (isMounted) {
          initAudioContext();
        }
      };
      document.addEventListener('click', handleUserInteraction, { once: true });
      document.addEventListener('keydown', handleUserInteraction, { once: true });
    }

    return () => {
      isMounted = false;
      if (handleUserInteraction) {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("pomodoro_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No settings found, create default
          try {
            const { data: newSettings } = await supabase
              .from("pomodoro_settings")
              .insert({
                user_id: user.id,
                work_duration: DEFAULT_WORK_DURATION,
                short_break_duration: DEFAULT_SHORT_BREAK,
                long_break_duration: DEFAULT_LONG_BREAK,
                sessions_before_long_break: DEFAULT_SESSIONS_BEFORE_LONG_BREAK,
                sound_enabled: true,
                sound_volume: 50,
              })
              .select()
              .single();

            if (newSettings) {
              setSettings(newSettings);
              const duration = newSettings.work_duration * 60;
              setTimeLeft(duration);
              initialDurationRef.current = duration;
            }
          } catch (insertError: any) {
            if (insertError?.message?.includes("relation") || insertError?.code === "42P01") {
              console.log("Pomodoro settings table not created yet.");
            }
          }
        }
        return;
      }

      if (data) {
        setSettings(data);
        // Only update timer if it's not running (to preserve active timer)
        if (!isRunning) {
          if (sessionType === "work") {
            const duration = data.work_duration * 60;
            setTimeLeft(duration);
            initialDurationRef.current = duration;
          } else if (sessionType === "short_break") {
            const duration = data.short_break_duration * 60;
            setTimeLeft(duration);
            initialDurationRef.current = duration;
          } else {
            const duration = data.long_break_duration * 60;
            setTimeLeft(duration);
            initialDurationRef.current = duration;
          }
        } else {
          // Update initial duration ref for accurate recording, but don't change timeLeft
          if (sessionType === "work") {
            initialDurationRef.current = data.work_duration * 60;
          } else if (sessionType === "short_break") {
            initialDurationRef.current = data.short_break_duration * 60;
          } else {
            initialDurationRef.current = data.long_break_duration * 60;
          }
        }
      }
    } catch (error: any) {
      if (error?.message?.includes("relation") || error?.code === "42P01" || error?.code === "PGRST116") {
        console.log("Pomodoro settings table not found. Using default settings.");
      }
    }
  };

  const fetchCompletedSessions = async () => {
    if (!user) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("pomodoro_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_type", "work")
        .eq("completed", true)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`);

      setCompletedSessions(data?.length || 0);
    } catch (error: any) {
      if (error?.message?.includes("relation") || error?.code === "42P01") {
        // Table doesn't exist yet
      }
    }
  };

  const updateSettings = async (newSettings: PomodoroSettings) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("pomodoro_settings")
        .upsert({
          user_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        if (error.message?.includes("relation") || error.code === "42P01") {
          toast({
            title: "Migration Required",
            description: "Please run the database migrations to enable Pomodoro settings.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      setSettings(newSettings);
      
      // Update timer if needed
      if (sessionType === "work") {
        const duration = newSettings.work_duration * 60;
        setTimeLeft(duration);
        initialDurationRef.current = duration;
      } else if (sessionType === "short_break") {
        const duration = newSettings.short_break_duration * 60;
        setTimeLeft(duration);
        initialDurationRef.current = duration;
      } else {
        const duration = newSettings.long_break_duration * 60;
        setTimeLeft(duration);
        initialDurationRef.current = duration;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const playAlarm = async (): Promise<void> => {
    if (!settings.sound_enabled) return;

    const useAudioFile = !isTauri();

    if (useAudioFile) {
      try {
        const audioFiles = [
          "ES_Cartoon Character, Voice, High Pitched, Says Oh Wow Wow Wow - Epidemic Sound.mp3",
          "ES_Computer, Futuristic, Data Processing, Loading 13 - Epidemic Sound.mp3",
          "ES_Computer, Typing - Epidemic Sound.mp3",
          "ES_Deep, Low, Cinematic - Epidemic Sound.mp3",
          "ES_Drive By And Stop, Medium Speed, Gravel, Start, Reverse And Approach - Epidemic Sound.mp3",
          "ES_Keyboard, Razer, Typing, Fast - Epidemic Sound.mp3",
          "ES_Male, Dark, Evil Laugh 01 - Epidemic Sound.mp3",
          "ES_Organic, Wind, Whistling, Short - Epidemic Sound.mp3",
          "ES_Pass By, Audi Q5, Fast Speed, Asphalt 04 - Epidemic Sound.mp3",
          "ES_Porsche, Exterior, Start, Idle - Epidemic Sound.mp3",
          "ES_Porsche, Exterior, Start, Reverse, Drive Off - Epidemic Sound.mp3",
          "ES_Race Car, Design, Pass By, Fast, Whoosh - Epidemic Sound.mp3",
          "ES_Tank, Turret, Shot - Epidemic Sound.mp3",
          "ES_Typing On Keyboard - Epidemic Sound.mp3",
          "ES_Van, Ford Transit 07 4C, Passenger Door, Open, Close, Front, Exterior - Epidemic Sound.mp3",
        ];

        let randomIndex: number;
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
          randomIndex = randomValue % audioFiles.length;
        } else {
          randomIndex = Math.floor(Math.random() * audioFiles.length);
        }
        const randomFile = audioFiles[randomIndex];
        const audioPath = `/audio/${randomFile}?t=${Date.now()}`;

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }

        const audio = new Audio(audioPath);
        audio.volume = settings.sound_volume / 100;
        audio.preload = 'auto';
        audioRef.current = audio;

        const playPromise = audio.play();
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = '';
              audioRef.current = null;
            }
            resolve();
          }, 10000);
        });

        await Promise.race([playPromise, timeoutPromise]);
        return;
      } catch (error) {
        console.warn("Audio file playback failed, using beep fallback:", error);
      }
    }

    // Fallback to beep
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      for (let i = 0; i < 3; i++) {
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        const volume = settings.sound_volume / 100;
        gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3);
        
        oscillator.start(audioContextRef.current.currentTime + i * 0.4);
        oscillator.stop(audioContextRef.current.currentTime + i * 0.4 + 0.3);
      }

      await new Promise(resolve => setTimeout(resolve, 1200));
    } catch (fallbackError) {
      console.warn("Audio playback completely failed:", fallbackError);
    }
  };

  const handleSessionComplete = async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    
    setIsRunning(false);
    setIsCompleted(true);
    
    const actualDuration = initialDurationRef.current;
    
    await playAlarm();
    
    if (sessionType === "work") {
      if (user) {
        try {
          const { error: insertError } = await supabase.from("pomodoro_sessions").insert({
            user_id: user.id,
            session_type: "work",
            duration: actualDuration > 0 ? actualDuration : initialDurationRef.current,
            completed: true,
          });

          if (insertError) {
            console.error("Error saving session:", insertError);
            toast({
              title: "Error",
              description: "Session completed but failed to save.",
              variant: "destructive",
            });
          } else {
            await fetchCompletedSessions();
            toast({
              title: "🎉 Session Complete!",
              description: "Great work! Time for a break.",
            });

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Pomodoro Complete! 🎉", {
                body: "Time for a break! You've earned it.",
                icon: "/favicon.ico",
              });
            }
          }
        } catch (error) {
          console.error("Error in session completion:", error);
        }
      }

      // Determine next break type - use updated count after fetch
      // We need to wait for fetchCompletedSessions to update the state, but for immediate use,
      // we'll calculate based on the current count + 1
      const nextCount = completedSessions + 1;
      const nextBreakType = nextCount >= settings.sessions_before_long_break
        ? "long_break"
        : "short_break";

      setSessionType(nextBreakType);
      const breakDuration = nextBreakType === "long_break"
        ? settings.long_break_duration * 60
        : settings.short_break_duration * 60;
      setTimeLeft(breakDuration);
      initialDurationRef.current = breakDuration;
      endTimeRef.current = null; // Reset end time for new session
    } else {
      // Break completed, start work session
      setSessionType("work");
      const workDuration = settings.work_duration * 60;
      setTimeLeft(workDuration);
      initialDurationRef.current = workDuration;
      endTimeRef.current = Date.now() + workDuration * 1000; // Set end time for auto-started session
      setIsRunning(true); // Auto-start work session after break
      toast({
        title: "Break Complete!",
        description: "Ready to get back to work? Let's go! 💪",
      });
    }

    isCompletingRef.current = false;
    setIsCompleted(false);
  };

  // Check if timer expired while page was closed (after handleSessionComplete is defined)
  useEffect(() => {
    if (endTimeRef.current && isRunning) {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
      
      if (remaining <= 0 && !isCompletingRef.current) {
        // Timer expired while page was closed, trigger completion
        setTimeLeft(0);
        handleSessionComplete();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount, after handleSessionComplete is defined

  // Sync ref with state
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Calculate remaining time from end timestamp (works even when tab is inactive)
  const calculateRemainingTime = () => {
    if (endTimeRef.current === null) return timeLeft;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
    return remaining;
  };

  // Handle countdown timer - use end timestamp for accuracy
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Don't clear endTimeRef when pausing - we need it to resume correctly
      return;
    }

    // Set end time when starting (only if not already set)
    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + timeLeft * 1000;
    }

    const updateInterval = isTauri() ? 500 : 1000;
    
    const updateTimer = () => {
      if (endTimeRef.current === null) return;
      
      const remaining = calculateRemainingTime();
      
      if (remaining <= 0) {
        setTimeLeft(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        endTimeRef.current = null;
      } else {
        setTimeLeft(remaining);
      }
    };

    // Update immediately
    updateTimer();
    
    intervalRef.current = setInterval(updateTimer, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]); // Only depend on isRunning to avoid resetting endTime unnecessarily

  // Handle visibility change (tab switching) - recalculate timer when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isRunning && endTimeRef.current !== null) {
        // Tab became active, recalculate remaining time
        const remaining = calculateRemainingTime();
        if (remaining <= 0) {
          setTimeLeft(0);
          endTimeRef.current = null;
        } else {
          setTimeLeft(remaining);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle window focus/blur for better cross-browser support
    const handleFocus = () => {
      if (isRunning && endTimeRef.current !== null) {
        const remaining = calculateRemainingTime();
        if (remaining <= 0) {
          setTimeLeft(0);
          endTimeRef.current = null;
        } else {
          setTimeLeft(remaining);
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isRunning]);

  // Handle session completion when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && isRunning && !isCompletingRef.current) {
      const scheduleCompletion = () => {
        if (timeLeftRef.current === 0 && isRunning && !isCompletingRef.current) {
          handleSessionComplete();
        }
      };
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const timeoutId = (window as any).requestIdleCallback(scheduleCompletion, { timeout: 100 });
        return () => {
          if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
            (window as any).cancelIdleCallback(timeoutId);
          }
        };
      } else {
        const timeoutId = setTimeout(scheduleCompletion, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [timeLeft, isRunning]);

  const startTimer = () => {
    // Calculate end time based on current timeLeft
    endTimeRef.current = Date.now() + timeLeft * 1000;
    setIsRunning(true);
    setIsCompleted(false);
  };

  const pauseTimer = () => {
    // When pausing, update timeLeft based on remaining time from end timestamp
    if (endTimeRef.current !== null) {
      const remaining = calculateRemainingTime();
      setTimeLeft(remaining);
      endTimeRef.current = null; // Clear end time when pausing
    }
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsCompleted(false);
    endTimeRef.current = null;
    const duration = sessionType === "work"
      ? settings.work_duration * 60
      : sessionType === "short_break"
      ? settings.short_break_duration * 60
      : settings.long_break_duration * 60;
    setTimeLeft(duration);
    initialDurationRef.current = duration;
  };

  return (
    <PomodoroContext.Provider
      value={{
        timeLeft,
        isRunning,
        sessionType,
        completedSessions,
        settings,
        isCompleted,
        startTimer,
        pauseTimer,
        resetTimer,
        updateSettings,
        fetchSettings,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (context === undefined) {
    throw new Error("usePomodoro must be used within a PomodoroProvider");
  }
  return context;
};

