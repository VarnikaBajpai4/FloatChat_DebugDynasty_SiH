import { createContext, useContext, useState } from "react";

// Create the context
const ThemeContext = createContext(undefined);

// ThemeProvider component
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  // Optionally, persist theme to localStorage
  // useEffect(() => {
  //   const stored = localStorage.getItem("theme");
  //   if (stored) setTheme(stored);
  // }, []);
  // useEffect(() => {
  //   localStorage.setItem("theme", theme);
  // }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use the theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
