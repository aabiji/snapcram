import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

import useStorage from "@/lib/storage";

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useStorage<"light" | "dark">("theme");
  if (theme.length == 0) setTheme(systemTheme || "light");

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
export default useThemeContext;
