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
      {/* Overlay to hide the share button in top right corner */}
      <div
        className="absolute top-0 right-0 bg-black"
        style={{
          width: '100px',
          height: '50px',
          pointerEvents: 'auto'
        }}
        aria-hidden="true"
      />
    </div>
  );
}
