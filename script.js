// script.js - Final Troubleshooting Version
let animationInstance = null;
let currentAnimationData = null;
let textLayers = [];
let isExporting = false;
let originalPrompt = null;

// Enhanced Error Handling
function showError(message, error = null) {
    console.error('Error Details:', { message, error });
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <strong>${message}</strong><br>
        ${error ? error.message : ''}
        <div class="error-code">${error ? error.stack : ''}</div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 10000);
}

// Updated Export Function
async function exportMP4() {
    if (isExporting) return;
    isExporting = true;
    originalPrompt = window.prompt; // Store original prompt function
    
    const exportBtn = document.querySelector('.export-btn');
    let ffmpeg = null;

    try {
        // Initialization
        window.prompt = () => {}; // Disable memory prompts
        exportBtn.disabled = true;
        exportBtn.textContent = 'Initializing...';
        
        console.log('[EXPORT] Starting export process');
        const { createFFmpeg } = FFmpeg;
        
        // Updated FFmpeg Configuration
        ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
            wasmPath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.wasm'
        });

        // Load FFmpeg with timeout
        exportBtn.textContent = 'Loading FFmpeg...';
        await Promise.race([
            ffmpeg.load(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('FFmpeg load timeout')), 10000)
            )
        ]);

        // Setup Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;  // Reduced resolution for stability
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        
        // Frame Capture
        const duration = Math.min(animationInstance.totalFrames / animationInstance.frameRate, 5);
        const totalFrames = Math.floor(duration * 24); // 24 FPS for stability
        exportBtn.textContent = `Preparing (0/${totalFrames})`;

        console.log('[EXPORT] Starting frame capture');
        for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * animationInstance.totalFrames;
            animationInstance.goToAndStop(frameTime, true);
            
            // Rendering Safeguards
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(document.querySelector('svg'), 0, 0, canvas.width, canvas.height);
                    resolve();
                });
            });
            
            // Frame Validation
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData.data.every(channel => channel === 0)) {
                throw new Error(`Blank frame at position ${i}`);
            }

            // Store Frame
            const frameBlob = await new Promise(resolve => 
                canvas.toBlob(resolve, 'image/png')
            );
            ffmpeg.FS('writeFile', `frame${i.toString().padStart(4, '0')}.png`,
                new Uint8Array(await frameBlob.arrayBuffer()));

            exportBtn.textContent = `Capturing (${i + 1}/${totalFrames})`;
        }

        // Video Encoding
        exportBtn.textContent = 'Encoding...';
        console.log('[EXPORT] Starting video encoding');
        await ffmpeg.run(
            '-framerate', '24',
            '-i', 'frame%04d.png',
            '-vf', 'scale=800:-2', // Maintain aspect ratio
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            'output.mp4'
        );

        // Final Validation
        if (!ffmpeg.FS('readdir', '/').includes('output.mp4')) {
            throw new Error('Encoding failed - no output file');
        }

        // Create Download
        const videoData = ffmpeg.FS('readFile', 'output.mp4');
        if (videoData.length < 1024) {
            throw new Error('Output file too small (corrupted?)');
        }

        const videoUrl = URL.createObjectURL(new Blob([videoData.buffer], { type: 'video/mp4' }));
        const downloadLink = document.createElement('a');
        downloadLink.href = videoUrl;
        downloadLink.download = `animation-${Date.now()}.mp4`;
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(videoUrl), 5000);

    } catch (error) {
        showError('Export Failed', error);
        console.error('Export Error Stack:', error.stack);
        
        // Alternative Export Method (WebM)
        try {
            console.log('[FALLBACK] Trying WebM export');
            const stream = document.querySelector('svg').ownerSVGElement.captureStream(24);
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.start(100);
            
            await new Promise(resolve => 
                setTimeout(resolve, duration * 1000)
            );
            
            recorder.stop();
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            const webmUrl = URL.createObjectURL(webmBlob);
            const webmLink = document.createElement('a');
            webmLink.href = webmUrl;
            webmLink.download = 'animation.webm';
            webmLink.click();
            
        } catch (fallbackError) {
            showError('Both Export Methods Failed', fallbackError);
        }
        
    } finally {
        // Cleanup
        isExporting = false;
        window.prompt = originalPrompt;
        exportBtn.disabled = false;
        exportBtn.textContent = '📤 Export MP4';
        
        if (ffmpeg) {
            try {
                ffmpeg.exit();
                ffmpeg = null;
            } catch (cleanupError) {
                console.warn('Cleanup error:', cleanupError);
            }
        }
        
        console.log('[EXPORT] Process completed');
    }
}

// ... (Rest of the code remains same as previous version with error handling improvements)
