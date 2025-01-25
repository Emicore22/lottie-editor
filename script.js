// Add These Updates
let animationInstance = null;

// Enhanced Animation Loader
function loadAnimation(json) {
    try {
        // Validate JSON structure
        if (!json || typeof json !== 'object' || 
            !json.v || !json.layers || !json.fr) {
            throw new Error("Invalid Lottie JSON structure");
        }

        // Clear previous
        if (animationInstance) {
            animationInstance.destroy();
            document.querySelector('#animation-container svg')?.remove();
        }

        // Create container reference
        const container = document.getElementById('animation-container');
        if (!container) throw new Error("Animation container not found");
        
        // Initialize animation
        animationInstance = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            animationData: json,
            autoplay: true,
            loop: true
        });

        // Debugging events
        animationInstance.addEventListener('DOMLoaded', () => {
            console.log('SVG Elements loaded:', container.querySelector('svg'));
            container.querySelector('.animation-placeholder').style.display = 'none';
        });

        animationInstance.addEventListener('data_failed', (err) => {
            console.error('Data load failed:', err);
            showError('Animation data corrupted', err);
        });

        // Force initial render
        requestAnimationFrame(() => {
            animationInstance.goToAndStop(0, true);
            container.style.opacity = '1';
        });

    } catch (error) {
        showError('Animation initialization failed', error);
        document.querySelector('.animation-placeholder').style.display = 'block';
    }
}

// Modified File Upload Handler
document.getElementById('lottieUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            loadAnimation(json);
        } catch (error) {
            showError('Invalid JSON file', error);
        }
    };
    reader.onerror = (error) => showError('File read failed', error);
    reader.readAsText(file);
});

// Add to Existing Code
function showError(message, error = null) {
    const errorText = error ? `${message}\n${error.message}\n${error.stack}` : message;
    console.error(errorText);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorText;
    
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 10000);
}
