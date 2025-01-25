// script.js - Updated Version
let animationInstance = null;
let currentAnimationData = null;
let textLayers = [];
let isExporting = false;

// File Upload Handler
document.getElementById('lottieUpload').addEventListener('change', async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                currentAnimationData = JSON.parse(event.target.result);
                resetAnimation();
                detectTextLayers();
                populateLayerSelect();
            } catch (parseError) {
                showError('Invalid Lottie file format');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        showError('File upload failed: ' + error.message);
    }
});

// Animation Management
function resetAnimation() {
    if (animationInstance) {
        animationInstance.destroy();
        animationInstance = null;
    }
    const container = document.getElementById('animation-container');
    container.innerHTML = '';
}

// Text Layer Handling
function detectTextLayers() {
    textLayers = currentAnimationData.layers
        .map((layer, index) => ({
            index: index,
            name: layer.nm || `Text Layer ${index + 1}`,
            originalText: layer.t?.d?.k[0]?.s?.t || '',
            path: `layers[${index}].t.d.k[0].s.t`
        }))
        .filter(layer => layer.originalText !== '');
}

function populateLayerSelect() {
    const select = document.getElementById('textLayerSelect');
    select.innerHTML = '<option value="-1">Select text layer...</option>';
    textLayers.forEach((layer, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = layer.name;
        select.add(option);
    });
}

// Text Layer Selection
document.getElementById('textLayerSelect').addEventListener('change', function() {
    const selectedIndex = parseInt(this.value);
    const preview = document.getElementById('originalTextPreview');
    
    if (selectedIndex >= 0 && textLayers[selectedIndex]) {
        document.getElementById('textInput').value = textLayers[selectedIndex].originalText;
        preview.textContent = `Original: "${textLayers[selectedIndex].originalText}"`;
    } else {
        document.getElementById('textInput').value = '';
        preview.textContent = '';
    }
});

// Update Text
function updateText() {
    try {
        const selectedIndex = parseInt(document.getElementById('textLayerSelect').value);
        const newText = document.getElementById('textInput').value.trim();
        
        if (selectedIndex < 0) throw new Error('Please select a text layer first');
        if (!newText) throw new Error('Text cannot be empty');

        const layer = textLayers[selectedIndex];
        animationInstance.renderer.elements[layer.index].updateDocumentData({ t: newText });
        currentAnimationData.layers[layer.index].t.d.k[0].s.t = newText;
        
    } catch (error) {
        showError(error.message);
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
        showError('Color update failed: ' + error.message);
    }
}

function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
    ];
}

// Export Functionality
async function exportMP4() {
    if (isExporting) return;
    isExporting = true;
    
    const exportBtn = document.querySelector('.export-btn');
    let ffmpeg = null;

    try {
        // Initialize FFmpeg
        exportBtn.disabled = true;
        exportBtn.textContent = 'Initializing...';
        const { createFFmpeg } = FFmpeg;
        ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });

        // Load FFmpeg
        exportBtn.textContent = 'Loading FFmpeg...';
        await ffmpeg.load();

        // Setup canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1280;  // Optimized resolution
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        // Calculate duration (max 5 seconds)
        const duration = Math.min(animationInstance.totalFrames / animationInstance.frameRate, 5);
        const totalFrames = Math.floor(duration * 30);
        
        // Capture frames
        exportBtn.textContent = `Capturing 0/${totalFrames}`;
        for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * animationInstance.totalFrames;
            animationInstance.goToAndStop(frameTime, true);
            
            // Ensure proper rendering
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(document.querySelector('svg'), 0, 0, canvas.width, canvas.height);
            
            const frameBlob = await new Promise(resolve => 
                canvas.toBlob(resolve, 'image/png')
            );
            
            ffmpeg.FS('writeFile', `frame${i.toString().padStart(4, '0')}.png`, 
                new Uint8Array(await frameBlob.arrayBuffer()));
            
            exportBtn.textContent = `Capturing ${i + 1}/${totalFrames}`;
        }

        // Encode video
        exportBtn.textContent = 'Encoding video...';
        await ffmpeg.run(
            '-framerate', '30',
            '-i', 'frame%04d.png',
            '-vf', 'format=yuv420p',
            '-movflags', '+faststart',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'fast',
            'output.mp4'
        );

        // Verify output
        if (!ffmpeg.FS('readdir', '/').includes('output.mp4')) {
            throw new Error('Video encoding failed');
        }

        // Create download
        const videoData = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
        const downloadUrl = URL.createObjectURL(videoBlob);
        
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.download = `animation-${Date.now()}.mp4`;
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        showError(`Export failed: ${error.message}`);
    } finally {
        isExporting = false;
        exportBtn.disabled = false;
        exportBtn.textContent = '📤 Export MP4';
        if (ffmpeg) {
            try { ffmpeg.exit(); } 
            catch (e) { console.error('FFmpeg cleanup error:', e); }
        }
    }
}

// Error Handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize Animation
function loadAnimation(data) {
    animationInstance = lottie.loadAnimation({
        container: document.getElementById('animation-container'),
        renderer: 'svg',
        animationData: data,
        autoplay: true,
        loop: true
    });
}
