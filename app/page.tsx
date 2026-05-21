export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-instrument-serif), Georgia, serif',
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          margin: 0,
        }}
      >
        Los Chillangos
      </h1>
      <p style={{ marginTop: '1rem', fontSize: '1.125rem', opacity: 0.7 }}>
        Next migration in progress.
      </p>
    </main>
  );
}
