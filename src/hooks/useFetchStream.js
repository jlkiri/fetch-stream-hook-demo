import { useState, useEffect, useMemo } from "react";

const mimeTypes = {
  json: response => response.json(),
  text: response => response.text()
};

export default function useFetchStream({
  url,
  onChunkLoaded,
  onError = undefined,
  onFinish = undefined,
  bodyReader = undefined,
  byteLength = undefined
}) {
  const [data, setData] = useState(null);

  // Prevent needless creation of AbortController on re-render
  const { signal, abort } = useMemo(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    const abort = () => abortController.abort();
    return { signal, abort };
  }, []);

  useEffect(() => {
    const handleError = error => {
      if (onError) return onError(error);
      return console.error(`useFetchStream error: ${error}`);
    };

    fetch(url, { signal })
      .then(response => {
        const contentLength =
          byteLength || response.headers.get("content-length");

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

                if (contentLength)
                  onChunkLoaded({ loaded, total: contentLength });

                controller.enqueue(value);

                return pump();
              });
            }
          }
        });

        // Pass Content-Type to new response because original headers are lost
        return new Response(stream, {
          headers: { "Content-Type": contentType }
        });
      })
      .then(response => {
        const contentType = response.headers.get("content-type");

        const readBody = bodyReader || selectBodyReader();

        function selectBodyReader() {
          const isJson = contentType && contentType.match(/json/i);
          const isText = contentType && contentType.match(/text/i);

          if (isJson) return mimeTypes.json;
          if (isText) return mimeTypes.text;
          return null;
        }

        if (!readBody)
          throw new Error(
            "You must provide a body reading function for MIME types other than JSON or text."
          );

        return readBody(response);
      })
      .then(data => {
        if (onFinish) onFinish(data);
        setData(data);
      })
      .catch(handleError);
  }, [url, onChunkLoaded, onError, onFinish, bodyReader, signal, byteLength]);

  return { data: data, abort: abort };
}
