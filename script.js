// Global Variables
let animationInstance = null;
let currentAnimationData = null;
let textLayers = [];

// 1. File Upload Handling
document.getElementById('lottieUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            // Load animation data
            currentAnimationData = JSON.parse(e.target.result);
            
            // Initialize animation
            if(animationInstance) animationInstance.destroy();
            animationInstance = lottie.loadAnimation({
                container: document.getElementById('animation-container'),
                renderer: 'svg',
                animationData: currentAnimationData,
                autoplay: true
            });
            
            // Detect text layers
            textLayers = currentAnimationData.layers
                .map((layer, index) => ({
                    index: index,
                    name: layer.nm || `Text Layer ${index + 1}`,
                    originalText: layer.t?.d?.k[0]?.s?.t || ''
                }))
                .filter(layer => layer.originalText !== '');
            
            // Update layer selector
            const select = document.getElementById('textLayerSelect');
            select.innerHTML = '<option value="-1">Select text layer...</option>';
            textLayers.forEach((layer, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = layer.name;
                select.appendChild(option);
            });
            
        } catch (error) {
            alert('Error: Invalid Lottie file!');
        }
    };
    reader.readAsText(file);
});

// 2. Text Layer Selection
document.getElementById('textLayerSelect').addEventListener('change', function() {
    const selectedIndex = this.value;
    if(selectedIndex >= 0) {
        document.getElementById('textInput').value = 
            textLayers[selectedIndex].originalText;
    }
});

// 3. Update Text
function updateText() {
    const selectedIndex = document.getElementById('textLayerSelect').value;
    const newText = document.getElementById('textInput').value;
    
    if(selectedIndex === "-1") {
        alert("Please select a text layer first!");
        return;
    }
    
    try {
        // Update animation display
        animationInstance.renderer.elements[textLayers[selectedIndex].index]
            .updateDocumentData({ t: newText });
        
        // Update source data
        currentAnimationData.layers[textLayers[selectedIndex].index].t.d.k[0].s.t = newText;
        
    } catch (error) {
        alert("Error updating text!");
    }
}

// 4. Color Update
function updateColor() {
    const color = document.getElementById('colorPicker').value;
    const rgb = [
        parseInt(color.slice(1,3), 16)/255,
        parseInt(color.slice(3,5), 16)/255,
        parseInt(color.slice(5,7), 16)/255
    ];
    
    animationInstance.renderer.elements.forEach(element => {
        if(element.fillColor) {
            element.fillColor = rgb;
        }
    });
}

// 5. Export MP4
async function exportMP4() {
    try {
        const { createFFmpeg } = FFmpeg;
        const ffmpeg = createFFmpeg({ log: true });
        await ffmpeg.load();
        
        // Setup canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // Capture frames (3 seconds)
        for(let i = 0; i < 90; i++) {
            animationInstance.goToAndStop(i, true);
            ctx.drawImage(document.querySelector('svg'), 0, 0, 800, 600);
            const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            ffmpeg.FS('writeFile', `frame${i.toString().padStart(4, '0')}.png`, 
                new Uint8Array(await frameBlob.arrayBuffer()));
        }
        
        // Convert to MP4
        await ffmpeg.run(
            '-framerate', '30',
            '-i', 'frame%04d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
        );
        
        // Download
        const videoData = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = 'animation.mp4';
        downloadLink.click();
        
    } catch (error) {
        alert('Export failed! Please try again.');
    }
}
