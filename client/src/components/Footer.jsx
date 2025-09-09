import React from "react";

const Footer = (theme) => {
  return (
    <footer
      className={`py-12 px-6 border-t ${
        theme === "light" ? "border-[#0EA5E9]/30" : "border-white/20"
      }`}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div
            className={`flex gap-6 text-sm ${
              theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
            }`}
          >
            <a
              href="#"
              className={`transition-colors ${
                theme === "light" ? "hover:text-[#0B1220]" : "hover:text-white"
              }`}
            >
              About
            </a>
            <a
              href="#"
              className={`transition-colors ${
                theme === "light" ? "hover:text-[#0B1220]" : "hover:text-white"
              }`}
            >
              Docs
            </a>
            <a
              href="#"
              className={`transition-colors ${
                theme === "light" ? "hover:text-[#0B1220]" : "hover:text-white"
              }`}
            >
              Contact
            </a>
          </div>
          <div
            className={`text-sm ${
              theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
            }`}
          >
            © FloatChat
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
