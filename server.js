const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");

const app = express();
app.use(express.json());

// Render compatible port
const PORT = process.env.PORT || 3000;

// ==============================
// Load Firebase Service Account from ENV
// ==============================

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ==============================
// Helper: Detect File Extension
// ==============================

function getFileExtension(url) {
  const cleanUrl = url.split("?")[0];
  return cleanUrl.substring(cleanUrl.lastIndexOf("."));
}

// ==============================
// API Endpoint
// ==============================

app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl missing" });
    }

    // Detect extension (jpg, png, pdf, mp4 etc)
    const extension = getFileExtension(fileUrl);

    // Generate Firebase filename
    const fileName = `uploads/${Date.now()}${extension}`;

    // Download file
    const response = await axios({
      url: fileUrl,
      method: "GET",
      responseType: "stream"
    });

    // Upload to Firebase
    const file = bucket.file(fileName);

    await new Promise((resolve, reject) => {

      const stream = file.createWriteStream({
        resumable: false,
        contentType: response.headers["content-type"]
      });

      response.data.pipe(stream)
        .on("finish", resolve)
        .on("error", reject);
    });

    // Make public
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // FINAL RESPONSE (11za compatible)
    res.json({
      url: publicUrl
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Upload failed"
    });

  }

});

// ==============================
// Start Server
// ==============================

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
