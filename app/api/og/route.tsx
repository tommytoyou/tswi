import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          padding: '40px 80px',
        }}
      >
        {/* Background gradient effects */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '15%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* TSWI Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" />
            <path d="m10 11 4 4" />
            <path d="m17 7 4.3 4.3a2.41 2.41 0 0 1 0 3.4l-2.6 2.6a2.41 2.41 0 0 1-3.4 0L11 13" />
            <path d="M21.17 11H12" />
            <path d="m13 17-.07-.07a2.41 2.41 0 0 0-3.4 0l-.17.17" />
            <path d="m9 21-.07-.07a2.41 2.41 0 0 1 0-3.4l.17-.17" />
          </svg>
          <span
            style={{
              marginLeft: '16px',
              fontSize: '32px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            TSWI
          </span>
        </div>

        {/* Main Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #60a5fa, #a855f7)',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.1,
            }}
          >
            Tactical
          </span>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.1,
            }}
          >
            Space Weather
          </span>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #60a5fa, #a855f7)',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.1,
            }}
          >
            Intelligence
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            marginTop: '32px',
            fontSize: '24px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Real-time monitoring of solar activity and AI-powered predictions
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
