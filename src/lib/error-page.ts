export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Something Went Wrong | Bideros</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background-color: #070e0b;
        color: #ffffff;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
        position: relative;
        overflow: hidden;
      }
      .bg-glow-1 {
        position: absolute;
        top: -20%;
        left: -20%;
        width: 60%;
        height: 60%;
        background: rgba(0, 255, 204, 0.1);
        border-radius: 50%;
        filter: blur(120px);
        pointer-events: none;
        z-index: 0;
      }
      .bg-glow-2 {
        position: absolute;
        bottom: -20%;
        right: -20%;
        width: 60%;
        height: 60%;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 50%;
        filter: blur(120px);
        pointer-events: none;
        z-index: 0;
      }
      .container {
        max-width: 28rem;
        width: 100%;
        text-align: center;
        position: relative;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .image-container {
        position: relative;
        display: inline-block;
        margin: 0 auto;
      }
      .image-container::before {
        content: '';
        position: absolute;
        top: -6px;
        left: -6px;
        right: -6px;
        bottom: -6px;
        background: linear-gradient(to right, #ef4444, #00ffcc);
        border-radius: 1.25rem;
        filter: blur(8px);
        opacity: 0.3;
        z-index: -1;
      }
      img {
        display: block;
        width: 100%;
        max-width: 320px;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        animation: floatY 6s ease-in-out infinite;
      }
      .card {
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 2rem;
        border-radius: 1.25rem;
        box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
      }
      h1 {
        font-size: 1.875rem;
        font-weight: 800;
        margin: 0 0 1rem;
        letter-spacing: -0.025em;
        background: linear-gradient(to right, #ef4444, #ffffff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      p {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.875rem;
        line-height: 1.625;
        margin: 0 0 1.5rem;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
      }
      button, a {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.3s ease;
        box-sizing: border-box;
      }
      .primary {
        background: linear-gradient(to right, #00ffcc, #22c55e);
        color: #000000;
        border: none;
        box-shadow: 0 0 20px rgba(0, 255, 204, 0.3);
      }
      .primary:hover {
        box-shadow: 0 0 35px rgba(0, 255, 204, 0.5);
        transform: translateY(-2px);
      }
      .secondary {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }
      @keyframes floatY {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
    </style>
  </head>
  <body>
    <div class="bg-glow-1"></div>
    <div class="bg-glow-2"></div>
    <div class="container">
      <div class="image-container">
        <img src="/404.webp" alt="Glitch" />
      </div>
      <div class="card">
        <h1>Something Went Wrong</h1>
        <p>The scoreboard encountered an unexpected glitch. You can try reloading the pitch or head back home.</p>
        <div class="actions">
          <button class="primary" onclick="location.reload()">Try again</button>
          <a class="secondary" href="/">Go home</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
