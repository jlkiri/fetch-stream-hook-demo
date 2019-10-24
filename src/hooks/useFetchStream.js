import { useState, useEffect, useMemo } from "react";

const MIMETypes = {
  json: response => response.json(),
  text: response => response.text(),
  blob: response => response.blob(),
  arrayBuffer: response => response.arrayBuffer(),
  formData: response => response.formData()
};

export default function useFetchStream({
  url,
  onChunkLoaded,
  onError = undefined,
  onFinish = undefined,
  parseAs = undefined,
  byteLength = undefined,
  fetchOptions = Object.create(null)
}) {
  const [data, setData] = useState(null);

  // Handle error message in browsers that do not throw AbortError
  let fetchAborted = false;

  // Prevent needless creation of AbortController on re-render
  const { signal, abort } = useMemo(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const abort = function abort() {
      fetchAborted = true;
      abortController.abort();
    };
    return { signal, abort };
  }, [url]);

  useEffect(() => {
    const fetchOpts = Object.assign({ signal: signal }, fetchOptions);

    const handleError = function handleError(error) {
      if (error.name == "AbortError" || fetchAborted) {
        console.warn("Fetch operation was aborted.");
        return;
      }
      if (onError) return onError(error);
      return console.error(error);
    };

    fetchAborted = false;

    fetch(url, fetchOpts)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `Request error: ${response.status}: ${response.statusText}`
          );
        }

        const contentLength =
          byteLength || response.headers.get("content-length");

        // Fallback to simple fetch
        if (contentLength === null) {
          console.warn(
            "Content-Length header is absent. Falling back to simple fetch."
          );
          return new Response(response.body);
        }

        const contentType = response.headers.get("content-type");

        let loaded = 0;

        const stream = new ReadableStream({
          start(controller) {
            const reader = response.body.getReader();

            return pump();

            function pump() {
              return reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }

                loaded += value.byteLength;

                onChunkLoaded({ loaded, total: contentLength });

                controller.enqueue(value);

                return pump();
              });
            }
          }
        });

        // Pass Content-Type to new response because original headers are lost
        return new Response(stream, {
          signal: signal,
          headers: { "Content-Type": contentType }
        });
      })
      .then(response => {
        const contentType = response.headers.get("content-type");

        const readBody = MIMETypes[parseAs] || selectBodyReader();

        function selectBodyReader() {
          const isJson = contentType && contentType.match(/json/i);
          const isText = contentType && contentType.match(/text/i);

          if (isJson) return MIMETypes.json;
          if (isText) return MIMETypes.text;
          return null;
        }

        if (!readBody)
          throw new Error(
            "Read error: You must provide a parseAs option for MIME types other than JSON or text."
          );

        return readBody(response);
      })
      .then(data => {
        if (onFinish) onFinish(data);
        setData(data);
      })
      .catch(handleError);
  }, [url, onChunkLoaded, onError, onFinish, parseAs, byteLength]);

  return { data: data, abort: abort };
}
