document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const puzzleShape = document.getElementById('puzzleShape');
    const difficulty = document.getElementById('difficulty');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const gameArea = document.getElementById('gameArea');
    const puzzleContainer = document.getElementById('puzzleContainer');

    let originalImage = null;
    let pieces = [];
    let isDragging = false;
    let selectedPiece = null;
    let offsetX, offsetY;
    let containerRect;
    
    // Configuration
    let gridSize = 4;
    let shape = 'rectangle_horizontal';

    // Event Listeners
    imageUpload.addEventListener('change', handleImageUpload);
    startBtn.addEventListener('click', startPuzzle);
    resetBtn.addEventListener('click', resetPuzzle);

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                originalImage = img;
                startBtn.disabled = false;
                // Show preview
                puzzleContainer.innerHTML = '';
                const previewImg = img.cloneNode();
                previewImg.style.maxWidth = '100%';
                previewImg.style.maxHeight = '500px';
                puzzleContainer.appendChild(previewImg);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }

    function startPuzzle() {
        if (!originalImage) return;

        gridSize = parseInt(difficulty.value);
        shape = puzzleShape.value;

        // Prepare the game area
        startBtn.classList.add('hidden');
        imageUpload.parentElement.classList.add('hidden'); // Hide upload during game
        resetBtn.classList.remove('hidden');
        puzzleContainer.innerHTML = '';

        generatePuzzle();
    }

    function resetPuzzle() {
        startBtn.classList.remove('hidden');
        imageUpload.parentElement.classList.remove('hidden');
        resetBtn.classList.add('hidden');
        
        // Restore preview
        puzzleContainer.innerHTML = '';
        if (originalImage) {
            const previewImg = originalImage.cloneNode();
            previewImg.style.maxWidth = '100%';
            previewImg.style.maxHeight = '500px';
            puzzleContainer.appendChild(previewImg);
        }
    }

    function generatePuzzle() {
        // 1. Process Image (Crop/Resize/Mask)
        const processCanvas = document.createElement('canvas');
        const ctx = processCanvas.getContext('2d');
        
        let targetWidth = originalImage.width;
        let targetHeight = originalImage.height;
        
        // Determine aspect ratio / crop based on shape
        let targetRatio = targetWidth / targetHeight; // Default to original

        if (shape === 'square' || shape === 'circle') {
            targetRatio = 1;
        } else if (shape === 'rectangle_horizontal') {
            targetRatio = 4/3;
        } else if (shape === 'rectangle_vertical') {
            targetRatio = 3/4;
        }

        // Calculate Crop Dimensions based on Target Ratio
        const srcRatio = originalImage.width / originalImage.height;
        
        // If we need to enforce a ratio (Square/Circle/Fixed Rects)
        // If image is wider than target ratio, crop width.
        // If image is taller than target ratio, crop height.
        
        if (srcRatio > targetRatio) {
             // Image is wider -> Height is constraint
             targetHeight = originalImage.height;
             targetWidth = targetHeight * targetRatio;
        } else {
             // Image is taller -> Width is constraint
             targetWidth = originalImage.width;
             targetHeight = targetWidth / targetRatio;
        }

        processCanvas.width = targetWidth;
        processCanvas.height = targetHeight;

        // Draw image (Center Crop)
        const srcX = (originalImage.width - targetWidth) / 2;
        const srcY = (originalImage.height - targetHeight) / 2;

        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(targetWidth / 2, targetHeight / 2, targetWidth / 2, 0, Math.PI * 2);
            ctx.clip();
        }

        ctx.drawImage(originalImage, 
            srcX, srcY, targetWidth, targetHeight, 
            0, 0, targetWidth, targetHeight
        );

        const processedImageSrc = processCanvas.toDataURL();

        // 2. Calculate Display Dimensions
        // We want the workspace to be exactly the visible game area size (or slightly smaller to avoid scrollbars)
        const workspaceWidth = gameArea.clientWidth;
        const workspaceHeight = gameArea.clientHeight || 600; // Fallback if 0
        
        // Make puzzle pieces smaller relative to the game area
        // We'll use a smaller max dimension for the puzzle itself
        // e.g. 70% of the workspace width/height (increased from 50% per user request)
        const puzzleMaxWidth = workspaceWidth * 0.7;
        const puzzleMaxHeight = workspaceHeight * 0.7;
        
        let displayWidth = targetWidth;
        let displayHeight = targetHeight;

        const scale = Math.min(puzzleMaxWidth / displayWidth, puzzleMaxHeight / displayHeight);
        displayWidth *= scale;
        displayHeight *= scale;

        // Set container to match workspace exactly
        puzzleContainer.style.width = `${workspaceWidth}px`;
        puzzleContainer.style.height = `${workspaceHeight}px`;
        
        // --- WORKSPACE SETUP ---
        // (Removed previous expansion logic as we now fit to visible area)
        
        puzzleContainer.style.background = 'none'; // No guide
        puzzleContainer.style.boxShadow = 'none';
        
        // Remove border radius from container
        puzzleContainer.style.borderRadius = '0';
        puzzleContainer.style.border = 'none';

        const pieceWidth = Math.floor(displayWidth / gridSize);
        const pieceHeight = Math.floor(displayHeight / gridSize);
        
        // Adjust display size to be exact multiple
        displayWidth = pieceWidth * gridSize;
        displayHeight = pieceHeight * gridSize;
        
        puzzleContainer.style.width = `${workspaceWidth}px`;
        puzzleContainer.style.height = `${workspaceHeight}px`;
        const tabs = [];
        for(let y=0; y<gridSize; y++) {
            tabs[y] = [];
            for(let x=0; x<gridSize; x++) {
                tabs[y][x] = {
                    top: (y === 0) ? 0 : -tabs[y-1][x].bottom,
                    right: (x === gridSize - 1) ? 0 : (Math.random() > 0.5 ? 1 : -1),
                    bottom: (y === gridSize - 1) ? 0 : (Math.random() > 0.5 ? 1 : -1),
                    left: (x === 0) ? 0 : -tabs[y][x-1].right
                };
            }
        }

        pieces = [];

        // 3. Create Pieces
        const tabSize = Math.min(pieceWidth, pieceHeight) * 0.25; // Size of the sticking out part

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const pieceCanvas = document.createElement('canvas');
                const pCtx = pieceCanvas.getContext('2d');
                
                // Canvas needs to be bigger to fit tabs
                const canvasWidth = pieceWidth + tabSize * 2;
                const canvasHeight = pieceHeight + tabSize * 2;
                
                pieceCanvas.width = canvasWidth;
                pieceCanvas.height = canvasHeight;
                pieceCanvas.classList.add('puzzle-piece');
                
                // Draw Path
                pCtx.save();
                pCtx.translate(tabSize, tabSize); // Offset for top/left tabs
                
                const pieceShape = tabs[y][x];
                drawPuzzleShape(pCtx, pieceWidth, pieceHeight, tabSize, pieceShape);
                
                pCtx.clip();
                
                // Draw Image
                // We need to map the source image part to this canvas
                // Source Coordinates (from original high-res image)
                // We are drawing from the PROCESSED image (processCanvas) which matches display ratio but is high res?
                // Wait, processCanvas was targetWidth x targetHeight. 
                // displayWidth x displayHeight is the scaled version.
                
                // Let's use the processCanvas as source.
                // Ratio between processCanvas and display size
                const ratioX = processCanvas.width / displayWidth;
                const ratioY = processCanvas.height / displayHeight;
                
                const srcX = (x * pieceWidth - tabSize) * ratioX;
                const srcY = (y * pieceHeight - tabSize) * ratioY;
                const srcW = canvasWidth * ratioX;
                const srcH = canvasHeight * ratioY;
                
                safeDrawImage(pCtx, processCanvas, 
                    srcX, srcY, srcW, srcH,
                    -tabSize, -tabSize, canvasWidth, canvasHeight
                );
                
                // Add Stroke/Bevel effect
                // Removed stroke to prevent "cracks" between pieces
                // pCtx.strokeStyle = 'rgba(0,0,0,0.3)';
                // pCtx.lineWidth = 2;
                // pCtx.stroke();
                pCtx.restore();

                // Position logic
                // The visual "box" of the piece is (x*pieceWidth, y*pieceHeight)
                // But our canvas includes padding.
                // So the canvas top-left should be at (x*pieceWidth - tabSize, y*pieceHeight - tabSize)
                
                const correctLeft = x * pieceWidth - tabSize;
                const correctTop = y * pieceHeight - tabSize;
                
                pieceCanvas.dataset.correctLeft = correctLeft;
                pieceCanvas.dataset.correctTop = correctTop;
                
                // Initial Group ID (each piece is its own group initially)
                pieceCanvas.dataset.groupId = `${x}-${y}`;
                pieceCanvas.dataset.gridX = x;
                pieceCanvas.dataset.gridY = y;
                
                // Random Scatter with Padding
                const padding = 20;
                const maxRandomX = Math.max(0, workspaceWidth - canvasWidth - padding);
                const maxRandomY = Math.max(0, workspaceHeight - canvasHeight - padding);
                
                const randomLeft = padding + Math.random() * maxRandomX;
                const randomTop = padding + Math.random() * maxRandomY;
                
                pieceCanvas.style.left = `${randomLeft}px`;
                pieceCanvas.style.top = `${randomTop}px`;
                pieceCanvas.style.width = `${canvasWidth}px`;
                pieceCanvas.style.height = `${canvasHeight}px`;

                pieceCanvas.addEventListener('mousedown', startDrag);
                
                puzzleContainer.appendChild(pieceCanvas);
                pieces.push(pieceCanvas);
            }
        }
        
        // Remove background grid call
        // drawBackgroundGrid(...);

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
    }
    
    function drawPuzzleShape(ctx, width, height, tabSize, shape) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        // Top
        if (shape.top !== 0) {
            drawTab(ctx, width, tabSize, shape.top);
        } else {
            ctx.lineTo(width, 0);
        }
        
        // Right
        if (shape.right !== 0) {
            ctx.translate(width, 0);
            ctx.rotate(Math.PI / 2);
            drawTab(ctx, height, tabSize, shape.right);
            ctx.rotate(-Math.PI / 2);
            ctx.translate(-width, 0);
        } else {
            ctx.lineTo(width, height);
        }
        
        // Bottom
        if (shape.bottom !== 0) {
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
            drawTab(ctx, width, tabSize, shape.bottom);
            ctx.rotate(-Math.PI);
            ctx.translate(-width, -height);
        } else {
            ctx.lineTo(0, height);
        }
        
        // Left
        if (shape.left !== 0) {
            ctx.translate(0, height);
            ctx.rotate(Math.PI * 1.5);
            drawTab(ctx, height, tabSize, shape.left);
            ctx.rotate(-Math.PI * 1.5);
            ctx.translate(0, -height);
        } else {
            ctx.lineTo(0, 0);
        }
        
        ctx.closePath();
    }
    
    function drawTab(ctx, length, tabSize, type) {
        // type: 1 = out, -1 = in
        const cw = length;
        const s = tabSize; 
        const sign = type;
        
        const cx = cw / 2;
        
        // New Smooth Shape (Symmetric)
        const x0 = cw * 0.35; // Shoulder Start
        const x3 = cw * 0.65; // Shoulder End
        
        // Control Points for smooth peak
        // We use a peak at (cx, -s * sign)
        // Tangent at peak should be horizontal (dy/dx = 0)
        
        ctx.lineTo(x0, 0);
        
        // Curve 1: Shoulder to Peak
        ctx.bezierCurveTo(
            x0 + s * 0.1, -s * 0.2 * sign,      // CP1: Start squeeze
            cx - s * 0.3, -s * sign,            // CP2: Approach peak horizontally
            cx, -s * sign                       // End: Peak
        );
        
        // Curve 2: Peak to Shoulder
        ctx.bezierCurveTo(
            cx + s * 0.3, -s * sign,            // CP1: Leave peak horizontally
            x3 - s * 0.1, -s * 0.2 * sign,      // CP2: End squeeze
            x3, 0                               // End: Shoulder
        );
        
        ctx.lineTo(cw, 0);
    }
    
    function safeDrawImage(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
        // Clamp source rectangle to image bounds
        if (sx < 0) {
            const shift = -sx;
            const ratio = dw / sw;
            sx = 0;
            sw -= shift;
            dx += shift * ratio;
            dw -= shift * ratio;
        }
        if (sy < 0) {
            const shift = -sy;
            const ratio = dh / sh;
            sy = 0;
            sh -= shift;
            dy += shift * ratio;
            dh -= shift * ratio;
        }
        if (sx + sw > image.width) {
            const overflow = (sx + sw) - image.width;
            const ratio = dw / sw;
            sw -= overflow;
            dw -= overflow * ratio;
        }
        if (sy + sh > image.height) {
            const overflow = (sy + sh) - image.height;
            const ratio = dh / sh;
            sh -= overflow;
            dh -= overflow * ratio;
        }
        
        if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;

        ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    
    function drawBackgroundGrid(gridSize, pieceWidth, pieceHeight, tabs, tabSize, w, h) {
        // Create a canvas for the background
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = w;
        bgCanvas.height = h;
        const ctx = bgCanvas.getContext('2d');
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        
        for(let y=0; y<gridSize; y++) {
            for(let x=0; x<gridSize; x++) {
                ctx.save();
                ctx.translate(x * pieceWidth, y * pieceHeight);
                drawPuzzleShape(ctx, pieceWidth, pieceHeight, tabSize, tabs[y][x]);
                ctx.stroke();
                ctx.restore();
            }
        }
        
        puzzleContainer.style.backgroundImage = `url(${bgCanvas.toDataURL()})`;
    }

    // Global variables for group dragging
    let draggedGroupPieces = [];
    let groupStartPositions = [];

    function startDrag(e) {
        if (e.target.classList.contains('correct')) return;
        
        // Handle transparency click-through
        const rect = e.target.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        const ctx = e.target.getContext('2d');
        const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
        
        // If transparent (alpha < 10)
        if (pixel[3] < 10) {
            e.target.style.visibility = 'hidden';
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            e.target.style.visibility = 'visible';
            
            if (elementBelow && elementBelow.classList.contains('puzzle-piece')) {
                const newEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    view: window
                });
                elementBelow.dispatchEvent(newEvent);
            }
            return;
        }

        isDragging = true;
        selectedPiece = e.target;
        
        // Find all pieces in this group
        const groupId = selectedPiece.dataset.groupId;
        draggedGroupPieces = pieces.filter(p => p.dataset.groupId === groupId);
        
        // Store initial positions
        groupStartPositions = draggedGroupPieces.map(p => ({
            left: parseFloat(p.style.left),
            top: parseFloat(p.style.top)
        }));
        
        // Bring group to front and add dragging class
        draggedGroupPieces.forEach(p => {
            p.style.zIndex = 100;
            p.classList.add('dragging');
        });
        
        // Calculate offset for the clicked piece
        // We track movement relative to the mouse start point
        offsetX = e.clientX;
        offsetY = e.clientY;
    }

    function drag(e) {
        if (!isDragging || !selectedPiece) return;
        e.preventDefault();
        
        const dx = e.clientX - offsetX;
        const dy = e.clientY - offsetY;
        
        // Move all pieces in the group
        draggedGroupPieces.forEach((p, index) => {
            const startPos = groupStartPositions[index];
            p.style.left = `${startPos.left + dx}px`;
            p.style.top = `${startPos.top + dy}px`;
        });
    }

    function endDrag(e) {
        if (!isDragging || !selectedPiece) return;
        
        // Reset Z-index and remove dragging class
        draggedGroupPieces.forEach(p => {
            p.style.zIndex = 10;
            p.classList.remove('dragging');
        });
        
        // Check for Snaps with OTHER groups
        let snapOccurred = false;
        const threshold = 15;
        
        // We only need to check if ANY piece in our dragged group snaps to ANY piece in another group
        // If one snaps, the whole group merges.
        
        // Iterate through dragged pieces
        for (const p1 of draggedGroupPieces) {
            const p1CorrectLeft = parseFloat(p1.dataset.correctLeft);
            const p1CorrectTop = parseFloat(p1.dataset.correctTop);
            const p1CurrentLeft = parseFloat(p1.style.left);
            const p1CurrentTop = parseFloat(p1.style.top);
            
            // Check against all other pieces NOT in the same group
            for (const p2 of pieces) {
                if (p2.dataset.groupId === p1.dataset.groupId) continue;
                
                const p2CorrectLeft = parseFloat(p2.dataset.correctLeft);
                const p2CorrectTop = parseFloat(p2.dataset.correctTop);
                const p2CurrentLeft = parseFloat(p2.style.left);
                const p2CurrentTop = parseFloat(p2.style.top);
                
                // Calculate expected relative distance
                const expectedDx = p1CorrectLeft - p2CorrectLeft;
                const expectedDy = p1CorrectTop - p2CorrectTop;
                
                // Calculate actual relative distance
                const actualDx = p1CurrentLeft - p2CurrentLeft;
                const actualDy = p1CurrentTop - p2CurrentTop;
                
                // Check if close enough
                if (Math.abs(actualDx - expectedDx) < threshold && 
                    Math.abs(actualDy - expectedDy) < threshold) {
                    
                    // SNAP!
                    // Align p1 group to p2 group
                    // We need to move the ENTIRE p1 group so that p1 is exactly relative to p2
                    
                    // The target position for p1 should be:
                    const targetLeft = p2CurrentLeft + expectedDx;
                    const targetTop = p2CurrentTop + expectedDy;
                    
                    // The adjustment vector for the whole group
                    const adjustX = targetLeft - p1CurrentLeft;
                    const adjustY = targetTop - p1CurrentTop;
                    
                    // Apply adjustment to all dragged pieces
                    draggedGroupPieces.forEach(draggedPiece => {
                        const currentL = parseFloat(draggedPiece.style.left);
                        const currentT = parseFloat(draggedPiece.style.top);
                        draggedPiece.style.left = `${currentL + adjustX}px`;
                        draggedPiece.style.top = `${currentT + adjustY}px`;
                        
                        // Update Group ID to match the target
                        draggedPiece.dataset.groupId = p2.dataset.groupId;
                    });
                    
                    // Visual feedback (flash?)
                    // p1.style.filter = 'brightness(1.5)';
                    // setTimeout(() => p1.style.filter = '', 200);
                    
                    snapOccurred = true;
                    break; // Stop checking p2s
                }
            }
            if (snapOccurred) break; // Stop checking p1s
        }
        
        // Check Win Condition
        // If all pieces have the same Group ID, we win!
        const allGroups = pieces.map(p => p.dataset.groupId);
        const uniqueGroups = new Set(allGroups);
        
        if (uniqueGroups.size === 1) {
             // Verify alignment? 
             // Our snap logic enforces correct relative alignment.
             // If they are all in one group, they must be assembled correctly.
             setTimeout(() => alert('Puzzle Completed!'), 100);
             pieces.forEach(p => p.classList.add('correct')); // Add visual effect
        }
        
        isDragging = false;
        selectedPiece = null;
        draggedGroupPieces = [];
    }

    function checkWin() {
        const allCorrect = pieces.every(p => p.classList.contains('correct'));
        if (allCorrect) {
            setTimeout(() => alert('Puzzle Completed!'), 100);
        }
    }
});
