'use client';

export default function NasaEyesViewer() {
  return (
    <iframe
      src="https://eyes.nasa.gov/apps/solar-system/#/home?embed=true&logo=false&menu=false&featured=false&share=false"
      className="w-full h-full border-0"
      title="NASA Eyes on the Solar System"
      allow="fullscreen"
    />
  );
}
