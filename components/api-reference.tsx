"use client";

import { useEffect, useRef, useState } from "react";

import "swagger-ui-dist/swagger-ui.css";
import "./api-reference.css";

/**
 * Swagger UI rendering the OpenAPI document at `url`.
 *
 * The bundle is about a megabyte, so it is imported only once this page is
 * in the browser rather than shipped with the route. It is self-hosted from
 * `swagger-ui-dist` instead of a CDN, so the version is pinned in the
 * lockfile and the page works offline. *Try it out* calls the API from this
 * origin, so it carries the visitor's session cookie like the app does.
 */
export function ApiReference({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    import("swagger-ui-dist/swagger-ui-es-bundle.js")
      .then(({ default: SwaggerUI }) => {
        if (cancelled || !container.current) return;

        SwaggerUI({
          domNode: container.current,
          url,
          deepLinking: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 1,
          displayRequestDuration: true,
          tryItOutEnabled: false,
          onComplete: () => {
            if (!cancelled) setStatus("ready");
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <>
      <div aria-live="polite" className="empty:hidden">
        {status === "loading" && <ReferenceSkeleton />}
        {status === "failed" && (
          <p className="text-sm text-danger">
            The API reference did not load. Refresh the page to try again, or
            read the{" "}
            <a href={url} className="font-semibold underline">
              OpenAPI document
            </a>{" "}
            directly.
          </p>
        )}
      </div>
      <div ref={container} className="api-reference" />
    </>
  );
}

function ReferenceSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3"
      aria-label="Loading the API reference"
    >
      <div className="h-6 w-40 rounded-control bg-sunken" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-12 rounded-control bg-sunken" />
      ))}
    </div>
  );
}
