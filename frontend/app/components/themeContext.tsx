import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

import { storageGet, storageSet } from "../lib/helpers";

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
  const userTheme = storageGet<"light" | "dark">("theme", true)!;
  const initialTheme =
    userTheme === 'light' || userTheme === 'dark'
      ? userTheme : systemTheme || 'light';
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      storageSet("theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
export default useThemeContext;