import React, { useRef, useState, useCallback } from "react";
import useFetchStream from "./hooks/useFetchStream";
import "./App.css";

function Start() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div className="loading">
        <button onClick={() => setStarted(true)}>START</button>
      </div>
    );
  }

  return <Download />;
}

function Download() {
  const progressRef = useRef();
  const [hideIndicator, setHideIndicator] = useState(false);
  const [aborted, setAborted] = useState(false);

  const showProgress = useCallback(({ loaded, total }) => {
    progressRef.current.textContent = `${Math.round((loaded / total) * 100)}%`;
  }, []);

  const onFinish = useCallback(() => {
    progressRef.current.classList.add("fadeOut");
    setTimeout(() => setHideIndicator(true), 700);
  }, []);

  const readBlob = useCallback(response => response.blob(), []);

  const handleButtonClick = () => {
    abort();
    setAborted(true);
  };

  const { data, abort } = useFetchStream({
    url: "space.jpg",
    onChunkLoaded: showProgress,
    onFinish: onFinish,
    bodyReader: readBlob
  });

  if (!hideIndicator)
    return (
      <div className="loading">
        <span className="indicator" ref={progressRef}></span>
        {aborted ? (
          <span>Download was aborted</span>
        ) : (
          <button onClick={handleButtonClick}>ABORT</button>
        )}
      </div>
    );

  if (!data) return null;

  const dataUrl = URL.createObjectURL(data);

  return <img src={dataUrl} />;
}

function App() {
  return (
    <div className="app">
      <Start />
    </div>
  );
}

export default App;
