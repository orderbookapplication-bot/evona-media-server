const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json({ limit: "100mb" }));

// Load Firebase from ENV (Render compatible)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// Extension Map
const mimeMap = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf"
};

// Upload API
app.post("/upload-from-appsheet", async (req, res) => {
  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl missing" });
    }

    // Download file
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    // FIX MIME TYPE (REMOVE charset)
    let contentType = response.headers["content-type"];
    contentType = contentType.split(";")[0].trim();

    const ext = mimeMap[contentType];

    if (!ext) {
      return res.status(400).json({
        error: "Unsupported file type",
        received: contentType
      });
    }

    const fileName = `uploads/${Date.now()}.${ext}`;

    const file = bucket.file(fileName);

    await file.save(response.data, {
      metadata: {
        contentType: contentType
      }
    });

    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return res.json({
      url: publicUrl,
      type: contentType
    });

  } catch (err) {

    console.error("UPLOAD ERROR:", err.message);

    return res.status(500).json({
      error: "Upload failed",
      details: err.message
    });
  }
});

// Render Compatible Port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
