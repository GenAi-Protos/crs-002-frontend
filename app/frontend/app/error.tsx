"use client";

// The route error boundary. Without one, a throw anywhere in a client
// component unmounts the tree to a blank tab. One sentence naming the thing
// and the fix (docs/03 writing rules), and the fix is a button.

import { useEffect } from "react";
import { Button, CenterMessage } from "@/components/ui";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console is where a developer looks; the screen stays one sentence.
    console.error(error);
  }, [error]);

  return (
    <CenterMessage
      action={
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      }
    >
      This page did not load. Try again.
    </CenterMessage>
  );
}
