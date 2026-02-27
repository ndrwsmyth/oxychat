"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="oxy-global-error">
          <div className="oxy-global-error__card">
            <h1 className="oxy-global-error__title">Something went wrong</h1>
            <p className="oxy-global-error__message">
              An unexpected error occurred while loading this view.
            </p>
            <button
              className="oxy-global-error__retry"
              type="button"
              onClick={() => reset()}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
