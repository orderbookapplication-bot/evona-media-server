const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json({ limit: "100mb" }));

// ==============================
// FIREBASE INIT FROM ENV (RENDER SAFE)
// ==============================

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ==============================
// VIDEO UPLOAD API (WHATSAPP SAFE)
// ==============================

app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl missing" });
    }

    console.log("Downloading full video file...");

    // Download COMPLETE FILE
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const buffer = Buffer.from(response.data);

    const fileName = `uploads/${Date.now()}.mp4`;
    const firebaseFile = bucket.file(fileName);

    console.log("Uploading to Firebase Storage...");

    // Upload as FULL BINARY FILE (NO STREAM)
    await firebaseFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType: "video/mp4",
        cacheControl: "public,max-age=31536000",
        contentDisposition: "inline"
      }
    });

    await firebaseFile.makePublic();

    const publicUrl =
      `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    console.log("Upload success:", publicUrl);

    return res.json({
      success: true,
      url: publicUrl
    });

  } catch (error) {

    console.error("UPLOAD ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: error.message
    });

  }

});

// ==============================
// RENDER PORT CONFIG
// ==============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
