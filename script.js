const canvas = document.querySelector("#signal-canvas");
const context = canvas.getContext("2d");

const palette = ["#c44432", "#0c7a76", "#d6a33d", "#295d9b", "#ffffff"];
let dots = [];
let animationFrame = 0;
let width = 0;
let height = 0;
let pixelRatio = 1;

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = bounds.width;
  height = bounds.height;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const count = Math.max(34, Math.floor((width * height) / 18000));
  dots = Array.from({ length: count }, (_, index) => ({
    x: (index * 83) % width,
    y: (index * 137) % height,
    radius: 1.2 + ((index * 7) % 22) / 10,
    color: palette[index % palette.length],
    speed: 0.12 + ((index * 5) % 10) / 100,
    offset: index * 0.47,
  }));
}

function drawSignature(time = 0) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#101114";
  context.fillRect(0, 0, width, height);

  const pulse = time / 1000;

  context.globalAlpha = 0.24;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1;
  for (let y = 0; y < height; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y + Math.sin(y * 0.018 + pulse) * 18);
    context.stroke();
  }

  context.globalAlpha = 0.78;
  dots.forEach((dot, index) => {
    const x = (dot.x + pulse * 60 * dot.speed) % width;
    const y = dot.y + Math.sin(pulse + dot.offset) * 18;

    context.beginPath();
    context.fillStyle = dot.color;
    context.arc(x, y, dot.radius, 0, Math.PI * 2);
    context.fill();

    if (index % 3 === 0) {
      const next = dots[(index + 7) % dots.length];
      const nextX = (next.x + pulse * 60 * next.speed) % width;
      const nextY = next.y + Math.sin(pulse + next.offset) * 18;
      const distance = Math.hypot(nextX - x, nextY - y);
      if (distance < 190) {
        context.globalAlpha = 0.16;
        context.strokeStyle = dot.color;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(nextX, nextY);
        context.stroke();
        context.globalAlpha = 0.78;
      }
    }
  });

  context.globalAlpha = 0.11;
  context.fillStyle = "#ffffff";
  context.font = `${Math.max(220, width * 0.28)}px Georgia, serif`;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillText("M", width - 20, height + 46);

  animationFrame = requestAnimationFrame(drawSignature);
}

function startCanvas() {
  resizeCanvas();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawSignature(0);
    cancelAnimationFrame(animationFrame);
    return;
  }

  drawSignature();
}

window.addEventListener("resize", resizeCanvas);
startCanvas();
