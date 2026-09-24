// ==========================================================================
// BEAUTYSCAN AI - APPLICATION LOGIC
// Powered by TensorFlow.js & Teachable Machine
// ==========================================================================

const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/h4IQnb35Q/";

function getModelURL() {
    let url = localStorage.getItem("beautyscan_model_url") || DEFAULT_MODEL_URL;
    if (!url.endsWith("/")) url += "/";
    return url;
}

// ==========================================================================
// PREDICTION SETTINGS
// ==========================================================================

// Minimum confidence required
const CONFIDENCE_THRESHOLD = 0.70;

// Top prediction must be at least 20% higher than second prediction
const MIN_MARGIN = 0.20;

// Hold detected state smoothly
const HOLD_FRAMES_BUFFER = 10;

// Only these 4 classes are considered valid
const VALID_CLASSES = [
    "Lipstick",
    "Mascara",
    "Blusher",
    "Foundation"
];

// Product metadata for rich UI updates
const PRODUCTS_DATA = {
    Lipstick: {
        name: "Lipstick",
        image: "assets/lipstick.jpg",
        headline: "Great! This looks like a lipstick.",
        sub: "Keep scanning for more products!",
        defaultConfidence: 96.82
    },

    Foundation: {
        name: "Foundation",
        image: "assets/foundation.jpg",
        headline: "Perfection! Liquid foundation detected.",
        sub: "Ensure good lighting for maximum accuracy.",
        defaultConfidence: 94.15
    },

    Blusher: {
        name: "Blusher",
        image: "assets/blusher.jpg",
        headline: "Radiant! Rosy powder blusher identified.",
        sub: "Keep scanning for more beauty essentials!",
        defaultConfidence: 95.40
    },

    Mascara: {
        name: "Mascara",
        image: "assets/mascara.jpg",
        headline: "Stunning! Precision mascara detected.",
        sub: "Point mascara wand or tube clearly to scan.",
        defaultConfidence: 97.20
    }
};

// ==========================================================================
// GLOBAL STATE
// ==========================================================================

let model = null;
let webcam = null;
let isCameraRunning = false;
let renderAnimationId = null;
let aiIntervalId = null;
let isPredicting = false;

// Tracking state for smooth, flicker-free detection
let holdBuffer = 0;
let currentDetectedProduct = null;


// ==========================================================================
// CLASS NORMALIZATION
// ==========================================================================

function normalizeClassName(className) {
    const lower = (className || "").toLowerCase();

    if (lower.includes("lipstick")) {
        return "Lipstick";
    }

    if (lower.includes("mascara")) {
        return "Mascara";
    }

    if (lower.includes("blusher")) {
        return "Blusher";
    }

    if (lower.includes("foundation")) {
        return "Foundation";
    }

    return null;
}


// ==========================================================================
// CHECK WHETHER PREDICTION IS VALID
// ==========================================================================

function isValidPrediction(predictions) {

    if (!predictions || predictions.length === 0) {
        return false;
    }

    // Sort highest confidence first
    predictions.sort((a, b) => b.probability - a.probability);

    const top = predictions[0];
    const second = predictions[1] || {
        probability: 0
    };

    const topClass = normalizeClassName(top.className);

    const confidenceOK =
        top.probability >= CONFIDENCE_THRESHOLD;

    const marginOK =
        (top.probability - second.probability) >= MIN_MARGIN;

    const classOK =
        VALID_CLASSES.includes(topClass);

    console.log("BeautyScan Prediction:", {
        class: top.className,
        confidence: (top.probability * 100).toFixed(2) + "%",
        secondConfidence: (second.probability * 100).toFixed(2) + "%",
        margin: ((top.probability - second.probability) * 100).toFixed(2) + "%",
        classOK: classOK,
        confidenceOK: confidenceOK,
        marginOK: marginOK
    });

    return classOK && confidenceOK && marginOK;
}


// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    showWaitingState(false);
    preloadModel();
});


// ==========================================================================
// PRELOAD TEACHABLE MACHINE MODEL
// ==========================================================================

async function preloadModel() {

    try {

        const baseURL = getModelURL();

        const t = Date.now();

        const modelJSON =
            baseURL + "model.json?t=" + t;

        const metadataJSON =
            baseURL + "metadata.json?t=" + t;

        model = await tmImage.load(
            modelJSON,
            metadataJSON
        );

        console.log(
            "BeautyScan AI: Model loaded successfully from:",
            baseURL
        );

        console.log(
            "BeautyScan AI: Classes:",
            model.getClassLabels
                ? model.getClassLabels()
                : "Loaded"
        );

    } catch (err) {

        console.warn(
            "BeautyScan AI: Load with cache-buster notice, falling back:",
            err
        );

        try {

            const baseURL = getModelURL();

            model = await tmImage.load(
                baseURL + "model.json",
                baseURL + "metadata.json"
            );

        } catch (e2) {

            console.error(
                "BeautyScan AI: Failed to load model:",
                e2
            );
        }
    }
}


// ==========================================================================
// CAMERA CONTROLS
// ==========================================================================

async function toggleCamera() {

    if (isCameraRunning) {

        stopCamera();

    } else {

        await startCamera();

    }
}


// ==========================================================================
// OPEN IMAGE UPLOAD
// ==========================================================================

function openUploadPicker() {

    const input =
        document.getElementById("imageUploadInput");

    if (input) {
        input.click();
    }
}


// ==========================================================================
// IMAGE UPLOAD PREDICTION
// ==========================================================================

async function handleImageUpload(event) {

    const file =
        event.target.files &&
        event.target.files[0];

    if (!file) return;

    // Stop live webcam before using uploaded image
    if (isCameraRunning) {
        stopCamera();
    }

    const statusText =
        document.getElementById("statusText");

    const uploadBtn =
        document.getElementById("uploadBtn");

    const container =
        document.getElementById("webcam-container");

    const standbyEl =
        document.getElementById("cameraStandby");

    const laserEl =
        document.getElementById("scanLaser");

    try {

        // Load model if not loaded
        if (!model) {

            if (statusText) {
                statusText.textContent =
                    "Loading AI Model...";
            }

            await preloadModel();
        }

        if (!model) {
            throw new Error(
                "AI model tidak berjaya dimuatkan."
            );
        }

        if (uploadBtn) {
            uploadBtn.disabled = true;
        }

        if (statusText) {

            statusText.textContent =
                "Analyzing Image...";

            statusText.style.color =
                "#9a4d68";
        }

        // Remove old preview
        if (container) {

            const oldCanvas =
                container.querySelector("canvas");

            if (oldCanvas) {
                oldCanvas.remove();
            }

            const oldImage =
                container.querySelector(
                    ".uploaded-image-preview"
                );

            if (oldImage) {
                oldImage.remove();
            }
        }

        const img =
            document.createElement("img");

        img.className =
            "uploaded-image-preview";

        img.alt =
            "Uploaded makeup product";

        img.src =
            URL.createObjectURL(file);

        img.onload = async () => {

            try {

                if (standbyEl) {
                    standbyEl.style.display =
                        "none";
                }

                if (laserEl) {
                    laserEl.style.display =
                        "none";
                }

                if (container) {
                    container.appendChild(img);
                }

                // Get prediction
                const predictions =
                    await model.predict(img);

                // Sort highest confidence first
                predictions.sort(
                    (a, b) =>
                        b.probability -
                        a.probability
                );

                const top =
                    predictions[0];

                if (!top) {
                    throw new Error(
                        "Tiada prediction daripada model."
                    );
                }

                const second =
                    predictions[1] || {
                        probability: 0
                    };

                // Update probability pills
                predictions.forEach(p => {

                    const key =
                        normalizeClassName(
                            p.className
                        );

                    if (key) {

                        const pill =
                            document.getElementById(
                                "prob-" + key
                            );

                        if (pill) {

                            pill.textContent =
                                (
                                    p.probability *
                                    100
                                ).toFixed(1) + "%";
                        }
                    }
                });

                // Normalize class
                const topClass =
                    normalizeClassName(
                        top.className
                    );

                // Check confidence
                const confidenceOK =
                    top.probability >=
                    CONFIDENCE_THRESHOLD;

                // Check difference between top and second
                const marginOK =
                    (
                        top.probability -
                        second.probability
                    ) >= MIN_MARGIN;

                // Check whether it belongs to one of 4 classes
                const classOK =
                    VALID_CLASSES.includes(
                        topClass
                    );

                // ======================================================
                // VALID PRODUCT
                // ======================================================

                if (
                    classOK &&
                    confidenceOK &&
                    marginOK
                ) {

                    showDetectedState(
                        topClass,
                        top.probability
                    );

                    if (statusText) {
                        statusText.textContent =
                            "Image Scanned";
                    }

                }

                // ======================================================
                // UNKNOWN
                // ======================================================

                else {

                    showUnknownState(
                        top.className,
                        top.probability
                    );

                    if (statusText) {
                        statusText.textContent =
                            "UNKNOWN";
                    }
                }

            } catch (err) {

                console.error(
                    "Upload prediction error:",
                    err
                );

                alert(
                    "Imej tidak dapat dianalisis. Sila cuba gambar lain."
                );

                resetScan();

            } finally {

                URL.revokeObjectURL(
                    img.src
                );

                if (uploadBtn) {
                    uploadBtn.disabled = false;
                }
            }
        };

        img.onerror = () => {

            URL.revokeObjectURL(
                img.src
            );

            if (uploadBtn) {
                uploadBtn.disabled = false;
            }

            throw new Error(
                "Imej tidak dapat dibaca."
            );
        };

    } catch (error) {

        console.error(
            "Image upload failed:",
            error
        );

        alert(
            "Imej tidak dapat dibuka. Sila pilih fail imej yang sah."
        );

        if (uploadBtn) {
            uploadBtn.disabled = false;
        }

        resetScan();

    } finally {

        // Allow same file to be selected again
        event.target.value = "";
    }
}


// ==========================================================================
// RESET SCAN
// ==========================================================================

function resetScan() {

    if (isCameraRunning) {
        stopCamera();
    }

    const container =
        document.getElementById(
            "webcam-container"
        );

    const standbyEl =
        document.getElementById(
            "cameraStandby"
        );

    const laserEl =
        document.getElementById(
            "scanLaser"
        );

    const statusText =
        document.getElementById(
            "statusText"
        );

    const uploadBtn =
        document.getElementById(
            "uploadBtn"
        );

    const input =
        document.getElementById(
            "imageUploadInput"
        );

    if (container) {

        const oldImage =
            container.querySelector(
                ".uploaded-image-preview"
            );

        if (oldImage) {
            oldImage.remove();
        }

        const oldCanvas =
            container.querySelector("canvas");

        if (oldCanvas) {
            oldCanvas.remove();
        }
    }

    if (standbyEl) {
        standbyEl.style.display =
            "flex";
    }

    if (laserEl) {
        laserEl.style.display =
            "none";
    }

    if (statusText) {

        statusText.textContent =
            "Ready to Scan";

        statusText.style.color =
            "#435c4e";
    }

    if (uploadBtn) {
        uploadBtn.disabled = false;
    }

    if (input) {
        input.value = "";
    }

    holdBuffer = 0;

    currentDetectedProduct = null;

    showWaitingState(false);
}


// ==========================================================================
// START CAMERA
// ==========================================================================

async function startCamera() {

    const startBtn =
        document.getElementById(
            "startBtn"
        );

    const btnLabel =
        document.getElementById(
            "btnLabel"
        );

    const statusText =
        document.getElementById(
            "statusText"
        );

    const standbyEl =
        document.getElementById(
            "cameraStandby"
        );

    const laserEl =
        document.getElementById(
            "scanLaser"
        );

    // Loading state
    btnLabel.textContent =
        "INITIALIZING...";

    startBtn.disabled = true;

    try {

        if (!model) {

            statusText.textContent =
                "Loading AI Model...";

            await preloadModel();
        }

        // Setup Teachable Machine webcam
        const flip = true;

        const width = 400;

        const height = 400;

        webcam =
            new tmImage.Webcam(
                width,
                height,
                flip
            );

        // Request browser camera permission
        await webcam.setup();

        await webcam.play();

        const container =
            document.getElementById(
                "webcam-container"
            );

        // Hide standby
        if (standbyEl) {
            standbyEl.style.display =
                "none";
        }

        // Show scanning laser
        if (laserEl) {
            laserEl.style.display =
                "block";
        }

        // Remove old canvas
        const oldCanvas =
            container.querySelector(
                "canvas"
            );

        if (oldCanvas) {
            oldCanvas.remove();
        }

        container.appendChild(
            webcam.canvas
        );

        isCameraRunning = true;

        btnLabel.textContent =
            "STOP CAMERA";

        startBtn.classList.add(
            "active-state"
        );

        startBtn.disabled = false;

        statusText.textContent =
            "Scanning Live...";

        statusText.style.color =
            "#059669";

        // Reset tracking
        holdBuffer = 0;

        currentDetectedProduct = null;

        isPredicting = false;

        showWaitingState(true);

        // Start webcam rendering
        renderWebcam();

        // Start AI prediction
        startAIPredictions();

    } catch (error) {

        console.error(
            "Camera access failed:",
            error
        );

        alert(
            "Camera permission denied or camera not available. You can test predictions by clicking on the Product Classes cards!"
        );

        btnLabel.textContent =
            "START CAMERA";

        startBtn.classList.remove(
            "active-state"
        );

        startBtn.disabled = false;

        statusText.textContent =
            "Ready to Scan";

        statusText.style.color =
            "#435c4e";

        if (standbyEl) {
            standbyEl.style.display =
                "flex";
        }

        if (laserEl) {
            laserEl.style.display =
                "none";
        }

        isCameraRunning = false;
    }
}


// ==========================================================================
// STOP CAMERA
// ==========================================================================

function stopCamera() {

    if (webcam) {

        try {

            webcam.stop();

        } catch (e) {

            console.warn(e);
        }
    }

    if (renderAnimationId) {

        cancelAnimationFrame(
            renderAnimationId
        );

        renderAnimationId = null;
    }

    if (aiIntervalId) {

        clearInterval(
            aiIntervalId
        );

        aiIntervalId = null;
    }

    isPredicting = false;

    isCameraRunning = false;

    const startBtn =
        document.getElementById(
            "startBtn"
        );

    const btnLabel =
        document.getElementById(
            "btnLabel"
        );

    const statusText =
        document.getElementById(
            "statusText"
        );

    const standbyEl =
        document.getElementById(
            "cameraStandby"
        );

    const laserEl =
        document.getElementById(
            "scanLaser"
        );

    const container =
        document.getElementById(
            "webcam-container"
        );

    const uploadBtn =
        document.getElementById(
            "uploadBtn"
        );

    btnLabel.textContent =
        "START CAMERA";

    startBtn.classList.remove(
        "active-state"
    );

    startBtn.disabled = false;

    statusText.textContent =
        "Ready to Scan";

    statusText.style.color =
        "#435c4e";

    const canvas =
        container.querySelector(
            "canvas"
        );

    if (canvas) {
        canvas.remove();
    }

    const uploadedImage =
        container.querySelector(
            ".uploaded-image-preview"
        );

    if (uploadedImage) {
        uploadedImage.remove();
    }

    if (uploadBtn) {
        uploadBtn.disabled = false;
    }

    if (standbyEl) {
        standbyEl.style.display =
            "flex";
    }

    if (laserEl) {
        laserEl.style.display =
            "none";
    }

    showWaitingState(false);
}


// ==========================================================================
// 60 FPS WEBCAM RENDER LOOP
// ==========================================================================

function renderWebcam() {

    if (
        !isCameraRunning ||
        !webcam
    ) {
        return;
    }

    webcam.update();

    renderAnimationId =
        window.requestAnimationFrame(
            renderWebcam
        );
}


// ==========================================================================
// ASYNC AI PREDICTION ENGINE
// ==========================================================================

function startAIPredictions() {

    if (aiIntervalId) {
        clearInterval(aiIntervalId);
    }

    // Run prediction every 75ms
    aiIntervalId =
        setInterval(
            runAIPrediction,
            75
        );
}


// ==========================================================================
// RUN AI PREDICTION
// ==========================================================================

async function runAIPrediction() {

    if (
        !isCameraRunning ||
        !model ||
        !webcam ||
        !webcam.canvas
    ) {
        return;
    }

    if (isPredicting) {
        return;
    }

    isPredicting = true;

    try {

        const predictions =
            await model.predict(
                webcam.canvas
            );

        // ==============================================================
        // UPDATE PROBABILITY PILLS
        // ==============================================================

        predictions.forEach(p => {

            const key =
                normalizeClassName(
                    p.className
                );

            if (key) {

                const pill =
                    document.getElementById(
                        "prob-" + key
                    );

                if (pill) {

                    pill.textContent =
                        (
                            p.probability *
                            100
                        ).toFixed(1) + "%";
                }
            }
        });

        // Sort highest confidence first
        predictions.sort(
            (a, b) =>
                b.probability -
                a.probability
        );

        const top =
            predictions[0];

        const second =
            predictions[1] || {
                probability: 0
            };

        if (!top) {

            showUnknownState(
                "",
                0
            );

            return;
        }

        // ==============================================================
        // GET PREDICTION INFORMATION
        // ==============================================================

        const topClass =
            normalizeClassName(
                top.className
            );

        const confidenceOK =
            top.probability >=
            CONFIDENCE_THRESHOLD;

        const marginOK =
            (
                top.probability -
                second.probability
            ) >= MIN_MARGIN;

        const classOK =
            VALID_CLASSES.includes(
                topClass
            );

        // Debug information
        console.log({
            prediction:
                top.className,

            confidence:
                (
                    top.probability *
                    100
                ).toFixed(2) + "%",

            second:
                (
                    second.probability *
                    100
                ).toFixed(2) + "%",

            margin:
                (
                    (
                        top.probability -
                        second.probability
                    ) * 100
                ).toFixed(2) + "%",

            classOK:
                classOK,

            confidenceOK:
                confidenceOK,

            marginOK:
                marginOK
        });

        // ==============================================================
        // UNKNOWN / INVALID OBJECT
        // ==============================================================

        if (
            !classOK ||
            !confidenceOK ||
            !marginOK
        ) {

            if (holdBuffer > 0) {

                holdBuffer--;

            } else {

                showUnknownState(
                    top.className,
                    top.probability
                );
            }

            return;
        }

        // ==============================================================
        // VALID MAKEUP PRODUCT
        // ==============================================================

        holdBuffer =
            HOLD_FRAMES_BUFFER;

        showDetectedState(
            topClass,
            top.probability
        );

    } catch (err) {

        console.error(
            "AI Prediction error:",
            err
        );

    } finally {

        isPredicting = false;
    }
}


// ==========================================================================
// UI STATE: WAITING
// ==========================================================================

function showWaitingState(
    isLiveScanning = false,
    isNonMakeupObject = false
) {

    currentDetectedProduct = null;

    const circleFrame =
        document.getElementById(
            "productCircleFrame"
        );

    const imgEl =
        document.getElementById(
            "detectedImage"
        );

    const badgeEl =
        document.getElementById(
            "detectedStatusBadge"
        );

    const badgeIconEl =
        document.getElementById(
            "detectedBadgeIcon"
        );

    const badgeTextEl =
        document.getElementById(
            "detectedStatusText"
        );

    const nameEl =
        document.getElementById(
            "detectedName"
        );

    const confValEl =
        document.getElementById(
            "confidenceValue"
        );

    const confBarEl =
        document.getElementById(
            "confidenceBar"
        );

    const avatarEl =
        document.getElementById(
            "feedbackAvatar"
        );

    const headEl =
        document.getElementById(
            "feedbackHeadline"
        );

    const subEl =
        document.getElementById(
            "feedbackSub"
        );

    // Circle image
    if (imgEl) {

        imgEl.src =
            "assets/no-product.svg";

        imgEl.alt =
            "No Product Detected";
    }

    if (circleFrame) {

        if (isLiveScanning) {

            circleFrame.classList.add(
                "scanning-pulse"
            );

        } else {

            circleFrame.classList.remove(
                "scanning-pulse"
            );
        }
    }

    // Status badge
    if (badgeEl) {

        badgeEl.className =
            "pill-badge-detected waiting-state";
    }

    if (badgeIconEl) {

        badgeIconEl.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
            >
                <circle
                    cx="11"
                    cy="11"
                    r="8"
                ></circle>

                <line
                    x1="21"
                    y1="21"
                    x2="16.65"
                    y2="16.65"
                ></line>
            </svg>
        `;
    }

    if (badgeTextEl) {

        badgeTextEl.textContent =
            isLiveScanning
                ? "LOOKING FOR MAKEUP..."
                : "WAITING FOR SCAN";
    }

    // Title
    if (nameEl) {

        nameEl.className =
            "product-title waiting-text";

        nameEl.textContent =
            isLiveScanning
                ? "Looking for product..."
                : "Waiting for scan";
    }

    // Confidence
    if (confValEl) {

        confValEl.className =
            "confidence-percent zero-val";

        confValEl.textContent =
            "0.00%";
    }

    if (confBarEl) {

        confBarEl.style.width =
            "0%";
    }

    // Feedback
    if (avatarEl) {

        avatarEl.innerHTML =
            `<span class="heart-icon">${
                isLiveScanning
                    ? "🔍"
                    : "✨"
            }</span>`;
    }

    if (isNonMakeupObject) {

        if (headEl) {

            headEl.textContent =
                "Non-makeup object detected";
        }

        if (subEl) {

            subEl.textContent =
                "Phones or everyday items are ignored. Show your makeup product clearly.";
        }

    } else if (isLiveScanning) {

        if (headEl) {

            headEl.textContent =
                "Scanning active - waiting for makeup...";
        }

        if (subEl) {

            subEl.textContent =
                "Hold your lipstick, foundation, blusher or mascara in front of the lens.";
        }

    } else {

        if (headEl) {

            headEl.textContent =
                "Waiting for makeup product...";
        }

        if (subEl) {

            subEl.textContent =
                "Click 'START CAMERA' and align your product within the brackets.";
        }
    }

    // Remove active classes
    document
        .querySelectorAll(".class-card")
        .forEach(card =>
            card.classList.remove(
                "active"
            )
        );

    if (!isLiveScanning) {

        document
            .querySelectorAll(
                ".class-prob-pill"
            )
            .forEach(
                p => p.textContent = "0%"
            );
    }
}


// ==========================================================================
// UI STATE: UNKNOWN
// ==========================================================================

function showUnknownState(
    topClassName,
    confidence
) {

    currentDetectedProduct = null;

    const circleFrame =
        document.getElementById(
            "productCircleFrame"
        );

    const imgEl =
        document.getElementById(
            "detectedImage"
        );

    const badgeEl =
        document.getElementById(
            "detectedStatusBadge"
        );

    const badgeIconEl =
        document.getElementById(
            "detectedBadgeIcon"
        );

    const badgeTextEl =
        document.getElementById(
            "detectedStatusText"
        );

    const nameEl =
        document.getElementById(
            "detectedName"
        );

    const confValEl =
        document.getElementById(
            "confidenceValue"
        );

    const confBarEl =
        document.getElementById(
            "confidenceBar"
        );

    const avatarEl =
        document.getElementById(
            "feedbackAvatar"
        );

    const headEl =
        document.getElementById(
            "feedbackHeadline"
        );

    const subEl =
        document.getElementById(
            "feedbackSub"
        );

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                confidence * 100
            )
        );

    // Circle
    if (circleFrame) {

        circleFrame.classList.remove(
            "scanning-pulse"
        );
    }

    if (imgEl) {

        imgEl.src =
            "assets/no-product.svg";

        imgEl.alt =
            "Unknown Product";
    }

    // Badge
    if (badgeEl) {

        badgeEl.className =
            "pill-badge-detected waiting-state";
    }

    if (badgeIconEl) {

        badgeIconEl.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="9"
                ></circle>

                <line
                    x1="9"
                    y1="9"
                    x2="15"
                    y2="15"
                ></line>

                <line
                    x1="15"
                    y1="9"
                    x2="9"
                    y2="15"
                ></line>
            </svg>
        `;
    }

    if (badgeTextEl) {

        badgeTextEl.textContent =
            "UNKNOWN";
    }

    // Product title
    if (nameEl) {

        nameEl.className =
            "product-title waiting-text";

        nameEl.textContent =
            "UNKNOWN";
    }

    // Confidence
    if (confValEl) {

        confValEl.className =
            "confidence-percent";

        confValEl.textContent =
            percent.toFixed(2) + "%";
    }

    if (confBarEl) {

        confBarEl.style.width =
            percent + "%";
    }

    // Feedback
    if (avatarEl) {

        avatarEl.innerHTML =
            `<span class="heart-icon">❓</span>`;
    }

    if (headEl) {

        headEl.textContent =
            "Product not confidently identified";
    }

    if (subEl) {

        subEl.textContent =
            "This image does not meet the required confidence or prediction criteria. Please show a lipstick, foundation, blusher or mascara clearly.";
    }

    // Remove active cards
    document
        .querySelectorAll(".class-card")
        .forEach(card =>
            card.classList.remove(
                "active"
            )
        );
}


// ==========================================================================
// UI STATE: VALID PRODUCT DETECTED
// ==========================================================================

function showDetectedState(
    className,
    confidence
) {

    // Normalize class
    const key =
        normalizeClassName(
            className
        );

    // If not valid → UNKNOWN
    if (!key) {

        showUnknownState(
            className,
            confidence
        );

        return;
    }

    currentDetectedProduct =
        key;

    const data =
        PRODUCTS_DATA[key];

    if (!data) {
        return;
    }

    // Elements
    const circleFrame =
        document.getElementById(
            "productCircleFrame"
        );

    const nameEl =
        document.getElementById(
            "detectedName"
        );

    const imgEl =
        document.getElementById(
            "detectedImage"
        );

    const badgeEl =
        document.getElementById(
            "detectedStatusBadge"
        );

    const badgeIconEl =
        document.getElementById(
            "detectedBadgeIcon"
        );

    const badgeTextEl =
        document.getElementById(
            "detectedStatusText"
        );

    const confValEl =
        document.getElementById(
            "confidenceValue"
        );

    const confBarEl =
        document.getElementById(
            "confidenceBar"
        );

    const avatarEl =
        document.getElementById(
            "feedbackAvatar"
        );

    const headEl =
        document.getElementById(
            "feedbackHeadline"
        );

    const subEl =
        document.getElementById(
            "feedbackSub"
        );

    // Percentage
    const percentNum =
        confidence * 100;

    const percentStr =
        Math.round(
            percentNum
        ) + "%";

    // Circle
    if (circleFrame) {

        circleFrame.classList.remove(
            "scanning-pulse"
        );
    }

    if (
        imgEl &&
        imgEl.src !== data.image
    ) {

        imgEl.src =
            data.image;

        imgEl.alt =
            data.name;
    }

    // Badge
    if (badgeEl) {

        badgeEl.className =
            "pill-badge-detected detected-state";
    }

    if (badgeIconEl) {

        badgeIconEl.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
            >
                <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                />
            </svg>
        `;
    }

    if (badgeTextEl) {

        badgeTextEl.textContent =
            "PRODUCT DETECTED";
    }

    // Title
    if (nameEl) {

        nameEl.className =
            "product-title";

        nameEl.textContent =
            data.name;
    }

    // Confidence
    if (confValEl) {

        confValEl.className =
            "confidence-percent";

        confValEl.textContent =
            percentStr;
    }

    if (confBarEl) {

        confBarEl.style.width =
            Math.min(
                100,
                Math.max(
                    5,
                    percentNum
                )
            ) + "%";
    }

    // Feedback
    if (avatarEl) {

        avatarEl.innerHTML =
            `<span class="heart-icon">♥</span>`;
    }

    if (headEl) {

        headEl.textContent =
            data.headline;
    }

    if (subEl) {

        subEl.textContent =
            data.sub;
    }

    // Highlight active product card
    document
        .querySelectorAll(".class-card")
        .forEach(card =>
            card.classList.remove(
                "active"
            )
        );

    const activeCard =
        document.getElementById(
            "classCard-" + key
        );

    if (activeCard) {

        activeCard.classList.add(
            "active"
        );
    }
}


// ==========================================================================
// INTERACTIVE CLASS PREVIEWS
// ==========================================================================

function selectClassPreview(
    className
) {

    // Toggle off if same class selected
    if (
        currentDetectedProduct === className &&
        !isCameraRunning
    ) {

        showWaitingState(false);

        return;
    }

    const data =
        PRODUCTS_DATA[className];

    if (data) {

        showDetectedState(
            className,
            data.defaultConfidence / 100
        );
    }
}


// ==========================================================================
// NAVIGATION ACTIVE STATE
// ==========================================================================

function setActiveNav(
    navKey
) {

    document
        .querySelectorAll(".nav-item")
        .forEach(btn =>
            btn.classList.remove(
                "active"
            )
        );

    const homeBtn =
        document.querySelector(
            ".nav-item"
        );

    if (homeBtn) {

        homeBtn.classList.add(
            "active"
        );
    }
}


// ==========================================================================
// MODAL HANDLERS
// ==========================================================================

function openModal(type) {

    const modalBackdrop =
        document.getElementById(
            "modalBackdrop"
        );

    const modalContent =
        document.getElementById(
            "modalContent"
        );

    // ==============================================================
    // ABOUT
    // ==============================================================

    if (type === "about") {

        modalContent.innerHTML = `

            <div class="modal-body">

                <h2>
                    About BeautyScan AI
                </h2>

                <p>
                    <strong>
                        BeautyScan AI
                    </strong>
                    is a cutting-edge computer vision application designed specifically for cosmetic product identification.
                </p>

                <p>
                    Built with TensorFlow.js and Google Teachable Machine, BeautyScan AI runs an on-device deep learning neural network inside your browser, recognizing 4 major cosmetic classes in real time:
                </p>

                <ul
                    style="
                        margin-left: 20px;
                        line-height: 1.8;
                        color: var(--text-body);
                    "
                >

                    <li>
                        💄
                        <strong>
                            Lipstick:
                        </strong>
                        Bullet cases, glosses, and liquid lipsticks
                    </li>

                    <li>
                        🧴
                        <strong>
                            Foundation:
                        </strong>
                        Bottles, liquid pumps, and compact creams
                    </li>

                    <li>
                        🌸
                        <strong>
                            Blusher:
                        </strong>
                        Powder compacts, pans, and blush cushions
                    </li>

                    <li>
                        👁️
                        <strong>
                            Mascara:
                        </strong>
                        Tubes, wands, and brush applicators
                    </li>

                </ul>

                <p
                    style="
                        margin-top: 14px;
                        font-size: 13px;
                        color: var(--text-muted);
                    "
                >
                    All image analysis is conducted locally on your device for absolute privacy and instantaneous predictions.
                </p>

            </div>
        `;
    }


    // ==============================================================
    // HOW IT WORKS
    // ==============================================================

    else if (type === "how-it-works") {

        modalContent.innerHTML = `

            <div class="modal-body">

                <h2>
                    How It Works
                </h2>

                <div class="modal-step">

                    <span class="modal-step-number">
                        1
                    </span>

                    <div>

                        <strong>
                            Launch Your Camera
                        </strong>

                        <p
                            style="
                                margin-bottom: 8px;
                            "
                        >
                            Tap the
                            <em>
                                "Start Camera"
                            </em>
                            button and grant browser permission to activate the live video stream.
                        </p>

                    </div>

                </div>


                <div class="modal-step">

                    <span class="modal-step-number">
                        2
                    </span>

                    <div>

                        <strong>
                            Frame Your Product
                        </strong>

                        <p
                            style="
                                margin-bottom: 8px;
                            "
                        >
                            Hold any lipstick, foundation, blusher, or mascara within the camera's focus brackets.
                        </p>

                    </div>

                </div>


                <div class="modal-step">

                    <span class="modal-step-number">
                        3
                    </span>

                    <div>

                        <strong>
                            Instant Classification
                        </strong>

                        <p
                            style="
                                margin-bottom: 8px;
                            "
                        >
                            The AI model analyzes frames with confidence and prediction filtering. Images that do not meet the required criteria are displayed as UNKNOWN.
                        </p>

                    </div>

                </div>

            </div>
        `;
    }


    // ==============================================================
    // MODEL SETTINGS
    // ==============================================================

    else if (type === "model-settings") {

        const currentURL =
            getModelURL();

        modalContent.innerHTML = `

            <div class="modal-body">

                <h2>
                    AI Model Settings
                </h2>

                <p>
                    Link Model Teachable Machine anda. Sekiranya anda telah melatih (*retrain*) model baru dengan gambar mekap tambahan, *paste* pautan model baru di sini:
                </p>

                <div class="model-input-group">

                    <input
                        type="text"
                        id="modelUrlInput"
                        class="model-url-input"
                        value="${currentURL}"
                        placeholder="https://teachablemachine.withgoogle.com/models/.../"
                    >

                    <button
                        class="btn-save-model"
                        onclick="saveModelURL()"
                    >
                        Simpan & Muat Semula
                    </button>

                </div>

                <div
                    style="
                        margin-top: 16px;
                        font-size: 12.5px;
                        color: var(--text-muted);
                        line-height: 1.5;
                    "
                >
                    💡
                    <em>
                        Tip: Selepas tekan "Train Model" dalam Teachable Machine, tekan "Export Model" &gt; "Update my cloud model" untuk dapatkan pautan terbaharu.
                    </em>
                </div>

            </div>
        `;
    }

    modalBackdrop.classList.add(
        "open"
    );
}


// ==========================================================================
// SAVE MODEL URL
// ==========================================================================

async function saveModelURL() {

    const input =
        document.getElementById(
            "modelUrlInput"
        );

    if (!input) return;

    let newURL =
        input.value.trim();

    if (!newURL) {

        alert(
            "Sila masukkan URL model yang sah."
        );

        return;
    }

    if (!newURL.endsWith("/")) {
        newURL += "/";
    }

    localStorage.setItem(
        "beautyscan_model_url",
        newURL
    );

    alert(
        "Model URL berjaya disimpan! Model AI sedang dimuatkan semula..."
    );

    closeModal();

    // Reload model
    await preloadModel();
}


// ==========================================================================
// CLOSE MODAL
// ==========================================================================

function closeModal() {

    const modalBackdrop =
        document.getElementById(
            "modalBackdrop"
        );

    modalBackdrop.classList.remove(
        "open"
    );
}


// ==========================================================================
// CLOSE MODAL WITH ESCAPE
// ==========================================================================

document.addEventListener(
    "keydown",
    (e) => {

        if (e.key === "Escape") {

            closeModal();
        }
    }
);