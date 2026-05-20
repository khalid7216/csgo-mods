import React, { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onFinish }) {
  const videoRef = useRef(null);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowOverlay(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(err => {
        console.error('Video play failed:', err);
        setVideoError(true);
      });
    }
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setFading(true);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.muted = true;
        }
        setTimeout(() => {
          setVisible(false);
          onFinish();
        }, 500);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fading]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {!videoError ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            console.error('Video error:', e);
            setVideoError(true);
          }}
          onLoadedData={() => {
            console.log('Video loaded successfully');
            setVideoLoaded(true);
          }}
          onEnded={() => {
            setFading(true);
            setTimeout(() => {
              setVisible(false);
              onFinish();
            }, 500);
          }}
        >
          <source src="https://res.cloudinary.com/dwo1whvr8/video/upload/v1779261825/csgomp4.mp4_u4tf6h.mp4" type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-primary-900/30"></div>
      )}

      {showOverlay && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-500">
          <div className="text-center">
            <h1 className="text-6xl font-black text-white tracking-widest drop-shadow-2xl">
              CSGO MOD MANAGER
            </h1>
            <p className="mt-4 text-primary-400 text-sm tracking-[0.3em] uppercase">
              Maps &bull; Skins &bull; LAN &bull; Stats
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-dark-400 text-xs tracking-widest uppercase">Loading</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
