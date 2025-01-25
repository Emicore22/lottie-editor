let animationInstance = null;
let currentAnimationData = null;
let textLayers = [];
let isExporting = false;
let originalPrompt = null;

// Error Handling
function showError(message, error = null) {
    console.error('Error:', message, error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <strong>${message}</strong>
        ${error ? `<br><small>${error.message}</small>` : ''}
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 10000);
}

// File Upload Handler
document.getElementById('lottieUpload').addEventListener('change', async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                // Validate JSON
                const json = JSON.parse(event.target.result);
                if (!json.v || !json.layers) {
                    throw new Error("Invalid Lottie file format");
                }

                // Clear previous animation
                if (animationInstance) {
                    animationInstance.destroy();
                    document.getElementById('animation-container').innerHTML = '';
                }

                // Initialize animation
                animationInstance = lottie.loadAnimation({
                    container: document.getElementById('animation-container'),
                    renderer: 'svg',
                    animationData: json,
                    autoplay: true,
                    loop: true
                });

                // Store data and detect text layers
                currentAnimationData = json;
                detectTextLayers();
                populateLayerSelect();

            } catch (error) {
                showError('File load failed', error);
            }
        };
        reader.readAsText(file);

    } catch (error) {
        showError('Upload failed', error);
    }
});

// Text Layer Handling
function detectTextLayers() {
    textLayers = currentAnimationData.layers
        .map((layer, index) => ({
            index: index,
            name: layer.nm || `Layer ${index + 1}`,
            originalText: layer.t?.d?.k[0]?.s?.t || '',
            path: `layers[${index}].t.d.k[0].s.t`
        }))
        .filter(layer => layer.originalText !== '');
}

function populateLayerSelect() {
    const select = document.getElementById('textLayerSelect');
    select.innerHTML = '<option value="-1">Select text layer</option>';
    textLayers.forEach((layer, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = layer.name;
        select.appendChild(option);
    });
}

// Text Update
function updateText() {
    try {
        const selectedIndex = parseInt(document.getElementById('textLayerSelect').value);
        const newText = document.getElementById('textInput').value.trim();
        
        if (selectedIndex < 0) throw new Error('No layer selected');
        if (!newText) throw new Error('Text cannot be empty');

        const layer = textLayers[selectedIndex];
        animationInstance.renderer.elements[layer.index].updateDocumentData({ t: newText });
        currentAnimationData.layers[layer.index].t.d.k[0].s.t = newText;

    } catch (error) {
        showError('Text update failed', error);
    }
}

// Color Update
function updateColor() {
    try {
        const color = document.getElementById('colorPicker').value;
        const rgb = hexToRgb(color);
        
        animationInstance.renderer.elements.forEach(element => {
            if (element.fillColor) {
                element.fillColor = rgb;
            }
        });
    } catch (error) {
        showError('Color update failed', error);
    }
}

function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1,3), 16)/255,
        parseInt(hex.slice(3,5), 16)/255,
        parseInt(hex.slice(5,7), 16)/255
    ];
}

// Export Function
async function exportMP4() {
    if (isExporting || !animationInstance) return;
    isExporting = true;
    originalPrompt = window.prompt;
    window.prompt = () => {};

    const exportBtn = document.querySelector('.export-btn');
    let ffmpeg = null;

    try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Initializing...';
        
        const { createFFmpeg } = FFmpeg;
        ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
        });

        exportBtn.textContent = 'Loading FFmpeg...';
        await ffmpeg.load();

        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');

        const duration = Math.min(animationInstance.totalFrames / animationInstance.frameRate, 5);
        const totalFrames = Math.floor(duration * 24);
        exportBtn.textContent = `Capturing 0/${totalFrames}`;

        for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * animationInstance.totalFrames;
            animationInstance.goToAndStop(frameTime, true);
            
            await new Promise(resolve => requestAnimationFrame(resolve));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(document
