import { useState } from "react";
import { Button } from "@/components/ui/button";
import AuthModal from "@/components/auth/AuthModal";

export default function LoginButton({
  children = "Log In",
  onClick,
  ...buttonProps
}) {
  const [open, setOpen] = useState(false);

  const handleClick = (e) => {
    onClick?.(e);
    setOpen(true);
  };

  return (
    <>
      <Button {...buttonProps} onClick={handleClick}>
        {children}
      </Button>
      <AuthModal open={open} onClose={() => setOpen(false)} mode="login" />
    </>
  );
}