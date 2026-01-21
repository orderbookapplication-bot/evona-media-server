const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();

// Increase body limit for big media
app.use(express.json({ limit: "200mb" }));

// ================================
// LOAD FIREBASE SERVICE ACCOUNT
// ================================

// IMPORTANT:
// In Render ENV variable:
// KEY NAME = FIREBASE_SERVICE_ACCOUNT
// VALUE = Base64 encoded firebase json

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

// ================================
// INIT FIREBASE
// ================================

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ================================
// MIME TYPE MAP
// ================================

const mimeMap = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf"
};

// ================================
// UPLOAD API
// ================================

app.post("/upload-from-appsheet", async (req, res) => {
  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "fileUrl missing"
      });
    }

    // ================================
    // DOWNLOAD FILE FROM APPSHEET
    // ================================

    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    // ================================
    // FIX CONTENT TYPE (REMOVE charset)
    // ================================

    let contentType = response.headers["content-type"];

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: "Unable to detect file type"
      });
    }

    contentType = contentType.split(";")[0].trim();

    const ext = mimeMap[contentType];

    if (!ext) {
      return res.status(400).json({
        success: false,
        error: "Unsupported file type",
        received: contentType
      });
    }

    // ================================
    // GENERATE FILE NAME
    // ================================

    const fileName = `uploads/${Date.now()}.${ext}`;

    const file = bucket.file(fileName);

    // ================================
    // UPLOAD TO FIREBASE
    // ================================

    await file.save(response.data, {
      metadata: {
        contentType: contentType
      },
      resumable: false
    });

    // Make public
    await file.makePublic();

    // ================================
    // WHATSAPP MOBILE SAFE URL
    // ================================

    const encodedPath = encodeURIComponent(fileName);

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

    // ================================
    // RESPONSE
    // ================================

    return res.json({
      success: true,
      url: publicUrl,
      fileType: contentType
    });

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: err.message
    });
  }
});

// ================================
// HEALTH CHECK
// ================================

app.get("/", (req, res) => {
  res.send("Evona Media Server Running ✅");
});

// ================================
// RENDER COMPATIBLE PORT
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
