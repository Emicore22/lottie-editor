let animationInstance = null;
let currentAnimationData = null;
const ffmpeg = new FFmpeg();

// Initialize FFmpeg once
(async function initFFmpeg() {
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.wasm'
    });
})();

// File Upload Handler
document.getElementById('lottieUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            currentAnimationData = JSON.parse(e.target.result);
            loadAnimation(currentAnimationData);
            document.getElementById('export-status').textContent = '';
        } catch (error) {
            showError('Invalid Lottie file');
        }
    };
    reader.readAsText(file);
});

function loadAnimation(data) {
    if (animationInstance) animationInstance.destroy();
    
    animationInstance = lottie.loadAnimation({
        container: document.getElementById('animation-container'),
        renderer: 'svg',
        animationData: data,
        autoplay: true,
        loop: true
    });
}

function updateText() {
    const newText = document.getElementById('textInput').value;
    animationInstance.renderer.elements.forEach(element => {
        if (element.updateDocumentData) {
            element.updateDocumentData({ t: newText });
        }
    });
}

function updateColor() {
    const color = document.getElementById('colorPicker').value;
    const rgb = [
        parseInt(color.slice(1,3), 16)/255,
        parseInt(color.slice(3,5), 16)/255,
        parseInt(color.slice(5,7), 16)/255
    ];
    
    animationInstance.renderer.elements.forEach(element => {
        if (element.fillColor) {
            element.fillColor = rgb;
        }
    });
}

// Fixed Export Function
async function exportMP4() {
    try {
        const statusElement = document.getElementById('export-status');
        statusElement.textContent = "Initializing export...";
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;

        // Limit to 3 seconds of animation
        const totalFrames = Math.min(animationInstance.totalFrames, 90);
        const frameDuration = animationInstance.totalFrames / animationInstance.frameRate;
        const exportDuration = Math.min(frameDuration, 3);

        statusElement.textContent = `Exporting ${exportDuration}s video...`;

        for (let i = 0; i < totalFrames; i++) {
            animationInstance.goToAndStop(i, true);
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(document.querySelector('svg'), 0, 0, canvas.width, canvas.height);
            
            const frame = await new Promise(resolve => 
                canvas.toBlob(resolve, 'image/png')
            );
            
            await ffmpeg.writeFile(`frame${i.toString().padStart(4, '0')}.png`, 
                new Uint8Array(await frame.arrayBuffer()));
            
            statusElement.textContent = `Processed ${i+1}/${totalFrames} frames`;
        }

        await ffmpeg.exec([
            '-framerate', animationInstance.frameRate.toString(),
            '-i', 'frame%04d.png',
            '-c:v', 'libx264',
            '-vf', 'format=yuv420p',
            '-movflags', '+faststart',
            'output.mp4'
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `animation-${Date.now()}.mp4`;
        a.click();
        
        statusElement.textContent = "Export completed successfully!";
        setTimeout(() => statusElement.textContent = '', 5000);

    } catch (error) {
        showError(`Export failed: ${error.message}`);
    }
}

function showError(message) {
    const statusElement = document.getElementById('export-status');
    statusElement.textContent = message;
    statusElement.style.color = '#dc3545';
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.style.color = '#666';
    }, 5000);
}
