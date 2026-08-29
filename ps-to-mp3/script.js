// Import FFmpeg WebAssembly
import { FFmpeg } from './ffmpeg/classes.js';

// Select DOM elements
const dropZone = document.getElementById('drop-zone');
const filePicker = document.getElementById('file-picker');
const fileInput = document.getElementById('file-input');
const metadata = document.getElementById('metadata');
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const appCard = document.querySelector('.app-card');
let outputUrl = null;

async function processFile(file) {
  const ffmpeg = new FFmpeg();

  const inputName = file.name; // Define inputName from the file
  const outputName = `${inputName}.mp3`; // Define outputName based on inputName

  metadata.textContent = `Input File:
  - Name: ${inputName}
  - Size: ${(file.size / 1024).toFixed(2)} KB`;

  progressText.textContent = 'Loading FFmpeg...';
progressBar.value = 0;
  await ffmpeg.load({ classWorkerURL: './ffmpeg/worker.js' });

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

  ffmpeg.on('progress', (p) => {
  
  if (p.progress) {
    const percentage = Math.round(p.progress * 100);
    progressText.textContent = `Processing: ${percentage}% completed`;
    progressBar.value = percentage;
  }
});

  const execOutput = await ffmpeg.exec(['-i', inputName, '-q:a', '0', outputName]);


  const outputData = await ffmpeg.readFile(outputName);
  const blob = new Blob([outputData], { type: 'audio/mp3' });
  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
  }
  outputUrl = URL.createObjectURL(blob);

  document.getElementById('download-link')?.remove();

  const link = document.createElement('a');
  link.id = 'download-link';
  link.href = outputUrl;
  link.download = outputName;
  link.textContent = `Download ${outputName}`;
  link.style.display = 'block';
  appCard.appendChild(link);

  metadata.textContent += `

Output File:
  - Name: ${outputName}
  - Size: ${(outputData.length / 1024).toFixed(2)} KB`;

  progressText.textContent = 'Conversion complete!';
progressBar.value = 100;
}

// Event listeners for drag-and-drop and file input
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('audio/')) {
    processFile(file);
  } else {
    alert('Please drop a valid audio file.');
  }
});

filePicker.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith('audio/')) {
    processFile(file);
  } else {
    alert('Please select a valid audio file.');
  }
});
