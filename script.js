const canvas = document.querySelector("#line-field");
const context = canvas.getContext("2d");

let width = 0;
let height = 0;
let pixelRatio = 1;
let animationFrame = 0;

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = bounds.width;
  height = bounds.height;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function drawLineField(time = 0) {
  context.clearRect(0, 0, width, height);

  const pulse = time / 2600;
  const left = Math.max(18, width * 0.045);
  const right = width - left;
  const top = Math.max(122, height * 0.17);
  const rows = 12;
  const step = Math.max(28, height / 18);

  context.lineCap = "square";

  for (let index = 0; index < rows; index += 1) {
    const y = top + index * step;
    const offset = Math.sin(pulse + index * 0.7) * 16;
    const length = (right - left) * (0.34 + ((index * 17) % 41) / 100);
    const start = left + ((index * 89) % Math.max(1, right - left - length));

    context.globalAlpha = 0.18;
    context.strokeStyle = index % 4 === 0 ? "#b24b37" : "#151512";
    context.lineWidth = index % 4 === 0 ? 1.25 : 1;
    context.beginPath();
    context.moveTo(start, y + offset);
    context.bezierCurveTo(
      start + length * 0.28,
      y - 12 - offset,
      start + length * 0.72,
      y + 18 + offset,
      start + length,
      y - offset * 0.4,
    );
    context.stroke();
  }

  context.globalAlpha = 0.12;
  context.strokeStyle = "#5e6b53";
  for (let index = 0; index < 5; index += 1) {
    const radius = 70 + index * 34;
    const x = right - 120 - index * 18;
    const y = height - 180 - index * 8;
    context.beginPath();
    context.arc(x, y, radius, 0.2 + pulse * 0.04, Math.PI * 1.34);
    context.stroke();
  }

  animationFrame = requestAnimationFrame(drawLineField);
}

function start() {
  resizeCanvas();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawLineField(0);
    cancelAnimationFrame(animationFrame);
    return;
  }

  drawLineField();
}

window.addEventListener("resize", resizeCanvas);
start();
