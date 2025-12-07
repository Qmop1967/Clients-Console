"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SplashScreen } from "@/components/ui/splash-screen";

interface SplashContextType {
  isLoading: boolean;
  hideSplash: () => void;
}

const SplashContext = createContext<SplashContextType>({
  isLoading: true,
  hideSplash: () => {},
});

export function useSplash() {
  return useContext(SplashContext);
}

interface SplashProviderProps {
  children: ReactNode;
}

// Session storage key to prevent showing splash on every navigation
const SPLASH_SHOWN_KEY = "tsh_splash_shown";

export function SplashProvider({ children }: SplashProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this session
    const splashShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);

    if (!splashShown) {
      setShowSplash(true);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, "true");
    setShowSplash(false);
    setIsLoading(false);
  };

  const hideSplash = () => {
    handleSplashComplete();
  };

  return (
    <SplashContext.Provider value={{ isLoading, hideSplash }}>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {children}
    </SplashContext.Provider>
  );
}
