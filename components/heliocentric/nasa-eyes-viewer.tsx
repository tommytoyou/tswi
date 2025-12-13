'use client';

export default function NasaEyesViewer() {
  return (
    <div className="relative w-full h-full">
      <iframe
        src="https://eyes.nasa.gov/apps/solar-system/#/home?embed=true&logo=false&menu=false&featured=false&share=false"
        className="w-full h-full border-0"
        title="NASA Eyes on the Solar System"
        allow="fullscreen"
      />
      {/* Logo overlay to cover the share button in top right corner */}
      <div
        className="absolute"
        style={{
          top: 0,
          right: 0,
          width: '150px',
          minHeight: '60px',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}
      >
        <img
          src="/dsd_logo.png"
          alt="Deep Space Dynamics"
          style={{
            width: '100%',
            height: 'auto'
          }}
        />
      </div>
    </div>
  );
}
